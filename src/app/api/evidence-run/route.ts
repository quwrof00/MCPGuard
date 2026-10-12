import { NextResponse } from "next/server";
import { analyzeUpdate, verifyFix } from "@/lib/engine/analyze";
import { withTrace, flushTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST() {
  try {
    const evidence = await withTrace("mcp-recovery-evidence", "WORKFLOW", {
      goal: "demonstrate_failure_recovery",
      strategy: "audit_then_verify_suggested_fix",
    }, async () => {
      const audit = await analyzeUpdate();
      const failedCandidateReplays = audit.workflows.filter(
        (workflow) => workflow.target === "candidate" && workflow.status === "failed",
      ).length;

      for (const fix of audit.suggestedFixes) {
        const verification = await verifyFix({
          workflowId: fix.workflowId,
          stepId: fix.stepId,
          fixedArgs: fix.fixedArgs,
        });
        if (verification.verified) {
          return {
            initialFailedReplays: failedCandidateReplays,
            repairPath: fix.confidence === "high" ? "deterministic" : "ai-assisted",
            tool: fix.tool,
            ruleApplied: fix.ruleApplied,
            verification,
          };
        }
      }

      return {
        initialFailedReplays: failedCandidateReplays,
        repairPath: "none",
        tool: null,
        ruleApplied: null,
        verification: null,
      };
    });

    await flushTelemetry();
    return NextResponse.json(evidence);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evidence run failed." },
      { status: 500 },
    );
  }
}
