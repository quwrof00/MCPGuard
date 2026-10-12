import { NextResponse } from "next/server";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

export const runtime = "nodejs";

async function exists(targetPath: string) {
  try {
    await access(targetPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [entireReady, cfoReady] = await Promise.all([
    exists(`${process.cwd()}/.entire/settings.json`),
    exists(`${process.cwd()}/BUSINESS_PLAN.md`),
  ]);

  return NextResponse.json({
    neatlogs: Boolean(process.env.NEATLOGS_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    entire: entireReady,
    cfo: cfoReady,
  });
}
