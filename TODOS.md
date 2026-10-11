# MCP Guard — Implementation Roadmap (TODOS) 

This document is the implementation record for **MCP Guard**. Every item below is done. The code samples in TODO 1–3 are the original sketches; the shipped engine, routes, and dashboard have since grown past them. Current behavior is in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

---

## 📋 Overview of Roadmap & Sponsor Integrations

### Core Engine & UI (Completed ✅)
1. **[TODO 1] Central Analysis Engine** (`src/lib/engine/analyze.ts`): ✅ Completed — Orchestrates discovery, schema diffing, dependency tracing, workflow replay, and AI fix verification into a unified pipeline.
2. **[TODO 2] Next.js API Routes** (`src/app/api/analyze/route.ts` & `src/app/api/verify-fix/route.ts`): ✅ Completed — Exposes analysis and two-stage fix verification over HTTP.
3. **[TODO 3] Web Dashboard** (`src/app/page.tsx`): ✅ Completed — Interactive dark-mode dashboard with real-time metrics, schema diff visualizer, chained execution logs, and interactive AI fix application.

### neatHack Sponsor Integrations (Planned & Implemented 🚀)
4. **[TODO 4] neatlogs Integration (Agent Observability & Lifecycle Tracing)**: ✅ Core Implemented — Traces every agent run, tool call, error, and fix verification with latency and pass/fail status.
5. **[TODO 5] Entire CLI Integration (Repository Context, Git Checkpoints & entire-graph)**: ✅ Completed — Entire CLI 0.11.4 enabled for Cursor, entire-graph v0.4.0 indexed, topology written to `ENTIRE_CONTEXT.md`.
6. **[TODO 6] cfo.ai Integration (Financial Model, Unit Economics & Runway Strategy)**: ✅ Completed (`BUSINESS_PLAN.md`) — Financial model covering SaaS pricing tiers, inference COGS, unit margins (>90%), and 18-month runway.


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

## 🧪 Core Verification (Status: Passed ✅)
All core requirements (TODOs 1–3) are implemented and verified:
1. `tests/schema-diff.test.ts` (unit tests for schema comparator)
2. `tests/guard.test.ts` (in-memory MCP transport and baseline vs candidate failure check)
3. `tests/inspect-server.test.ts` (protocol-level tool inspection)
4. `tests/analyze.test.ts` (workflow replay, cascading failure diagnostics, fix verification)
Run verification: `npx vitest run` — **4 suites, 6 tests passing (100%)**.

---

## 🛰️ TODO 4: neatlogs Integration (Agent Observability & Lifecycle Tracing)

### 💡 What We Think & Strategic Fit
MCP Guard's core mission is ensuring agent reliability across tool updates. In production, when agents run multi-step tool workflows, developers need full visibility into every tool call, latency, schema validation failure, and recovery step.
**neatlogs** is a dedicated agent tracing platform. By integrating `neatlogs`:
- Every `mcp-compatibility-analysis` run is recorded as an observable root trace.
- Individual workflow step replays and tool executions are tagged with latency and status.
- Fix verification runs are logged under the `GUARDRAIL` span kind, providing undeniable evidence of whether an AI fix unblocked the downstream workflow.
- Judges and developers can view the live telemetry stream in their Neatlogs workspace.

### 📐 Implementation Architecture
1. **SDK Module** (`src/lib/telemetry.ts`):
   - Wrapper using `init()`, `trace()`, and `flush()` from `neatlogs`.
   - Built-in graceful fallback (`disableExport: true`) for offline/local environments without an API key, guaranteeing zero downtime.
2. **API Route Instrumentation**:
   - `/api/analyze` (POST) wrapped in `withTrace("mcp-compatibility-analysis", "WORKFLOW", ...)`
   - `/api/verify-fix` (POST) wrapped in `withTrace("mcp-verify-fix", "GUARDRAIL", ...)`
   - Auto-flush on completion via `await flushTelemetry()`.
3. **Configuration**:
   - `NEATLOGS_API_KEY` defined in `.env.example` and `.env`.

