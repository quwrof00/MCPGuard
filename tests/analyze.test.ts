import { describe, it, expect } from "vitest";
import { analyzeUpdate, verifyFix } from "../src/lib/engine/analyze.js";

describe("MCP Guard analysis engine", () => {
  it("compares server versions, replays chained workflows, and suggests fixes", async () => {
    const report = await analyzeUpdate();

    // 3 workflows tested against 2 server versions = 6 executions
    expect(report.summary.total).toBe(6);
    expect(report.summary.breakingChanges).toBe(4);
    expect(report.summary.impactedWorkflowsCount).toBe(2);

    // Baseline executions should all pass
    const baselineExecutions = report.workflows.filter((w) => w.target === "baseline");
    expect(baselineExecutions).toHaveLength(3);
    for (const b of baselineExecutions) {
      expect(b.status).toBe("passed");
    }

    // Candidate executions: 2 fail (triage & release note), 1 passes (explore org)
    const candidateTriage = report.workflows.find(
      (w) => w.workflowId === "wf-triage-issue" && w.target === "candidate",
    );
    const candidateExplore = report.workflows.find(
      (w) => w.workflowId === "wf-explore-org" && w.target === "candidate",
    );

    expect(candidateTriage?.status).toBe("failed");
    expect(candidateExplore?.status).toBe("passed");

    // Check chained behavior: Step 1 failed, subsequent steps skipped
    expect(candidateTriage?.stepResults[0].status).toBe("failed");
    expect(candidateTriage?.stepResults[1].status).toBe("skipped");

    // Automated fix synthesis
    expect(report.suggestedFixes.length).toBeGreaterThanOrEqual(1);
    const triageFix = report.suggestedFixes.find((f) => f.workflowId === "wf-triage-issue");
    expect(triageFix).toBeDefined();
    expect(triageFix?.fixedArgs).toEqual({ issue_number: 42 });
  });

  it("verifies that applying a suggested fix unblocks the workflow on candidate V2", async () => {
    const verification = await verifyFix({
      workflowId: "wf-release-note",
      stepId: "step-1",
      fixedArgs: {
        issue_number: 42,
        body: "Release v2.4.0 successfully deployed to production.",
      },
    });

    expect(verification.verified).toBe(true);
    expect(verification.result.status).toBe("passed");
    expect(verification.result.stepResults[0].status).toBe("passed");
  });
});
