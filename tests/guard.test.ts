import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
    createV1Server,
    createV2Server,
} from "../src/servers.js";

async function connectClient(
    server: ReturnType<typeof createV1Server>,
) {
    const client = new Client({
        name: "mcp-guard-test",
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

describe("MCP Guard", () => {
    it("detects a workflow broken by a tool update", async () => {
        const oldServer = await connectClient(createV1Server());
        const newServer = await connectClient(createV2Server());

        // This workflow was written for V1.
        const workflowArguments = {
            issue_id: "42",
        };

        const baseline = await oldServer.client.callTool({
            name: "get_issue",
            arguments: workflowArguments,
        });

        const candidate = await newServer.client.callTool({
            name: "get_issue",
            arguments: workflowArguments,
        });

        expect(baseline.isError).not.toBe(true);
        expect(candidate.isError).toBe(true);

        await oldServer.client.close();
        await oldServer.server.close();

        await newServer.client.close();
        await newServer.server.close();
    });
});