### 🚀 Status & Deliverables
- [x] Package installed: `neatlogs@1.1.28`
- [x] Telemetry wrapper implemented: `src/lib/telemetry.ts`
- [x] API routes instrumented: `src/app/api/analyze/route.ts` & `src/app/api/verify-fix/route.ts`
- [x] Environment configuration updated: `.env.example`
- [x] All 6 unit tests passing with telemetry enabled

---

## 🌲 TODO 5: Entire CLI Integration (Repository Context, Git Checkpoints & entire-graph)

### 💡 What We Think & Strategic Fit
When MCP Guard synthesizes fixes or migrates tool parameters (e.g. `{ issue_id: "42" }` ➔ `{ issue_number: 42 }`), modifying agent prompt configurations or tool-calling client code introduces changes across the codebase.
**Entire (`entire.io`)** bridges Git commits with agent reasoning:
- **Checkpoints**: Entire attaches the exact prompt, schema diff, and verification proof directly behind each Git commit or remediation pull request.
- **entire-graph**: Generates a symbol dependency graph mapping all MCP tool usages across the repo, showing exactly which files depend on a mutated tool.
- Provides cryptographic/auditable provenance: proving that a human-in-the-loop approved an automated MCP migration verified by MCP Guard.

### 📐 Implementation Architecture
1. **CLI Installation**:
   - Install Entire CLI (`irm https://entire.io/install.ps1 | iex` on Windows / `curl -fsSL https://entire.io/install.sh | bash` on Linux/macOS).
2. **Repository Configuration**:
   - `entire enable --agent cursor` activates Git hooks and Cursor session hooks in this repo.
   - Checkpoints use the git-refs backend (`.entire/settings.json`).
3. **Context Graph (`entire-graph`)**:
   - Generate repository relationship maps showing MCP server connections, tracer dependencies, and API handlers.
   - Document graph insights in submission materials.

### 🚀 Status & Deliverables
- [x] Entire CLI 0.11.4 installed (`entire.exe` in the user local bin; checksum verified against the v0.11.4 release)
- [x] `entire enable --agent cursor` wrote `.entire/settings.json` (git-refs checkpoints) and the git hooks that attach an `Entire-Checkpoint` trailer on commit
- [x] entire-graph v0.4.0 installed; `entire graph init-agents` wrote `.entire/graph-agent.md`. The generated `AGENTS.md`, `CLAUDE.md`, and `.cursor/hooks.json` were removed afterward
- [x] Dependency topology documented in `ENTIRE_CONTEXT.md` from `entire graph snapshot` and `entire graph impact`

The checkpoint ref itself is created by the post-commit hook on the next commit. Until that commit exists, `entire checkpoint list` has nothing to show.

---

## 📈 TODO 6: cfo.ai Integration (Financial Model, Unit Economics & Runway Strategy)

### 💡 What We Think & Strategic Fit
Hackathons reward projects that solve real problems with viable business models. AI agent failure is an expensive enterprise problem—silent tool drift can halt automated customer support or corrupt database writes.
**cfo.ai** provides startup runway modeling, unit economics analysis, and pricing optimization. We modeled MCP Guard as a high-margin B2B Developer Infrastructure SaaS:
- **High Gross Margins (>92%)**: Analysis runs execute in-memory; Groq Llama 3 inference costs less than $0.0002 per synthesized fix.
- **Natural Tiered Upsell**: Free open-core CLI for solo devs ➔ $49/mo Pro for teams needing CI/CD and neatlogs traces ➔ $299/mo Enterprise for dedicated sandboxes.
- **Low Capital Intensity**: Reaches cash-flow positive in Month 11 with only $200k in initial angel funding.

### 📐 Deliverables
- [x] Full business plan written: `BUSINESS_PLAN.md`
- [x] Pricing architecture: Developer ($0), Team ($49/mo), Enterprise ($299/mo + usage)
- [x] Unit economics breakdown: Blended COGS of ~$0.00030 per analysis run
- [x] 18-month financial forecast: Growing to $127K MRR ($1.53M ARR) by Month 18
- [x] Ready to import directly into the `cfo.ai/neathacks` dashboard

