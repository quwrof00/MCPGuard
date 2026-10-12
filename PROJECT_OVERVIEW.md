# MCPGuard Project Overview

MCPGuard is a contract-regression and recovery system for Model Context Protocol servers. It helps teams evaluate a tool-server update before agent workflows are exposed to it.

## The recovery loop

```text
Baseline + candidate MCP contracts
  -> inspect and schema diff
  -> trace affected workflows
  -> replay baseline and candidate workflows
  -> synthesize a repair
  -> verify the repair in isolation
  -> replay the complete workflow
```

The engine is designed around one failure mode: an upstream MCP input contract changes, the first agent tool call fails, and downstream steps lose the output they need. MCPGuard shows where that failure starts and tests whether a repair restores the chain.

## Runtime surfaces

| Route | Runtime behavior |
|---|---|
| `/` | Product overview and integration status. |
| `/test` | Interactive payload testing, audit execution, repair verification, AI fallback, and recovery-evidence capture. |
| `/api/analyze` | Full contract audit and workflow replay. |
| `/api/test-tool` | One candidate tool call using an editable JSON payload. |
| `/api/verify-fix` | Two-stage verification: isolated call followed by downstream replay. |
| `/api/ai-fix` | Controlled non-deterministic migration case using the Groq fallback. |
| `/api/evidence-run` | One end-to-end failure-and-recovery demonstration. |

## Core modules

| Module | Responsibility |
|---|---|
| `src/servers.ts` | In-process baseline and candidate MCP fixtures used for isolated compatibility demonstrations. |
| `src/lib/engine/inspect-server.ts` | Normalizes server tool definitions returned by `listTools`. |
| `src/lib/engine/schema-diff.ts` | Classifies removed tools/parameters, type shifts, and required-field changes. |
| `src/lib/engine/tracer.ts` | Maps breaking changes to saved workflow dependencies. |
| `src/lib/engine/analyze.ts` | Coordinates auditing, replay, repair verification, and recovery reporting. |
| `src/lib/engine/fixer.ts` | Applies deterministic parameter migration rules and calls the fallback only when required. |
| `src/lib/engine/llm.ts` | Calls Groq `llama-3.1-8b-instant` for non-deterministic migrations. |
| `src/lib/telemetry.ts` | Initializes, wraps, and flushes neatlogs traces. |

## Integration evidence

- **neatlogs:** audit, verification, fallback, and recovery evidence routes emit named spans.
- **Entire:** [ENTIRE_CONTEXT.md](ENTIRE_CONTEXT.md) records graph topology, capability evidence, and current impact analysis.
- **cfo.ai:** [BUSINESS_PLAN.md](BUSINESS_PLAN.md) contains the pricing, COGS, revenue, and runway inputs. The final external scenario or PDF is a submission artifact.

For the exact evidence-capture sequence, see [HACKATHON_EVIDENCE.md](HACKATHON_EVIDENCE.md).

## Verification

```bash
npm run build
npm test
```
