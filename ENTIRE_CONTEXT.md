# MCP Guard — entire-graph dependency topology

This map was produced with Entire CLI 0.11.4 and the entire-graph plugin v0.4.0 (`entire graph index --profile full`, `entire graph snapshot`, and `entire graph impact`). The index covers the working tree at commit `5c8699da34789ce838994747b2e88a6aebc037e0`.

Index summary: 37 files parsed, 313 symbols, 686 relations. TypeScript is semantically indexed. `src/app/page.tsx` failed to parse (`E_PARSE_ERROR` on the `"use client"` directive and JSX), so dashboard-internal call edges in that file are partial. HTTP edges from the dashboard to the API routes were still recovered.

## How a compatibility run moves through the repo

```text
page.tsx runAnalysis
  HTTP POST /api/analyze
    POST
      withTrace / flushTelemetry          (src/lib/telemetry.ts -> neatlogs)
      analyzeUpdate                       (src/lib/engine/analyze.ts)
        createV1Server / createV2Server   (src/servers.ts)
        connectToServer                   (src/lib/engine/connect-server.ts)
        inspectServer                     (src/lib/engine/inspect-server.ts)
        compareTools                      (src/lib/engine/schema-diff.ts)
        traceDependencies                 (src/lib/engine/tracer.ts)
          SAVED_WORKFLOWS                 (src/lib/workflows/store.ts)
        runChainedWorkflow
          synthesizeFix                   (src/lib/engine/fixer.ts)
            llmFallbackFix                (src/lib/engine/llm.ts -> groq-sdk)

page.tsx handleVerifyFix
  HTTP POST /api/verify-fix
    verifyFix -> createV2Server, connectToServer, runChainedWorkflow

page.tsx testTaxonomyTool
  HTTP POST /api/test-tool
    connectToServer(createV2Server())
```

## Blast radius of the three core symbols

Queried with `entire graph impact --exclude-tests`.

| Symbol | Defined | Direct callers | What it calls |
|---|---|---|---|
| `analyzeUpdate` | `src/lib/engine/analyze.ts:213` | `POST` in `src/app/api/analyze/route.ts` (async). The dashboard reaches it through `runAnalysis` → `/api/analyze`. | `connectToServer`, `inspectServer`, `compareTools`, `traceDependencies`, `runChainedWorkflow`, `createV1Server`, `createV2Server` |
| `compareTools` | `src/lib/engine/schema-diff.ts:28` | `analyzeUpdate` only, then `/api/analyze` transitively. No callees. | Returns `SchemaChange[]` from `ToolDefinition` inputs |
| `synthesizeFix` | `src/lib/engine/fixer.ts:25` | `runChainedWorkflow`, and through it both `analyzeUpdate` and `verifyFix` | `llmFallbackFix` when no deterministic rule matches |

`analyzeUpdate` also co-changes historically with `package.json`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, and `tsconfig.json`.

## Module import graph

Internal imports only. External packages are listed once at the bottom.

| File | Imports |
|---|---|
| `src/app/api/analyze/route.ts` | `analyze.ts`, `telemetry.ts` |
| `src/app/api/verify-fix/route.ts` | `analyze.ts`, `telemetry.ts` |
| `src/app/api/test-tool/route.ts` | `connect-server.ts`, `servers.ts` |
| `src/app/page.tsx` | `analyze.ts` (types) |
| `src/lib/engine/analyze.ts` | `servers.ts`, `connect-server.ts`, `inspect-server.ts`, `schema-diff.ts`, `tracer.ts`, `fixer.ts`, `workflows/store.ts` |
| `src/lib/engine/fixer.ts` | `schema-diff.ts`, `llm.ts` |
| `src/lib/engine/llm.ts` | `schema-diff.ts` |
| `src/lib/engine/tracer.ts` | `schema-diff.ts`, `workflows/store.ts` |
| `src/lib/engine/inspect-server.ts` | `schema-diff.ts` |
| `tests/analyze.test.ts` | `analyze.ts` |
| `tests/inspect-server.test.ts` | `connect-server.ts`, `inspect-server.ts`, `schema-diff.ts`, `servers.ts` |
| `tests/schema-diff.test.ts` | `schema-diff.ts` |
| `tests/guard.test.ts` | `servers.ts` (builds its own in-memory client) |

`schema-diff.ts` and `workflows/store.ts` are leaves. Every other engine module either calls them or is called because of them.

External packages the graph resolved: `@modelcontextprotocol/sdk` (client, in-memory transport, `McpServer`), `zod` (mock tool schemas), `neatlogs` (`init`, `trace`, `flush`), `groq-sdk`, `next`, `react`, `vitest`.

## Saved workflows and the tools they depend on

These contracts live in `src/lib/workflows/store.ts`. `traceDependencies` flags a workflow when any of its tools has a breaking schema change.

| Workflow | Steps | Breaking on V2 |
|---|---|---|
| `wf-triage-issue` — Triage Issue and Notify Author | `get_issue` → `get_user` (uses `author_id`) → `post_comment` | Yes. `get_issue` and `post_comment` still send `issue_id`. |
| `wf-explore-org` — Explore Organization Repositories | `list_repositories` → `get_user` | No. Both tools are unchanged between V1 and V2. |
| `wf-release-note` — Post Production Release Comment | `post_comment` | Yes. `issue_id` was renamed to `issue_number: number`. |

Mock servers in `src/servers.ts`:

| Tool | V1 (`github-mock` 1.0.0) | V2 (`github-mock` 2.0.0) |
|---|---|---|
| `get_issue` | required `issue_id: string` | required `issue_number: number` |
| `get_user` | required `user_id: string` | unchanged |
| `post_comment` | required `issue_id`, `body` | required `issue_number: number`, `body`; optional `notify_author` |
| `list_repositories` | required `org: string` | unchanged |

## Checkpoint setup

`.entire/settings.json` configures Git-ref checkpoints. This checked-in topology documents an earlier Entire graph run; refresh it with the commands in [HACKATHON_EVIDENCE.md](HACKATHON_EVIDENCE.md) on a machine where the Entire CLI is installed.

Do not claim a new checkpoint until an Entire-generated checkpoint ref exists and can be opened by a judge.
