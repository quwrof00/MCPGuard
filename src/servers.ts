import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createV1Server() {
    const server = new McpServer({
        name: "github-mock",
        version: "1.0.0",
    });

    server.registerTool(
        "get_issue",
        {
            description: "Fetch a GitHub issue",
            inputSchema: {
                issue_id: z.string(),
            },
        },
        async ({ issue_id }) => ({
            content: [
                {
                    type: "text" as const,
                    text: `Successfully fetched issue ${issue_id}`,
                },
            ],
        }),
    );

    return server;
}

export function createV2Server() {
    const server = new McpServer({
        name: "github-mock",
        version: "2.0.0",
    });

    server.registerTool(
        "get_issue",
        {
            description: "Fetch a GitHub issue",
            inputSchema: {
                issue_number: z.number(),
            },
        },
        async ({ issue_number }) => ({
            content: [
                {
                    type: "text" as const,
                    text: `Successfully fetched issue ${issue_number}`,
                },
            ],
        }),
    );

    return server;
}