# MCPGuard — Collaborator Guide & Architecture Reference

This document provides a complete technical handover for collaborators, detailing everything built in **MCPGuard**, the underlying system design, and a step-by-step user and developer guide.

---

## 1. Executive Context

### The Problem: Silent Tool Drift in Agent Systems
AI agents rely on **Model Context Protocol (MCP)** tools (e.g., GitHub, PostgreSQL, Slack, Filesystem) to execute actions. When an MCP tool provider updates their server (e.g., renaming `issue_id` to `issue_number: number`, tightening parameter types, or adding required fields), agent prompts and orchestration pipelines break silently in production. 

A single failure at Step 1 starves downstream tools of outputs, halting the entire multi-step agent chain.

### The Solution: MCPGuard
**MCPGuard** is an automated regression testing and fix synthesis engine for MCP tool updates:
1. **Detects breaking schema mutations** via structural AST/JSON schema diffing.
2. **Traces chained blast radius** by simulating multi-step agent workflows.
3. **Synthesizes migration fixes** using a deterministic rule engine with a silent LLM fallback (`llama-3.1-8b-instant` via Groq).
4. **Executes Two-Stage Verification**:
   - **Stage 1 (Unit Tool Isolation):** Verifies the single tool call against the Candidate V2 server.
   - **Stage 2 (Agent Chain Replay):** Verifies that downstream dependent steps unblock end-to-end.
5. **Interactive Parameter Sandbox:** Live form inputs that allow developers to test arbitrary payloads and observe instant MCP server responses (~2ms).

---

## 2. System Architecture & Directory Map

```
d:\mcpguard\
├── src\
│   ├── app\
│   │   ├── api\
│   │   │   ├── analyze\route.ts       # POST /api/analyze (Full audit pipeline)
│   │   │   ├── verify-fix\route.ts    # POST /api/verify-fix (Two-stage verification)
│   │   │   └── test-tool\route.ts     # POST /api/test-tool (Lightweight single-tool execution)
│   │   ├── globals.css                # Dark theme tokens, scanline loader, animations
│   │   ├── layout.tsx                 # Root layout & metadata
│   │   └── page.tsx                   # Interactive audit console dashboard
│   ├── lib\
│   │   ├── engine\
│   │   │   ├── connect-server.ts      # In-memory MCP transport connector (zero network overhead)
│   │   │   ├── inspect-server.ts      # Protocol-level tool capability inspector
│   │   │   ├── schema-diff.ts         # Structural JSON schema diff engine & severity classifier
│   │   │   ├── tracer.ts              # Agent workflow dependency graph & blast radius tracer
│   │   │   ├── fixer.ts               # Two-tier fix synthesis engine (Rules + LLM Fallback)
│   │   │   ├── llm.ts                 # Groq SDK client (llama-3.1-8b-instant fallback)
│   │   │   └── analyze.ts             # Central analysis orchestrator & two-stage verifier
│   │   └── workflows\
│   │       └── store.ts               # Saved multi-step agent workflows (contracts)
│   └── servers.ts                     # Mock MCP Server implementations (V1 baseline & V2 candidate)
├── tests\
│   ├── schema-diff.test.ts            # Unit tests for schema diffing
│   ├── inspect-server.test.ts         # Protocol inspection tests
│   ├── guard.test.ts                  # In-memory transport & candidate failure tests
│   └── analyze.test.ts                # End-to-end chained replay & fix verification tests
├── .env                               # Environment secrets (GROQ_API_KEY)
├── package.json                       # Dependencies & scripts
└── tsconfig.json                      # Path aliases (@/* -> ./src/*)
```

---

## 3. Under-The-Hood Architecture Decisions

### A. Zero-Overhead In-Memory Transports (`connect-server.ts`)
Instead of launching separate child processes, spawning CLI daemons, or making HTTP calls over loopback sockets, MCPGuard connects directly using in-memory transports (`@modelcontextprotocol/sdk`).
- **Speed:** Full server inspection and 6 multi-step workflow replays execute in **< 150ms**.
- **Isolation:** No port conflicts, no lingering background processes, no mock network servers.

### B. Two-Tier Fix Synthesis Engine (`fixer.ts` + `llm.ts`)
1. **Tier 1 (Rule-First Engine - Deterministic, High Confidence):**
   - **Parameter Renaming:** Matches deleted and added keys using naming heuristics (e.g., `issue_id` -> `issue_number`) and coerces values (e.g., `"42"` -> `42`).
   - **Type Coercion:** Detects parameter type tightenings (e.g., string to number, boolean) and safely coerces values without data loss.
   - **Required Parameter Injection:** Injects safe defaults when new non-optional parameters are introduced.
2. **Tier 2 (LLM Fallback - LLaMA 3.1 8B Instant via Groq, Medium Confidence):**
   - Invoked **only** when deterministic rules encounter unmapped or ambiguous semantic diffs.
   - Prompts `llama-3.1-8b-instant` in zero-shot strict JSON mode.
   - **Silent Fail:** Fails silently to `null` if Groq is unreachable or `GROQ_API_KEY` is not configured, ensuring the deterministic path is never blocked.

### C. Two-Stage Verification Pipeline (`analyze.ts`)
When verifying a fix or testing custom user parameters:
- **Stage 1 (Unit Tool Isolation):** Calls the candidate server directly with the modified payload. Checks `isError`, measures latency, and returns the formatted JSON response from the server.
- **Stage 2 (Downstream Agent Chain Replay):** Injects the output of Step 1 into the target workflow and executes subsequent chained steps to verify that downstream starvation is resolved.

---

## 4. API Reference

