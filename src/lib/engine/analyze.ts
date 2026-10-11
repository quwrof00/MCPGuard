import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createV1Server, createV2Server } from "../../servers";
import { connectToServer } from "./connect-server";
import { inspectServer } from "./inspect-server";
import { compareTools, type SchemaChange } from "./schema-diff";
import { SAVED_WORKFLOWS, type AgentWorkflow, type WorkflowStep } from "../workflows/store";
import { synthesizeFix, type SuggestedFix } from "./fixer";
import { traceDependencies } from "./tracer";

export type { SuggestedFix };

export type StepExecutionResult = {
  stepId: string;
  tool: string;
  description: string;
  status: "passed" | "failed" | "skipped";
  args: Record<string, unknown>;
  output?: string;
  error?: string;
};

export type WorkflowExecutionResult = {
  workflowId: string;
  name: string;
  target: "baseline" | "candidate";
  status: "passed" | "failed";
  stepResults: StepExecutionResult[];
  failedStepIndex?: number;
  message: string;
};

export type AnalysisReport = {
  summary: {
    total: number;
    passed: number;
    failed: number;
    breakingChanges: number;
    impactedWorkflowsCount: number;
  };
  changes: SchemaChange[];
  workflows: WorkflowExecutionResult[];
  suggestedFixes: SuggestedFix[];
};

/**
 * Replays a multi-step agent workflow against a connected MCP server.
 * If any step fails, subsequent chained steps are automatically marked as skipped.
 */
async function runChainedWorkflow(params: {
  client: Client;
  workflow: AgentWorkflow;
  target: "baseline" | "candidate";
  changes: SchemaChange[];
  overrideArgs?: Record<string, Record<string, unknown>>; // stepId -> custom args for verification
}): Promise<{
  result: WorkflowExecutionResult;
  suggestedFixes: SuggestedFix[];
}> {
  const { client, workflow, target, changes, overrideArgs } = params;
  const stepResults: StepExecutionResult[] = [];
  const suggestedFixes: SuggestedFix[] = [];
  let workflowFailed = false;
  let failedStepIndex: number | undefined;
  let failureMessage = "";

  const stepOutputs: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    if (workflowFailed) {
      stepResults.push({
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        status: "skipped",
        args: step.args,
        error: "Previous step in chain failed.",
      });
      continue;
    }

    // Resolve arguments (from previous outputs or override)
    let currentArgs = { ...step.args };
    if (overrideArgs && overrideArgs[step.id]) {
      currentArgs = { ...overrideArgs[step.id] };
    } else if (step.fromPrevious && stepOutputs[step.fromPrevious.stepId]) {
      const sourceVal = stepOutputs[step.fromPrevious.stepId][step.fromPrevious.sourceKey];
      if (sourceVal !== undefined) {
        currentArgs[step.fromPrevious.targetKey] = sourceVal;
      }
    }

    try {
      const callRes = await client.callTool({
        name: step.tool,
        arguments: currentArgs,
      });

      const rawContent: unknown = callRes.content;
      const textOutput = Array.isArray(rawContent)
        ? rawContent
            .map((item: unknown) => {
              if (
                typeof item === "object" &&
                item !== null &&
                "type" in item &&
                item.type === "text" &&
                "text" in item &&
                typeof item.text === "string"
              ) {
                return item.text;
              }
              return "";
            })
            .filter(Boolean)
            .join("\n")
        : "";

      if (callRes.isError) {
        workflowFailed = true;
        failedStepIndex = i;
        failureMessage = `Tool call to '${step.tool}' failed: ${textOutput || "Schema validation or runtime error"}`;

        stepResults.push({
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          status: "failed",
          args: currentArgs,
          error: failureMessage,
        });

        // If candidate target, synthesize fix
        if (target === "candidate") {
          const fix = await synthesizeFix({
            workflowId: workflow.id,
            stepId: step.id,
            tool: step.tool,
            args: currentArgs,
            errorMessage: failureMessage,
            changes,
          });
          if (fix) suggestedFixes.push(fix);
        }
      } else {
        // Try parsing JSON output for chain passing
        try {
          stepOutputs[step.id] = JSON.parse(textOutput);
        } catch {
          stepOutputs[step.id] = { raw: textOutput };
        }

        stepResults.push({
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          status: "passed",
          args: currentArgs,
          output: textOutput,
        });
      }
    } catch (err) {
      workflowFailed = true;
      failedStepIndex = i;
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      failureMessage = `Exception executing tool '${step.tool}': ${errMsg}`;

      stepResults.push({
        stepId: step.id,
        tool: step.tool,
        description: step.description,
        status: "failed",
        args: currentArgs,
        error: failureMessage,
      });

      if (target === "candidate") {
        const fix = await synthesizeFix({
          workflowId: workflow.id,
          stepId: step.id,
          tool: step.tool,
          args: currentArgs,
          errorMessage: errMsg,
          changes,
        });
        if (fix) suggestedFixes.push(fix);
      }
    }
  }

  const overallStatus = workflowFailed ? "failed" : "passed";
  const name = `${workflow.name} (${target})`;

  return {
    result: {
      workflowId: workflow.id,
      name,
      target,
      status: overallStatus,
      stepResults,
      failedStepIndex,
      message: failureMessage || (overallStatus === "passed" ? "All chained steps succeeded" : "Chain broken"),
    },
    suggestedFixes,
  };
}

