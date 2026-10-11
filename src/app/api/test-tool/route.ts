import { NextResponse } from "next/server";
import { connectToServer } from "@/lib/engine/connect-server";
import { createV2Server } from "@/servers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool, args } = body;

    if (!tool || typeof args !== "object") {
      return NextResponse.json(
        { error: "Missing required fields: tool, args" },
        { status: 400 },
      );
    }

    const t0 = performance.now();
    const connection = await connectToServer(createV2Server());

    try {
      const callRes = await connection.client.callTool({
        name: tool,
        arguments: args,
      });

      const rawContent: unknown = callRes.content;
      let textOutput = "";
      if (Array.isArray(rawContent) && rawContent.length > 0) {
        textOutput = (rawContent[0] as { text?: string }).text ?? JSON.stringify(rawContent);
      }

      const t1 = performance.now();
      const executionTimeMs = Math.round((t1 - t0) * 10) / 10;

      if (callRes.isError || textOutput.includes("MCP error") || textOutput.includes("validation error")) {
        return NextResponse.json({
          success: false,
          status: "failed",
          error: textOutput,
          executionTimeMs,
        });
      }

      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(textOutput);
      } catch {
        parsedOutput = { raw: textOutput };
      }

      return NextResponse.json({
        success: true,
        status: "passed",
        output: parsedOutput,
        executionTimeMs,
      });
    } finally {
      await Promise.allSettled([connection.client.close(), connection.server.close()]);
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Tool call failed",
      },
      { status: 500 },
    );
  }
}