### `POST /api/analyze`
Runs full baseline vs. candidate schema diffing, replays all registered agent workflows, traces blast radii, and synthesizes migration fixes.
* **Request:** Empty POST
* **Response:**
  ```json
  {
    "summary": {
      "total": 6,
      "passed": 4,
      "failed": 2,
      "breakingChanges": 4,
      "impactedWorkflowsCount": 2
    },
    "changes": [ ...schema diff objects... ],
    "workflows": [ ...workflow execution traces... ],
    "suggestedFixes": [ ...synthesized migration fixes... ]
  }
  ```

### `POST /api/verify-fix`
Executes two-stage verification for a specific workflow step.
* **Request:**
  ```json
  {
    "workflowId": "wf-triage-issue",
    "stepId": "step-1",
    "fixedArgs": { "issue_number": 42 },
    "stepOverrides": { "step-1": { "issue_number": 42 }, "step-3": { "issue_number": 42 } }
  }
  ```
* **Response:**
  ```json
  {
    "verified": true,
    "stepPassed": true,
    "message": "Two-stage verification passed: Step 'get_issue' passed in isolation, and all 3/3 steps completed end-to-end.",
    "stage1": {
      "status": "passed",
      "tool": "get_issue",
      "args": { "issue_number": 42 },
      "output": { "issue_number": 42, "author_id": "usr_octocat", "title": "OAuth token expiration handling" },
      "executionTimeMs": 0.4
    },
    "stage2": {
      "status": "passed",
      "workflowId": "wf-triage-issue",
      "unblockedSteps": 3,
      "totalSteps": 3,
      "stepResults": [ ... ]
    }
  }
  ```

### `POST /api/test-tool`
Lightweight sandbox endpoint to execute an arbitrary single tool call on Candidate V2.
* **Request:**
  ```json
  {
    "tool": "get_issue",
    "args": { "issue_number": 42 }
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "status": "passed",
    "output": { "issue_number": 42, "author_id": "usr_octocat" },
    "executionTimeMs": 1.2
  }
  ```

---

## 5. How-To-Use Guide (Developer Workflows)

### 1. Installation & Environment Setup
Clone the repository and install dependencies:
```bash
npm install
```

Configure your environment variables in `.env`:
```ini
# Optional: Used for Tier 2 fallback fix synthesis
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Starting the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Running the Test Suite
MCPGuard uses **Vitest** for unit and integration testing:
```bash
npx vitest run
```
*Current test suite:* **4 test files, 6/6 tests passing (100%)**.

### 4. Running Type Checks
```bash
npx tsc --noEmit
```

---

## 6. Using the Interactive Dashboard

1. **Sticky Side Navigation Rail:**
   - Use the left sidebar to navigate across sections (`00. Overview`, `01. Pipeline Spec`, `02. Guarantees`, `03. Failure Taxonomy`, `04. Integrations`, `05. Live Audit`).
   - The active section highlights dynamically via scroll-spy.
   - Click **"Execute Audit"** in the sidebar from any section to re-run compatibility tests.
2. **Section 03 (Failure Taxonomy Playground):**
   - Click any failure mode from the vertical master list (`Parameter Renaming`, `Type Coercion Mutation`, `Chained Dependency Starvation`, etc.).
   - Edit arguments directly in the **Interactive Parameter Form**.
   - Click **"Test Payload on Candidate V2"** to execute the call in ~2ms.
   - Click **"Load Broken V1"** to watch the V2 server reject the call with real Zod validation errors.
3. **Section 05 (Live Audit & Two-Stage Verification):**
   - Pre-loaded automatically on page load.
   - Review synthesized migration diffs.
   - Type custom values into the **Interactive Parameter Sandbox**.
   - Click **"Run Two-Stage Verification"** to see Stage 1 (isolated execution) and Stage 2 (pipeline unblocking).

---

## 7. How to Extend MCPGuard

### Adding a New Saved Agent Workflow
Open [src/lib/workflows/store.ts](file:///d:/mcpguard/src/lib/workflows/store.ts) and append to `SAVED_WORKFLOWS`:
```ts
{
  id: "wf-my-agent-flow",
  name: "Custom Agent Workflow",
  description: "Runs tool A and pipes output to tool B",
  tags: ["custom", "production"],
  steps: [
    {
      id: "step-1",
      tool: "my_first_tool",
      description: "Initial action",
      args: { query: "search terms" },
    },
    {
      id: "step-2",
      tool: "my_second_tool",
      description: "Follow-up action using step 1 result",
      args: {},
      fromPrevious: {
        stepId: "step-1",
        sourceKey: "result_id",
        targetKey: "id",
      },
    },
  ],
}
```

### Adding a New Deterministic Fix Rule
Open [src/lib/engine/fixer.ts](file:///d:/mcpguard/src/lib/engine/fixer.ts) and add your rule in `synthesizeFix`:
```ts
// Example: Detect and map deprecated boolean flags
if (deprecatedFlagCondition) {
  fixedArgs["new_boolean_flag"] = true;
  mutated = true;
  ruleApplied = "deprecated_flag_migration";
  explanations.push("Migrated deprecated flag to V2 counterpart.");
  diffs.push(`+ "new_boolean_flag": true`);
}
```

---

## 8. Impeccable Design & Code Standards

* **Typography & Palette:** Strict monochromatic dark palette (`#09090b` background, `#121215` elevated panels, `#27272a` borders), high contrast text (`#fafafa` / `#a1a1aa`), monospace font tokens for data.
* **Zero Emojis:** Prohibited across all UI copy and mock data payloads to eliminate generic "AI slop" heuristics.
* **Zero Horizontal Scroll:** All tables and lists wrap responsively or use vertical master-detail layouts.
* **Zero External Network Overhead:** Analysis and mock tests run 100% in-memory with zero network round-trips.