/**
 * Main coordinator function for MCP Guard analysis.
 * Inspects tools, compares schemas, traces dependencies, and executes replay tests.
 */
export async function analyzeUpdate(): Promise<AnalysisReport> {
  const oldConnection = await connectToServer(createV1Server());
  let newConnection: Awaited<ReturnType<typeof connectToServer>> | undefined;

  try {
    newConnection = await connectToServer(createV2Server());

    const [oldTools, newTools] = await Promise.all([
      inspectServer(oldConnection.client),
      inspectServer(newConnection.client),
    ]);

    const changes = compareTools(oldTools, newTools);
    const dependencyTraces = traceDependencies(SAVED_WORKFLOWS, changes);
    const impactedCount = dependencyTraces.filter((t) => t.isImpacted).length;

    const replayExecutions: WorkflowExecutionResult[] = [];
    const allFixes: SuggestedFix[] = [];

    // Replay each saved workflow against both servers
    for (const workflow of SAVED_WORKFLOWS) {
      const [baselineRes, candidateRes] = await Promise.all([
        runChainedWorkflow({
          client: oldConnection.client,
          workflow,
          target: "baseline",
          changes,
        }),
        runChainedWorkflow({
          client: newConnection.client,
          workflow,
          target: "candidate",
          changes,
        }),
      ]);

      replayExecutions.push(baselineRes.result, candidateRes.result);
      allFixes.push(...candidateRes.suggestedFixes);
    }

    const passed = replayExecutions.filter((r) => r.status === "passed").length;
    const failed = replayExecutions.length - passed;
    const breakingChangesCount = changes.filter((c) => c.severity === "breaking").length;

    return {
      summary: {
        total: replayExecutions.length,
        passed,
        failed,
        breakingChanges: breakingChangesCount,
        impactedWorkflowsCount: impactedCount,
      },
      changes,
      workflows: replayExecutions,
      suggestedFixes: allFixes,
    };
  } finally {
    await Promise.allSettled([
      oldConnection.client.close(),
      oldConnection.server.close(),
      ...(newConnection ? [newConnection.client.close(), newConnection.server.close()] : []),
    ]);
  }
}

export type TwoStageVerificationResult = {
  verified: boolean;
  stepPassed: boolean;
  message: string;
  stage1: {
    status: "passed" | "failed";
    tool: string;
    args: Record<string, unknown>;
    output?: unknown;
    error?: string;
    executionTimeMs: number;
  };
  stage2: {
    status: "passed" | "failed";
    workflowId: string;
    unblockedSteps: number;
    totalSteps: number;
    stepResults: StepExecutionResult[];
    message: string;
  };
  result: WorkflowExecutionResult;
};

