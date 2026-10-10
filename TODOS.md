# MCP Guard — Implementation Roadmap (TODOS)

This document outlines the implementation roadmap for the next development phase of **MCP Guard**. It provides the architecture, complete code implementations, and design details for a collaborator to continue seamlessly.

---

## 📋 Overview of Next Steps

Currently, the core inspection, schema comparison, and mock servers are built and tested. The next milestone is to assemble these components into an end-to-end system:

1. **[TODO 1] Central Analysis Engine** (`src/lib/engine/analyze.ts`): Orchestrates discovery, schema diffing, and workflow replay into a single pipeline.
2. **[TODO 2] Next.js API Route** (`src/app/api/analyze/route.ts`): Exposes the analysis pipeline over HTTP.
3. **[TODO 3] Web Dashboard** (`src/app/page.tsx`): Provides an interactive UI to trigger analysis and view breaking changes and workflow replay results.

---

## ⚙️ Prerequisites & Environment Setup

Before implementing the API and Dashboard, the repository requires Next.js and React dependencies, along with TypeScript path alias configuration.

### 1. Install Dependencies
```bash
npm install next react react-dom
npm install -D @types/react @types/react-dom tailwindcss postcss autoprefixer
```

### 2. Configure TypeScript Path Aliases (`tsconfig.json`)
Ensure `tsconfig.json` contains the `@/*` path mapping pointing to `./src/*`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "jsx": "preserve"
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts"
  ]
}
```

---

## 🛠️ TODO 1: Build the Central Analysis Engine

**Target File**: `src/lib/engine/analyze.ts`  
**Purpose**: Acts as the single entry point for the analysis subsystem. Instead of consumers manually connecting to servers, inspecting tools, comparing schemas, and executing test workflows, `analyzeUpdate()` automates the entire sequence and produces an `AnalysisReport`.

### Requirements & Flow
1. Connects to `createV1Server()` (baseline) and `createV2Server()` (candidate) via in-memory transports.
2. Inspects both servers to obtain their tool definitions.
3. Compares tool definitions using `compareTools()` to identify breaking and non-breaking schema modifications.
4. Replays saved agent workflows (e.g., `{ issue_id: "42" }`) against both versions:
   - Baseline execution (`<workflow_name> (baseline)`)
   - Candidate execution (`<workflow_name> (candidate)`)
5. Aggregates results: execution count (1 workflow × 2 targets = 2 executions), pass/fail tallies, and breaking change count.
6. Gracefully closes all client and server transports using `Promise.allSettled` in a `finally` block to prevent resource leaks.

### Implementation Code

```typescript
import { createV1Server, createV2Server } from "../servers";
import { connectToServer } from "./connect-server";
import { inspectServer } from "./inspect-server";
import { compareTools } from "./schema-diff";
import type { SchemaChange } from "./schema-diff";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

export type WorkflowResult = {
  name: string;
  status: "passed" | "failed";
  message: string;
};

export type AnalysisReport = {
  summary: {
    total: number;
    passed: number;
    failed: number;
    breakingChanges: number;
  };
  changes: SchemaChange[];
  workflows: WorkflowResult[];
};

