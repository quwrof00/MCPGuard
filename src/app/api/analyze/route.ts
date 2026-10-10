
import { NextResponse } from "next/server";
import { analyzeUpdate } from "@/lib/engine/analyze";

export const runtime = "nodejs";

export async function POST() {
  try {
    const report = await analyzeUpdate();

    return NextResponse.json(report);
  } catch (error) {
    console.error("MCP Guard analysis failed:", error);

    return NextResponse.json(
      { error: "Analysis failed. Check the server logs." },
      { status: 500 },
    );
  }
}
