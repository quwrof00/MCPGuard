import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createV1Server, createV2Server } from "../../servers.js";
import { connectToServer } from "./connect-server.js";
import { inspectServer } from "./inspect-server.js";
import { compareTools, type SchemaChange } from "./schema-diff.js";

export type WorkflowResult = {
  name: string;
  status: "passed" | "failed";
  message: string;
};

export type AnalysisReport = {
  summary: {
    total: number;
    passed: number;
    failed: number;
    breakingChanges: number;
  };
  changes: SchemaChange[];
  workflows: WorkflowResult[];
};

async function runWorkflow(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<WorkflowResult> {
  try {
    const result = await client.callTool({
      name: "get_issue",
      arguments: args,
    });

    const message = (result.content ?? [])
      .map((item) => (item.type === "text" ? item.text : ""))
      .filter(Boolean)
      .join("\n");

    return {
      name,
      status: result.isError ? "failed" : "passed",
      message:
        message || (result.isError ? "Tool call failed" : "Tool call succeeded"),
    };
  } catch (error) {
    return {
      name,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

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
    const workflows = [
      {
        name: "Fetch GitHub issue",
        args: { issue_id: "42" },
      },
    ];

    const results = await Promise.all(
      workflows.flatMap((workflow) => [
        runWorkflow(
          oldConnection.client,
          `${workflow.name} (baseline)`,
          workflow.args,
        ),
        runWorkflow(
          newConnection!.client,
          `${workflow.name} (candidate)`,
          workflow.args,
        ),
      ]),
    );

    const passed = results.filter((result) => result.status === "passed").length;

    return {
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        breakingChanges: changes.filter((change) => change.severity === "breaking")
          .length,
      },
      changes,
      workflows: results,
    };
  } finally {
    await Promise.allSettled([
      oldConnection.client.close(),
      oldConnection.server.close(),
      ...(newConnection
        ? [newConnection.client.close(), newConnection.server.close()]
        : []),
    ]);
  }
}
