# MCP Guard 🛡️

> Prevent AI agents from breaking when tool providers update their MCP servers.

**MCP Guard** is an automated testing and contract validation tool for the Model Context Protocol (MCP). It tests existing agent workflows against tool updates, identifies what breaks, and flags breaking schema changes before tool updates reach production.

---

## 📚 Documentation

- **[Project Overview & Architecture](file:///d:/mcpguard/PROJECT_OVERVIEW.md)**: Deep dive into the purpose of MCP Guard, how it works, and everything built so far.
- **[Hackathon MVP Status & What's Left](file:///d:/mcpguard/WHAT_IS_LEFT.md)**: Gap analysis against the vision, roadmap, and remaining tasks to 100% completion.
- **[Implementation Roadmap & TODOS](file:///d:/mcpguard/TODOS.md)**: Detailed code guides and previous milestones.

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
