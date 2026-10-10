# MCP Guard — Project Overview & Architecture

## 🎯 What is MCP Guard?

**MCP Guard** is an automated testing and contract validation tool designed to prevent AI agents from breaking when the tools they rely on are updated.

Modern AI agents depend heavily on **Model Context Protocol (MCP)** servers to perform real-world actions—such as searching codebases, filing tickets, and executing database queries. When tool providers update their MCP servers (e.g., renaming a parameter, changing data types, or adding required fields), agent workflows break silently in production.

MCP Guard catches these breakages before updates reach production by:
1. **Inspecting tool schemas** across server versions.
2. **Detecting breaking changes** via semantic contract diffing.
3. **Replaying saved agent workflows** against both baseline and candidate servers to verify runtime behavior.
4. **Providing actionable reports** that pinpoint exactly what broke and why.

---

## 💡 The Core Problem: Silent Tool Drift

Consider an autonomous coding agent programmed to fetch GitHub issues.
- **In V1**: The tool is `get_issue` expecting `{ issue_id: "42" }` (a string).
- **In V2**: The tool developer renames the parameter to `{ issue_number: 42 }` (a number).

Because AI prompts and tool configurations expect the V1 schema, the agent fails at runtime with schema validation errors. MCP Guard simulates this exact upgrade path, catches the breaking parameter rename, and verifies that the existing workflow fails on V2 while succeeding on V1.

---

## 🏗️ Architecture & What We've Built So Far

```
┌────────────────────────────────────────────────────────┐
│                      MCP Guard                         │
│                                                        │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │  MCP Server V1   │            │  MCP Server V2   │  │
│  │ (Baseline Mock)  │            │ (Candidate Mock) │  │
│  └────────┬─────────┘            └────────┬─────────┘  │
│           │                               │            │
│           ▼                               ▼            │
│  ┌──────────────────────────────────────────────────┐  │
│  │       In-Memory Client Transports                │  │
│  │       (src/lib/engine/connect-server.ts)         │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│           ┌───────────────┴───────────────┐            │
│           ▼                               ▼            │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │ Tool Inspector   │            │ Workflow Runner  │  │
│  │ (inspect-server) │            │ (Replay Engine)  │  │
│  └────────┬─────────┘            └────────┬─────────┘  │
│           ▼                               │            │
│  ┌──────────────────┐                     │            │
│  │   Schema Diff    │                     │            │
│  │  (schema-diff)   │                     │            │
│  └────────┬─────────┘                     │            │
│           │                               │            │
│           └───────────────┬───────────────┘            │
│                           ▼                            │
│              Unified Analysis Report                   │
└────────────────────────────────────────────────────────┘
```

Here is a breakdown of the existing modules in the codebase:

### 1. Mock MCP Servers (`src/servers.ts`)
Implements two test servers using `@modelcontextprotocol/sdk`:
- **`createV1Server()`**: Exposes `get_issue` with `{ issue_id: z.string() }` (`github-mock` v1.0.0).
- **`createV2Server()`**: Exposes `get_issue` with `{ issue_number: z.number() }` (`github-mock` v2.0.0).
This provides a reproducible testbed for detecting parameter renames and type mutations.

### 2. In-Memory Transport Connector (`src/lib/engine/connect-server.ts`)
- Leverages `InMemoryTransport.createLinkedPair()` to connect MCP clients and servers in-process.
- Avoids spawning subprocesses or listening on network ports, making inspections and tests execute in milliseconds.

### 3. Server Capability Inspector (`src/lib/engine/inspect-server.ts`)
- Calls `client.listTools()` via the standard MCP protocol.
- Extracts tool names, descriptions, and JSON Schema definitions into normalized data structures.

### 4. Semantic Schema Comparator (`src/lib/engine/schema-diff.ts`)
Analyzes differences between tool schemas across versions, classifying changes by severity:
- **`tool_removed`** → **Breaking**
- **`parameter_removed`** → **Breaking** if previously required; **Non-breaking** if optional.
- **`parameter_added`** → **Breaking** if added as required; **Non-breaking** if optional.
- **`type_changed`** → **Breaking**
- **`required_added`** → **Breaking**

### 5. Automated Test Suite (`tests/`)
Built with Vitest, currently 100% passing across 3 suites:
- **`tests/schema-diff.test.ts`**: Verifies schema comparison logic for parameter renames, type changes, and optional additions.
- **`tests/inspect-server.test.ts`**: Verifies end-to-end inspection of live V1 and V2 servers and catches the breaking parameter changes.
- **`tests/guard.test.ts`**: Replays a V1 agent tool call against both V1 (passes) and V2 (fails with schema error), proving the core guard mechanism.

To run the existing test suite:
```bash
npx vitest run
```

---

## 📂 Current Directory Structure

```text
mcpguard/
├── package.json                   # Project scripts and dependencies
├── tsconfig.json                  # TypeScript compiler options
├── src/
│   ├── servers.ts                 # Mock MCP v1 & v2 servers (GitHub tool)
│   └── lib/
│       └── engine/
│           ├── connect-server.ts  # In-memory client-server transport utility
│           ├── inspect-server.ts  # MCP listTools inspector
│           └── schema-diff.ts     # AST / JSON Schema diff & severity classifier
├── tests/
│   ├── guard.test.ts              # Agent workflow replay test
│   ├── inspect-server.test.ts     # Live server inspection integration test
│   └── schema-diff.test.ts        # Schema comparator unit tests
├── TODOS.md                       # Comprehensive implementation plan for next phase
└── PROJECT_OVERVIEW.md            # This document
```

---

## 🚀 What's Next?

Refer to [TODOS.md](file:///d:/mcpguard/TODOS.md) for detailed tasks, architecture, and code templates for the upcoming phase:
1. **`src/lib/engine/analyze.ts`**: Central analysis orchestrator producing unified reports.
2. **`src/app/api/analyze/route.ts`**: Next.js API route exposing analysis runs over HTTP.
3. **`src/app/page.tsx`**: Interactive dashboard for viewing breaking changes and workflow replay status.
