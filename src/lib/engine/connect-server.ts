
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function connectToServer(server: McpServer) {
    const client = new Client({
        name: "mcp-guard",
        version: "1.0.0",
    });

    const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();

    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);

    return { client, server };
}
