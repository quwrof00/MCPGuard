import type { AgentWorkflow } from "../workflows/store";
import type { SchemaChange } from "./schema-diff";

export type TracedWorkflow = {
  workflow: AgentWorkflow;
  isImpacted: boolean;
  dependentTools: string[];
  breakingTools: string[];
  warnings: string[];
};

/**
 * Traces tool dependencies across workflows and cross-references them
 * with detected schema changes to flag at-risk agent workflows before replay.
 */
export function traceDependencies(
  workflows: AgentWorkflow[],
  changes: SchemaChange[],
): TracedWorkflow[] {
  const breakingToolsSet = new Set(
    changes
      .filter((c) => c.severity === "breaking")
      .map((c) => c.tool),
  );

  return workflows.map((wf) => {
    const dependentTools = Array.from(new Set(wf.steps.map((s) => s.tool)));
    const breakingTools = dependentTools.filter((t) => breakingToolsSet.has(t));
    const isImpacted = breakingTools.length > 0;

    const warnings: string[] = [];
    if (isImpacted) {
      warnings.push(
        `Workflow '${wf.name}' relies on tools with breaking changes: ${breakingTools.join(", ")}.`,
      );
    }

    return {
      workflow: wf,
      isImpacted,
      dependentTools,
      breakingTools,
      warnings,
    };
  });
}
