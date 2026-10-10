
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ToolDefinition } from "./schema-diff.js";

export async function inspectServer(client: Client) {
    const result = await client.listTools();

    return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as ToolDefinition["inputSchema"],
    }));
}
