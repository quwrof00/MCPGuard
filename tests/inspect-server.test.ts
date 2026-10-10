
import { describe, it, expect } from "vitest";
import { createV1Server, createV2Server } from "../src/servers.js";
import { connectToServer } from "../src/lib/engine/connect-server.js";
import { inspectServer } from "../src/lib/engine/inspect-server.js";
import { compareTools } from "../src/lib/engine/schema-diff.js";

describe("MCP server inspection", () => {
    it("compares actual tool schemas from both versions", async () => {
        const oldConnection = await connectToServer(createV1Server());
        const newConnection = await connectToServer(createV2Server());

        try {
            const oldTools = await inspectServer(oldConnection.client);
            const newTools = await inspectServer(newConnection.client);

            const changes = compareTools(oldTools, newTools);

            expect(changes).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        tool: "get_issue",
                        kind: "parameter_removed",
                        parameter: "issue_id",
                        severity: "breaking",
                    }),
                    expect.objectContaining({
                        tool: "get_issue",
                        kind: "parameter_added",
                        parameter: "issue_number",
                        severity: "breaking",
                    }),
                ]),
            );
        } finally {
            await oldConnection.client.close();
            await oldConnection.server.close();
            await newConnection.client.close();
            await newConnection.server.close();
        }
    });
});
