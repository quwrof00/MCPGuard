# MCPGuard

> Prevent AI agents from breaking when tool providers update their MCP servers.

**MCPGuard** is an automated regression testing and contract validation tool for the Model Context Protocol (MCP). It tests existing agent workflows against tool updates, identifies what breaks, and flags breaking schema changes before tool updates reach production.

---

## Documentation

- **[Collaborator Guide & Architecture Reference](file:///d:/mcpguard/COLLABORATOR_GUIDE.md)**: Complete technical handover, system design decisions, API reference, and developer how-to-use walkthrough.
- **[Project Overview & Architecture](file:///d:/mcpguard/PROJECT_OVERVIEW.md)**: Deep dive into the purpose of MCPGuard, how it works, and core concepts.
- **[Hackathon MVP Status & What's Left](file:///d:/mcpguard/WHAT_IS_LEFT.md)**: Feature scorecard and implementation details.

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
