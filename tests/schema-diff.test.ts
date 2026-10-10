
import { describe, it, expect } from "vitest";
import { compareTools } from "../src/lib/engine/schema-diff.js";

const oldTools = [
    {
        name: "get_issue",
        inputSchema: {
            properties: {
                issue_id: { type: "string" },
            },
            required: ["issue_id"],
        },
    },
];

describe("compareTools", () => {
    it("detects a renamed required parameter", () => {
        const newTools = [
            {
                name: "get_issue",
                inputSchema: {
                    properties: {
                        issue_number: { type: "number" },
                    },
                    required: ["issue_number"],
                },
            },
        ];

        const changes = compareTools(oldTools, newTools);

        expect(changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: "parameter_removed",
                    parameter: "issue_id",
                    severity: "breaking",
                }),
                expect.objectContaining({
                    kind: "parameter_added",
                    parameter: "issue_number",
                    severity: "breaking",
                }),
            ]),
        );
    });

    it("allows a new optional parameter", () => {
        const newTools = [
            {
                name: "get_issue",
                inputSchema: {
                    properties: {
                        issue_id: { type: "string" },
                        include_comments: { type: "boolean" },
                    },
                    required: ["issue_id"],
                },
            },
        ];

        const changes = compareTools(oldTools, newTools);

        expect(changes).toEqual([
            expect.objectContaining({
                kind: "parameter_added",
                parameter: "include_comments",
                severity: "non-breaking",
            }),
        ]);
    });
});
