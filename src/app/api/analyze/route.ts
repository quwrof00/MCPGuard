
import { NextResponse } from "next/server";
import { analyzeUpdate } from "@/lib/engine/analyze";
import { withTrace, flushTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST() {
  try {
    const report = await withTrace(
      "mcp-compatibility-analysis",
      "WORKFLOW",
      {
        target: "github-mock",
        baselineVersion: "v1.0.0",
        candidateVersion: "v2.0.0",
      },
      async () => {
        return await analyzeUpdate();
      }
    );

    await flushTelemetry();
    return NextResponse.json(report);
  } catch (error) {
    console.error("MCP Guard analysis failed:", error);

    return NextResponse.json(
      { error: "Analysis failed. Check the server logs." },
      { status: 500 },
    );
  }
}