async function runWorkflow(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<WorkflowResult> {
  try {
    const result = await client.callTool({
      name: "get_issue",
      arguments: args,
    });

    const message = (result.content ?? [])
      .map((item) => (item.type === "text" ? item.text : ""))
      .filter(Boolean)
      .join("\n");

    return {
      name,
      status: result.isError ? "failed" : "passed",
      message:
        message ||
        (result.isError ? "Tool call failed" : "Tool call succeeded"),
    };
  } catch (error) {
    return {
      name,
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function analyzeUpdate(): Promise<AnalysisReport> {
  const oldConnection = await connectToServer(createV1Server());
  let newConnection: Awaited<ReturnType<typeof connectToServer>> | undefined;

  try {
    newConnection = await connectToServer(createV2Server());

    const [oldTools, newTools] = await Promise.all([
      inspectServer(oldConnection.client),
      inspectServer(newConnection.client),
    ]);

    const changes = compareTools(oldTools, newTools);

    // Baseline workflow originally authored against V1
    const workflows = [
      {
        name: "Fetch GitHub issue",
        args: { issue_id: "42" },
      },
    ];

    const results = await Promise.all(
      workflows.flatMap((workflow) => [
        runWorkflow(
          oldConnection.client,
          `${workflow.name} (baseline)`,
          workflow.args,
        ),
        runWorkflow(
          newConnection!.client,
          `${workflow.name} (candidate)`,
          workflow.args,
        ),
      ]),
    );

    const passed = results.filter(
      (result) => result.status === "passed",
    ).length;

    return {
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        breakingChanges: changes.filter(
          (change) => change.severity === "breaking",
        ).length,
      },
      changes,
      workflows: results,
    };
  } finally {
    await Promise.allSettled([
      oldConnection.client.close(),
      oldConnection.server.close(),
      ...(newConnection
        ? [
            newConnection.client.close(),
            newConnection.server.close(),
          ]
        : []),
    ]);
  }
}
```

---

## 🌐 TODO 2: Expose Through a Next.js API Route

**Target File**: `src/app/api/analyze/route.ts`  
**Purpose**: Exposes the analysis engine over HTTP so web dashboards or CI/CD pipelines can invoke compatibility runs via POST requests.

### Requirements & Flow
- Export `runtime = "nodejs"` because the MCP SDK uses Node.js streams and process bindings.
- Handle `POST` requests and trigger `analyzeUpdate()`.
- Return standard JSON responses with `200 OK` on success, or `500 Internal Server Error` with error details if the run encounters unexpected failures.

### Implementation Code

```typescript
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
```

### Production Hardening Considerations
- **Authentication**: Add API key or session validation before exposing externally.
- **Dynamic Target Configuration**: Allow the request body to specify server endpoints or command configurations rather than static mock servers.
- **Timeout Management**: Safeguard long-running workflow replays with execution timeouts.

---

## 💻 TODO 3: Build the Dashboard

**Target File**: `src/app/page.tsx`  
**Purpose**: An interactive frontend for triggering compatibility checks, inspecting detected schema breakages, and checking baseline vs candidate workflow outcomes.

### Requirements & Flow
- Client component (`"use client"`).
- Manage 3 main states: Idle ("Ready to test"), Loading ("Analyzing..."), and Report display.
- Display 4 key metrics:
  - **Executions**: Total workflow replay attempts.
  - **Passed**: Successful tool invocations.
  - **Failed**: Broken tool invocations.
  - **Breaking changes**: Count of detected breaking schema differences.
- Schema Changes Panel: Lists affected tool names, change types (`parameter_removed`, `type_changed`, etc.), previous and new values, and color-coded severity badges.
- Workflow Replay Panel: Lists execution targets, pass/fail status badges, and stdout/error output.

### Implementation Code

```tsx
"use client";

import { useState } from "react";
import type { AnalysisReport } from "@/lib/engine/analyze";

export default function Home() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-zinc-400">
              MCP COMPATIBILITY TESTING
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">MCP Guard</h1>
            <p className="mt-2 text-zinc-400">
              Find broken agent workflows before shipping tool updates.
            </p>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading}
            className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Run analysis"}
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!report && !loading && !error && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
            <h2 className="text-lg font-semibold">Ready to test</h2>
            <p className="mt-2 text-zinc-400">
              Compare MCP server v1 and v2, then replay a saved workflow
              against both versions.
            </p>
          </section>
        )}

        {loading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <p className="text-zinc-400 animate-pulse">
              Inspecting tools and replaying workflows...
            </p>
          </div>
        )}

        {report && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Executions", report.summary.total],
                ["Passed", report.summary.passed],
                ["Failed", report.summary.failed],
                ["Breaking changes", report.summary.breakingChanges],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
                >
                  <p className="text-sm text-zinc-400">{label}</p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Schema changes</h2>

              {report.changes.length === 0 ? (
                <p className="text-zinc-400">No schema changes detected.</p>
              ) : (
                report.changes.map((change, index) => (
                  <div
                    key={`${change.tool}-${change.kind}-${index}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium font-mono text-zinc-200">{change.tool}</p>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          change.severity === "breaking"
                            ? "bg-red-950/60 text-red-400 border border-red-800/60"
                            : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                        }`}
                      >
                        {change.severity}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-zinc-300">
                      {change.kind}
                      {change.parameter ? `: ${change.parameter}` : ""}
                    </p>

                    {(change.before || change.after) && (
                      <p className="mt-1 text-sm text-zinc-500 font-mono">
                        {change.before ?? "—"} → {change.after ?? "—"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Workflow results</h2>

              {report.workflows.map((workflow, index) => (
                <div
                  key={`${workflow.name}-${index}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{workflow.name}</p>
                    <span
                      className={`text-sm font-semibold ${
                        workflow.status === "passed"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {workflow.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-400">
                    {workflow.message}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
```

---

## 🧪 Verification Plan
Once TODOs 1–3 are implemented:
1. Add an integration test `tests/analyze.test.ts` to verify `analyzeUpdate()` returns 2 executions, 1 pass (baseline), 1 fail (candidate), and 2 breaking changes.
2. Verify that running `npx vitest run` passes all test suites.
3. Start the Next.js dev server with `npm run dev` and click **Run analysis** to verify that the UI renders metrics, schema diffs, and workflow execution summaries correctly.
