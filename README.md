# MCPGuard

> Prevent AI agents from breaking when tool providers update their MCP servers.

**MCPGuard** is an automated regression testing and contract validation tool for the Model Context Protocol (MCP). It tests existing agent workflows against tool updates, identifies what breaks, and flags breaking schema changes before tool updates reach production.

---

## Documentation

- **[Collaborator Guide & Architecture Reference](COLLABORATOR_GUIDE.md)**: Technical handover, system design, API reference, and developer walkthrough.
- **[Project Overview](PROJECT_OVERVIEW.md)**: What MCP Guard does, the pipeline, and where each module lives.
- **[Hackathon MVP Status](WHAT_IS_LEFT.md)**: Feature scorecard. The hackathon checklist is complete.
- **[Implementation Roadmap](TODOS.md)**: Engine, dashboard, neatlogs, Entire, and the cfo.ai model.
- **[entire-graph topology](ENTIRE_CONTEXT.md)**: Import graph, blast radius, and workflow-to-tool edges.

---

## ⚡ Quick Start

### Running Tests
The project uses [Vitest](https://vitest.dev/) for unit and integration testing:

```bash
npm test
# or
npx vitest run
```

### Existing Modules
- [servers.ts](file:///d:/mcpguard/src/servers.ts): Mock GitHub MCP server versions (v1 and v2).
- [connect-server.ts](file:///d:/mcpguard/src/lib/engine/connect-server.ts): In-memory client/server connector.
- [inspect-server.ts](file:///d:/mcpguard/src/lib/engine/inspect-server.ts): Tool capability inspector.
- [schema-diff.ts](file:///d:/mcpguard/src/lib/engine/schema-diff.ts): Semantic JSON Schema diffing & severity classifier.
