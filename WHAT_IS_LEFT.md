# MCP Guard — Hackathon MVP Status & What's Left to Do

## 🎯 Have We Reached the Hackathon MVP?

**Short answer: We are ~65% of the way there.**

The **core mechanical foundation** is completely built and working:
- Two MCP server versions (V1 baseline and V2 candidate) are running.
- In-memory client transports connect and inspect schemas at the protocol level.
- Semantic schema comparison detects parameter renames, type changes, and removals.
- Workflow replay tests against both versions and captures live execution errors.
- The web dashboard and Next.js API trigger the analysis and display live results.

### What is Missing?
The main feature that sets MCP Guard apart from a standard schema linter is **AI-driven diagnostics and fix verification**:
1. **AI Explanation & Fix Suggester** (Pillar 5): An LLM analyzing the diff + runtime error to explain *why* it failed and provide an exact patch for the workflow.
2. **Fix Verification Loop** (Pillar 6): Rerunning the patched workflow against Candidate V2 to prove the fix works.
3. **Multiple Saved Agent Workflows** (MVP Spec): Currently only 1 workflow is hardcoded (`issue_id: "42"`). We need a realistic suite of 3–4 workflows (some breaking, some unaffected).
4. **Dependency Tracing** (Pillar 2): Mapping which workflows depend on which tools.

---

## 📊 Feature Scorecard vs. Vision

| # | Vision Pillar / MVP Requirement | Status | What Exists Today | What's Left to Do |
|---|----------------------------------|:------:|-------------------|-------------------|
| **1** | **Detect Changes (Schema Diff)** | ✅ **Done** | `schema-diff.ts` detects renames, type changes, removals, and required flags. | None. Core diffing is complete and tested. |
| **2** | **Trace Dependencies** | 🟡 **Partial** | Hardcoded workflow calls `get_issue`. | Create a workflow registry that maps workflows to tool dependencies. |
| **3** | **Replay Workflows** | ✅ **Done** | `runWorkflow` in `analyze.ts` executes tool calls against V1 & V2 and records pass/fail. | Expand to support a list of multiple distinct workflows. |
| **4** | **Explain Failures** | 🟡 **Partial** | Raw tool error messages are returned in `workflow.message`. | Structure failure diagnostics: exact tool, failed payload, and root cause explanation. |
| **5** | **Suggest Fixes (AI Agent)** | ❌ **To Do** | Not yet implemented. | Add an AI fixer module (e.g. Gemini / OpenAI API or intelligent rule synthesizer) that outputs the exact patched payload. |
| **6** | **Verify Fixes** | ❌ **To Do** | Not yet implemented. | Rerun the candidate server with the patched payload to confirm `status === "passed"`. |
| **7** | **Report Results (Dashboard)** | 🟡 **80% Done** | Clean dark-mode UI with stats cards, schema diffs, and replay outcomes. | Add "AI Diagnosis & Suggested Fix" card and an interactive "Verify Fix" button. |

---

## 🛠️ Step-by-Step Implementation Roadmap

To reach 100% of the Hackathon MVP, here are the remaining tasks in priority order:

---

### Task 1: Expand Saved Workflows & Server Tools
**Why**: A real demo needs contrast: some workflows break, while others remain intact.

1. **Add more tools to `src/servers.ts`**:
   - `get_issue` (Breaking: `issue_id: string` → `issue_number: number`)
   - `search_issues` (Breaking: new required param `query` added)
   - `get_user` (Non-breaking: unchanged between V1 and V2)
2. **Create a Workflow Store (`src/lib/workflows/store.ts`)**:
   - Workflow A: *"Triage incoming issue"* (uses `get_issue` → will **fail** on V2)
   - Workflow B: *"Find open PRs"* (uses `search_issues` → will **fail** on V2)
   - Workflow C: *"Fetch author profile"* (uses `get_user` → will **pass** on both)

---

### Task 2: Dependency Tracing (`src/lib/engine/tracer.ts`)
**Why**: Before running replays, map which workflows are actually at risk based on schema diffs.

- Scan saved workflows to see which tools they invoke.
- Flag workflows as:
  - 🔴 **Impacted (At Risk)**: Relies on a tool with breaking schema changes.
  - 🟢 **Safe**: Relies only on unchanged or non-breaking tools.

---

### Task 3: AI Explanation & Fix Suggester (`src/lib/engine/ai-fixer.ts`)
**Why**: This is the "killer feature" of the demo.

Given:
- The original workflow payload: `{ issue_id: "42" }`
- The schema diff: `issue_id` removed (breaking), `issue_number: number` added (breaking)
- The candidate error: `invalid_type: Expected number, received undefined`

Output:
```json
{
  "explanation": "Tool 'get_issue' renamed parameter 'issue_id' (string) to 'issue_number' (number). The workflow failed because it passed 'issue_id'.",
  "suggestedFix": {
    "issue_number": 42
  },
  "fixSummary": "Rename argument 'issue_id' to 'issue_number' and cast string '42' to number 42."
}
```

*Implementation options*:
- Call Google Gemini / OpenAI via API key.
- Provide a deterministic fallback engine for offline/local demos so the presentation never fails even if offline.

---

### Task 4: Fix Verification Loop (`src/lib/engine/verify-fix.ts`)
**Why**: Prove that MCP Guard doesn't just guess fixes—it validates them.

- Execute `candidateClient.callTool("get_issue", suggestedFix)`.
- If `isError === false`, mark fix as **"VERIFIED WORKING"**.
- Return the before-and-after proof in the report.

---

### Task 5: Enhance the Dashboard (`src/app/page.tsx`)
**Why**: Visual presentation for judges and users.

Add two new sections to the existing dashboard:
1. **AI Diagnosis & Fix Recommendation Card**:
   - Shows diff: `{ - issue_id: "42", + issue_number: 42 }`
   - Shows AI explanation of what broke and why.
2. **"Verify Fix" Badge / Action**:
   - Shows a green checkmark: *"Fix verified against Candidate V2 — Replay Passed"*.
3. **Workflow Filter**:
   - Tab or filter between All Workflows, Failed Workflows, and Passing Workflows.

---

## ⏱️ Estimated Time to Completion

| Task | Scope | Estimated Effort |
|---|---|:---:|
| **Task 1: Multi-Workflow Store & Server expansion** | Minor code addition | ~20 mins |
| **Task 2: Dependency Tracer** | Small utility function | ~15 mins |
| **Task 3: AI Fix Suggester (with Gemini/fallback)** | Core new feature | ~30 mins |
| **Task 4: Fix Verification Replayer** | Replay runner extension | ~15 mins |
| **Task 5: Dashboard UI Cards for Fixes** | React component update | ~25 mins |
| **Total to reach 100% Hackathon MVP** | | **~1.5 – 2 hours** |

---

## 🏆 Current Summary

You have already built the hardest parts of the low-level infrastructure:
- Real MCP SDK protocol handling
- In-memory transports
- Tool inspection
- AST-level schema diffing
- End-to-end Vitest test suite (100% passing)
- Full-stack Next.js 16 app with API route and reactive UI

All that remains is connecting the **AI explanation + fix verification** layers and expanding the workflow dataset to deliver the full hackathon presentation vision.