/**
 * Two-stage verification:
 * Stage 1: Unit tests the modified tool call in isolation against Candidate V2.
 * Stage 2: Replays the full downstream agent workflow to verify cascading unblocking.
 */
export async function verifyFix(params: {
  workflowId: string;
  stepId: string;
  fixedArgs: Record<string, unknown>;
  stepOverrides?: Record<string, Record<string, unknown>>;
}): Promise<TwoStageVerificationResult> {
  const targetWorkflow = SAVED_WORKFLOWS.find((w) => w.id === params.workflowId);
  if (!targetWorkflow) {
    throw new Error(`Workflow with ID '${params.workflowId}' not found.`);
  }

  const targetStep = targetWorkflow.steps.find((s) => s.id === params.stepId);
  const toolName = targetStep ? targetStep.tool : "unknown_tool";

  const overrides: Record<string, Record<string, unknown>> = {
    ...(params.stepOverrides ?? {}),
    [params.stepId]: params.fixedArgs,
  };

  const connection = await connectToServer(createV2Server());
  try {
    // STAGE 1: Step Isolation Unit Test
    const t0 = performance.now();
    let stage1Status: "passed" | "failed" = "failed";
    let stage1Output: unknown = undefined;
    let stage1Error: string | undefined = undefined;

    try {
      const callRes = await connection.client.callTool({
        name: toolName,
        arguments: params.fixedArgs,
      });

      const rawContent: unknown = callRes.content;
      let textOutput = "";
      if (Array.isArray(rawContent) && rawContent.length > 0) {
        textOutput = (rawContent[0] as { text?: string }).text ?? JSON.stringify(rawContent);
      }
      if (callRes.isError || textOutput.includes("MCP error") || textOutput.includes("validation error")) {
        stage1Status = "failed";
        stage1Error = textOutput;
      } else {
        try {
          stage1Output = JSON.parse(textOutput);
        } catch {
          stage1Output = { raw: textOutput };
        }
        stage1Status = "passed";
      }
    } catch (err) {
      stage1Error = err instanceof Error ? err.message : "Tool call failed";
      stage1Status = "failed";
    }
    const t1 = performance.now();
    const executionTimeMs = Math.round((t1 - t0) * 10) / 10;

    // STAGE 2: Full Downstream Agent Chain Replay
    const replay = await runChainedWorkflow({
      client: connection.client,
      workflow: targetWorkflow,
      target: "candidate",
      changes: [],
      overrideArgs: overrides,
    });

    const targetStepResult = replay.result.stepResults.find((s) => s.stepId === params.stepId);
    const stepPassed = stage1Status === "passed" && (targetStepResult?.status === "passed");
    const entirePassed = stage1Status === "passed" && (replay.result.status === "passed");
    const unblockedCount = replay.result.stepResults.filter((s) => s.status === "passed").length;
    const totalSteps = replay.result.stepResults.length;

    let message = "";
    if (entirePassed) {
      message = `Two-stage verification passed: Step '${toolName}' passed in isolation, and all ${totalSteps}/${totalSteps} steps completed end-to-end.`;
    } else if (stepPassed) {
      message = `Stage 1 passed (${toolName} verified). Stage 2 unblocked ${unblockedCount}/${totalSteps} steps. Next downstream step needs migration.`;
    } else {
      message = `Stage 1 failed: Tool '${toolName}' rejected arguments: ${stage1Error ?? "Validation error"}`;
    }

    return {
      verified: entirePassed || (stage1Status === "passed" && stepPassed),
      stepPassed,
      message,
      stage1: {
        status: stage1Status,
        tool: toolName,
        args: params.fixedArgs,
        output: stage1Output,
        error: stage1Error,
        executionTimeMs,
      },
      stage2: {
        status: entirePassed ? "passed" : "failed",
        workflowId: targetWorkflow.id,
        unblockedSteps: unblockedCount,
        totalSteps,
        stepResults: replay.result.stepResults,
        message: replay.result.message,
      },
      result: replay.result,
    };
  } finally {
    await Promise.allSettled([connection.client.close(), connection.server.close()]);
  }
}
