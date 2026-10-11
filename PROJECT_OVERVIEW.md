# MCP Guard — Project Overview

**MCP Guard** catches agent breakages before an MCP tool update ships. It diffs the baseline and candidate tool schemas, replays saved multi-step workflows against both servers, explains the failed step, and proposes a payload migration a person can apply and re-run.

Agents call MCP servers for real actions. A rename or a type change (`issue_id: string` to `issue_number: number`) fails the first step and starves every step after it. MCP Guard runs that upgrade against the workflows already saved in the repo.

## Pipeline

```text
Dashboard (src/app/page.tsx)
    │  POST /api/analyze          POST /api/verify-fix         POST /api/test-tool
    ▼
API routes (traced with neatlogs)
    │
    ▼
analyzeUpdate / verifyFix                         src/lib/engine/analyze.ts
    ├── createV1Server / createV2Server           src/servers.ts
    ├── connectToServer                           in-memory MCP transport
    ├── inspectServer                             listTools
    ├── compareTools                              breaking vs non-breaking
    ├── traceDependencies                         which workflows use a changed tool
    └── runChainedWorkflow
            └── synthesizeFix                     rules, then Groq if no rule matches
```

One analysis run inspects both mock servers, diffs their tools, traces blast radius, and replays every saved workflow on the baseline and on the candidate. If a step fails, later steps in that chain are skipped. Fix verification is two stages: the edited payload is called alone on V2, then the full workflow is replayed with that payload injected.

## Modules

### Mock servers — `src/servers.ts`

`createV1Server()` and `createV2Server()` are in-process `github-mock` servers (1.0.0 and 2.0.0). V2 renames `issue_id` to `issue_number: number` on `get_issue` and `post_comment`, and adds optional `notify_author` on `post_comment`. `get_user` and `list_repositories` stay the same, so one workflow stays green on purpose.

### Engine — `src/lib/engine/`

| Module | Role |
|---|---|
| `connect-server.ts` | Links a client and server with `InMemoryTransport`. No ports and no child processes. |
| `inspect-server.ts` | Calls `listTools` and normalizes name, description, and JSON Schema. |
| `schema-diff.ts` | Classifies `tool_removed`, `parameter_removed`, `parameter_added`, `type_changed`, and `required_added` as breaking or non-breaking. |
| `tracer.ts` | Marks a saved workflow at risk when any of its tools has a breaking change. |
| `fixer.ts` | Rewrites arguments for renames, type coercions, and newly required fields. High confidence when a rule matches. |
| `llm.ts` | Groq `llama-3.1-8b-instant` fallback. Returns nothing if `GROQ_API_KEY` is missing or the call fails. |
| `analyze.ts` | `analyzeUpdate()` builds the report. `verifyFix()` runs the two-stage check. |

### Workflows — `src/lib/workflows/store.ts`

Three saved contracts: triage (`get_issue` → `get_user` → `post_comment`), org explore (`list_repositories` → `get_user`), and a release comment (`post_comment`). The first and third break on V2. The second does not.

### HTTP and UI

- `POST /api/analyze` — full report: summary, schema changes, workflow traces, suggested fixes. Wrapped in a neatlogs `WORKFLOW` span.
- `POST /api/verify-fix` — two-stage verification. Wrapped in a `GUARDRAIL` span.
- `POST /api/test-tool` — one tool call on the V2 server for the failure-taxonomy sandbox.
- `src/app/page.tsx` — dashboard sections: overview, pipeline, benchmarks, failure taxonomy, integration snippets, and the live audit with apply-and-verify.

Telemetry lives in `src/lib/telemetry.ts`. Without `NEATLOGS_API_KEY` it initializes neatlogs with export disabled, so local runs still finish.

## Repository layout

```text
mcpguard/
├── src/
│   ├── servers.ts
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/{analyze,verify-fix,test-tool}/route.ts
│   └── lib/
│       ├── telemetry.ts
│       ├── engine/
│       │   ├── analyze.ts
│       │   ├── connect-server.ts
│       │   ├── inspect-server.ts
│       │   ├── schema-diff.ts
│       │   ├── tracer.ts
│       │   ├── fixer.ts
│       │   └── llm.ts
│       └── workflows/store.ts
├── tests/
│   ├── schema-diff.test.ts
│   ├── inspect-server.test.ts
│   ├── guard.test.ts
│   └── analyze.test.ts
├── PROJECT_OVERVIEW.md
├── TODOS.md
├── WHAT_IS_LEFT.md
├── ENTIRE_CONTEXT.md
├── COLLABORATOR_GUIDE.md
└── BUSINESS_PLAN.md
```

## Tests

`npx vitest run` — 4 files, 6 tests, all passing:

- schema comparator
- live inspection of V1 and V2
- in-memory transport, baseline pass, candidate failure
- chained replay, failure diagnostics, and fix verification

## Sponsor integrations

| Integration | Where it lives |
|---|---|
| neatlogs | `src/lib/telemetry.ts`, analyze and verify-fix routes |
| Entire CLI + entire-graph | Git and Cursor hooks, [ENTIRE_CONTEXT.md](ENTIRE_CONTEXT.md) |
| cfo.ai model | [BUSINESS_PLAN.md](BUSINESS_PLAN.md) |

The dependency map, blast radius, and workflow-to-tool edges are in [ENTIRE_CONTEXT.md](ENTIRE_CONTEXT.md). Implementation status is in [WHAT_IS_LEFT.md](WHAT_IS_LEFT.md). The roadmap checkboxes are in [TODOS.md](TODOS.md).
