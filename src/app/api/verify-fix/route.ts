import { NextResponse } from "next/server";
import { verifyFix } from "@/lib/engine/analyze";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workflowId, stepId, fixedArgs, stepOverrides } = body;

    if (!workflowId || !stepId || !fixedArgs) {
      return NextResponse.json(
        { error: "Missing required fields: workflowId, stepId, fixedArgs" },
        { status: 400 },
      );
    }

    const verificationResult = await verifyFix({
      workflowId,
      stepId,
      fixedArgs,
      stepOverrides,
    });

    return NextResponse.json(verificationResult);
  } catch (error) {
    console.error("MCP Guard fix verification failed:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Fix verification failed",
      },
      { status: 500 },
    );
  }
}
