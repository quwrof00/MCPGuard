# MCPGuard Collaborator Guide

## Purpose

MCPGuard evaluates MCP server contract updates before they break agent workflows. Its core output is not only a schema diff: it is a tested answer to whether a workflow can recover from that change.

## Repository map

```text
src/
  app/
    page.tsx                         Product page
    test/page.tsx                    Interactive testing workspace
    api/
      analyze/route.ts               Full audit
      test-tool/route.ts             Isolated candidate payload test
      verify-fix/route.ts            Two-stage repair verification
      ai-fix/route.ts                Groq fallback scenario
      evidence-run/route.ts          Failure-to-recovery evidence run
      integrations/route.ts          Safe integration configuration status
  lib/
    engine/                          Contract, replay, repair, and LLM logic
    telemetry.ts                     neatlogs initialization and wrappers
    workflows/store.ts               Saved agent workflow contracts
  servers.ts                         Isolated baseline and candidate MCP fixtures
tests/                               Unit and integration tests
```

## Key behavior

### Audit

`analyzeUpdate()` connects to baseline and candidate servers through the MCP SDK's in-memory transport. It inspects tools, computes schema changes, traces dependent workflows, and replays them against both versions.

### Repair

`synthesizeFix()` is deterministic first. It handles parameter renames, compatible type coercions, and required-field additions. Only unmatched changes proceed to `llmFallbackFix()`, which calls Groq with a constrained JSON response format.

### Verification

`verifyFix()` validates a repair in two stages:

1. Call the changed candidate tool with the repaired payload.
2. Replay the full workflow with that repaired payload injected.

The repair is useful only if the isolated call passes and the downstream workflow is demonstrably unblocked.

## Observability and evidence

All live audit paths use `withTrace()` in `src/lib/telemetry.ts`. The important trace names are documented in [HACKATHON_EVIDENCE.md](HACKATHON_EVIDENCE.md).

The `/test` workspace exposes three evidence paths:

- deterministic audit and suggested migration
- non-deterministic Groq fallback
- one-click failure-to-recovery evidence run

Keep telemetry metadata scoped. Do not add full customer payloads, tokens, or secrets to trace attributes.

## Working safely

- Keep tool testing isolated unless a real external adapter has been intentionally added.
- Preserve the deterministic-first policy; Groq is a fallback, not a replacement for schema rules.
- Update [ENTIRE_CONTEXT.md](ENTIRE_CONTEXT.md) after meaningful dependency changes and verify impact with Entire Graph.
- Update [BUSINESS_PLAN.md](BUSINESS_PLAN.md) when pricing, cost, or revenue assumptions change.
- Never commit `.env` secrets.

## Local commands

```bash
npm run dev
npm run build
npm test
```

For Entire Graph evidence:

```powershell
entire graph impact --repo . --symbol analyzeUpdate --exclude-tests
entire graph impact --repo . --symbol synthesizeFix --file src/lib/engine/fixer.ts --exclude-tests
```

## Further reading

- [Project overview](PROJECT_OVERVIEW.md)
- [Hackathon evidence guide](HACKATHON_EVIDENCE.md)
- [Entire Graph evidence](ENTIRE_CONTEXT.md)
- [Business plan](BUSINESS_PLAN.md)
