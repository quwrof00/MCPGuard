
import { describe, it, expect } from "vitest";
import { analyzeUpdate } from "../src/lib/engine/analyze.js";

describe("MCP Guard analysis engine", () => {
  it("compares server versions and replays workflows", async () => {
    const report = await analyzeUpdate();

    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
    expect(report.summary.breakingChanges).toBe(2);

    expect(report.workflows).toHaveLength(2);

    const baseline = report.workflows.find((workflow) =>
      workflow.name.includes("(baseline)")
    );

    const candidate = report.workflows.find((workflow) =>
      workflow.name.includes("(candidate)")
    );

    expect(baseline?.status).toBe("passed");
    expect(candidate?.status).toBe("failed");
  });
});
