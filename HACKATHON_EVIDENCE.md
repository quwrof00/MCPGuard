# MCPGuard — neatHack Evidence Guide

This file separates evidence already present in the repository from evidence that must be captured during a live run. No trace URL, checkpoint, or cfo.ai scenario is claimed until a judge can open it.

## Agent outcome

MCPGuard completes a closed recovery loop for an MCP server update:

1. Inspect baseline and candidate tool contracts.
2. Classify breaking changes and identify dependent workflows.
3. Replay workflows against the candidate.
4. Select a repair path: deterministic migration rule first, then Groq only when no rule matches.
5. Verify the repair in isolation and replay the downstream workflow.
6. Return the recovery result with observability evidence.

The live UI is `/test`: `/api/analyze` runs the audit, `/api/verify-fix` runs two-stage recovery verification, and `/api/ai-fix` runs the explicitly labeled non-deterministic fallback scenario.

## neatlogs evidence

When `NEATLOGS_API_KEY` is configured, live requests emit these spans:

| Run | Span | Proof |
|---|---|---|
| Full audit | `mcp-compatibility-analysis` (`WORKFLOW`) | Inspection, replay, and failure detection ran. |
| Repair | `mcp-verify-fix` (`GUARDRAIL`) | Isolated repair plus downstream replay were verified. |
| AI fallback | `mcp-ai-fallback` (`AGENT`) | No deterministic rule was selected. |
| Groq call | `groq-schema-migration` (`AGENT`) | `llama-3.1-8b-instant` executed the fallback. |

`groq-schema-migration` records the tool name, argument keys, and schema-change count; it does not export full argument values.

### Capture before submitting

1. Run **Run audit** in `/test`; save the `mcp-compatibility-analysis` trace.
2. Verify a suggested deterministic fix; save its `mcp-verify-fix` trace as recovery evidence.
3. Run **Run AI-assisted fix**; save the `mcp-ai-fallback` trace and nested `groq-schema-migration` span.
4. Include status, duration, and model cost/tokens (where available) in the demo—never API keys or customer payloads.

## Entire evidence

[ENTIRE_CONTEXT.md](./ENTIRE_CONTEXT.md) is the checked-in Entire/entire-graph topology and impact artifact. `.entire/settings.json` configures Git-ref checkpoints.

On a machine with Entire installed, refresh the evidence with:

```powershell
entire graph index --profile full
entire graph snapshot
entire graph impact analyzeUpdate --exclude-tests
```

Commit the resulting checkpoint and include the checkpoint reference and graph output in the demo. This repository does not claim a new checkpoint until that command has actually run.

## cfo.ai evidence

[BUSINESS_PLAN.md](./BUSINESS_PLAN.md) is the source narrative for pricing, COGS, revenue, runway, and break-even. Before submission, attach the shareable cfo.ai scenario or exported PDF and show those views in the demo. A Markdown business plan is not a replacement for the cfo.ai artifact.

## Team-owned submission evidence

- Public repository with hackathon-period commits.
- Demo video of three minutes or less that covers runtime, neatlogs, Entire, and cfo.ai.
- Submission post and #neatHack build-in-public links.
