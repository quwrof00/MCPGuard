import type { SchemaChange } from "./schema-diff";
import { llmFallbackFix } from "./llm";

export type SuggestedFix = {
  workflowId: string;
  stepId: string;
  tool: string;
  originalArgs: Record<string, unknown>;
  fixedArgs: Record<string, unknown>;
  explanation: string;
  diffSummary: string;
  confidence: "high" | "medium";
  ruleApplied: string;
};

/**
 * Deterministically analyzes schema mutations and runtime errors to synthesize
 * a corrected argument payload for a broken workflow step.
 *
 * Priority:
 *  1. Rule-based fixer (deterministic, high confidence)
 *  2. LLM fallback via llama-3.1-8b-instant / Groq (medium confidence)
 *     — only invoked when no rule matched; silently returns null on error.
 */
export async function synthesizeFix(params: {
  workflowId: string;
  stepId: string;
  tool: string;
  args: Record<string, unknown>;
  errorMessage: string;
  changes: SchemaChange[];
}): Promise<SuggestedFix | null> {
  const { workflowId, stepId, tool, args, errorMessage, changes } = params;

  // Filter changes relevant to this specific tool
  const toolChanges = changes.filter((c) => c.tool === tool);
  if (toolChanges.length === 0) {
    return null;
  }

  const fixedArgs: Record<string, unknown> = { ...args };
  const explanations: string[] = [];
  const diffs: string[] = [];
  let ruleApplied = "unknown";
  let mutated = false;

  const removedParams = toolChanges.filter((c) => c.kind === "parameter_removed" && c.parameter);
  const addedParams = toolChanges.filter((c) => c.kind === "parameter_added" && c.parameter);
  const typeChangedParams = toolChanges.filter((c) => c.kind === "type_changed" && c.parameter);

  // Rule 1: Parameter Renamed / Replaced
  for (const removed of removedParams) {
    const oldKey = removed.parameter!;
    if (!(oldKey in args)) continue;

    const oldValue = args[oldKey];

    // Find likely replacement in addedParams (e.g. issue_id -> issue_number)
    const replacement = addedParams.find((a) => {
      const addedKey = a.parameter!;
      // Match common naming patterns: issue_id -> issue_number, id -> number, etc.
      return (
        addedKey.includes(oldKey.replace(/_id$/, "")) ||
        oldKey.includes(addedKey.replace(/_number$/, "")) ||
        addedParams.length === 1
      );
    });

    if (replacement) {
      const newKey = replacement.parameter!;
      delete fixedArgs[oldKey];

      // Handle type coercion (e.g. string "42" -> number 42)
      let newValue: unknown = oldValue;
      if (replacement.after === "number" && typeof oldValue === "string") {
        const parsed = Number(oldValue);
        newValue = !isNaN(parsed) ? parsed : oldValue;
      } else if (replacement.after === "string" && typeof oldValue === "number") {
        newValue = String(oldValue);
      } else if (replacement.after === "boolean") {
        newValue = Boolean(oldValue);
      }

      fixedArgs[newKey] = newValue;
      mutated = true;
      ruleApplied = "parameter_renamed_and_coerced";
      explanations.push(
        `Tool '${tool}' replaced parameter '${oldKey}' with '${newKey}' (type: ${replacement.after ?? "any"}). Migrated argument '${oldKey}' value ${JSON.stringify(oldValue)} to '${newKey}' (${JSON.stringify(newValue)}).`,
      );
      diffs.push(`- "${oldKey}": ${JSON.stringify(oldValue)}\n+ "${newKey}": ${JSON.stringify(newValue)}`);
    }
  }

  // Rule 2: Type coercion on existing parameter
  for (const tc of typeChangedParams) {
    const key = tc.parameter!;
    if (key in fixedArgs) {
      const val = fixedArgs[key];
      if (tc.after === "number" && typeof val === "string") {
        const parsed = Number(val);
        if (!isNaN(parsed)) {
          fixedArgs[key] = parsed;
          mutated = true;
          ruleApplied = "type_coercion";
          explanations.push(
            `Parameter '${key}' changed type from ${tc.before} to ${tc.after}. Coerced value ${JSON.stringify(val)} to number ${parsed}.`,
          );
          diffs.push(`- "${key}": ${JSON.stringify(val)}\n+ "${key}": ${parsed}`);
        }
      }
    }
  }

  // Rule 3: Missing required parameter added with safe default
  for (const added of addedParams) {
    const key = added.parameter!;
    if (added.severity === "breaking" && !(key in fixedArgs)) {
      if (added.after === "string") {
        fixedArgs[key] = "default";
      } else if (added.after === "number") {
        fixedArgs[key] = 1;
      } else if (added.after === "boolean") {
        fixedArgs[key] = true;
      }
      mutated = true;
      explanations.push(`Added required parameter '${key}' (type: ${added.after ?? "unknown"}) with recommended default.`);
      diffs.push(`+ "${key}": ${JSON.stringify(fixedArgs[key])}`);
    }
  }

  if (!mutated) {
    // No deterministic rule matched — try LLM fallback
    const llmResult = await llmFallbackFix({ tool, args, errorMessage, changes });
    if (!llmResult) return null;
    return {
      workflowId,
      stepId,
      tool,
      originalArgs: args,
      fixedArgs: llmResult.fixedArgs,
      explanation: llmResult.explanation,
      diffSummary: llmResult.diffSummary,
      confidence: "medium",
      ruleApplied: "llm_fallback",
    };
  }

  return {
    workflowId,
    stepId,
    tool,
    originalArgs: args,
    fixedArgs,
    explanation: explanations.join(" "),
    diffSummary: diffs.join("\n"),
    confidence: "high",
    ruleApplied,
  };
}
