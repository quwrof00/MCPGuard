import { NextResponse } from "next/server";
import { llmFallbackFix } from "@/lib/engine/llm";
import type { SchemaChange } from "@/lib/engine/schema-diff";
import { withTrace, flushTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";

const semanticChange: SchemaChange[] = [
  {
    tool: "search_incidents",
    kind: "type_changed",
    parameter: "include_resolved",
    before: "string",
    after: "boolean",
    severity: "breaking",
  },
];

export async function POST() {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Groq is not configured for AI-assisted migration." }, { status: 503 });
  }

  const args = { include_resolved: "false", severity: "critical" };
  const errorMessage = "Validation failed: include_resolved must be a boolean.";

  const result = await withTrace("mcp-ai-fallback", "AGENT", {
    resolutionPath: "llm_fallback",
    tool: "search_incidents",
    deterministicRuleMatched: false,
  }, async () => llmFallbackFix({ tool: "search_incidents", args, errorMessage, changes: semanticChange }));

  await flushTelemetry();

  if (!result) {
    return NextResponse.json({ error: "Groq did not return a valid migration payload." }, { status: 502 });
  }

  return NextResponse.json({
    path: "AI-assisted fallback",
    model: "llama-3.1-8b-instant via Groq",
    deterministicRuleMatched: false,
    error: errorMessage,
    originalArgs: args,
    change: semanticChange[0],
    result,
  });
}
