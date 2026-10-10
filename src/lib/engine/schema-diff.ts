
export type ToolDefinition = {
    name: string;
    description?: string;
    inputSchema: {
        properties?: Record<string, {
            type?: string;
            description?: string;
        }>;
        required?: string[];
    };
};

export type SchemaChange = {
    tool: string;
    kind:
    | "tool_removed"
    | "parameter_removed"
    | "parameter_added"
    | "type_changed"
    | "required_added";
    parameter?: string;
    before?: string;
    after?: string;
    severity: "breaking" | "non-breaking";
};

export function compareTools(
    oldTools: ToolDefinition[],
    newTools: ToolDefinition[],
): SchemaChange[] {
    const changes: SchemaChange[] = [];

    const newByName = new Map(
        newTools.map((tool) => [tool.name, tool]),
    );

    for (const oldTool of oldTools) {
        const newTool = newByName.get(oldTool.name);

        if (!newTool) {
            changes.push({
                tool: oldTool.name,
                kind: "tool_removed",
                severity: "breaking",
            });
            continue;
        }

        const oldProperties = oldTool.inputSchema.properties ?? {};
        const newProperties = newTool.inputSchema.properties ?? {};

        const oldRequired = new Set(
            oldTool.inputSchema.required ?? [],
        );
        const newRequired = new Set(
            newTool.inputSchema.required ?? [],
        );

        for (const [parameter, oldProperty] of Object.entries(
            oldProperties,
        )) {
            const newProperty = newProperties[parameter];

            if (!newProperty) {
                changes.push({
                    tool: oldTool.name,
                    kind: "parameter_removed",
                    parameter,
                    before: oldProperty.type,
                    severity: oldRequired.has(parameter)
                        ? "breaking"
                        : "non-breaking",
                });
                continue;
            }

            if (
                oldProperty.type &&
                newProperty.type &&
                oldProperty.type !== newProperty.type
            ) {
                changes.push({
                    tool: oldTool.name,
                    kind: "type_changed",
                    parameter,
                    before: oldProperty.type,
                    after: newProperty.type,
                    severity: "breaking",
                });
            }
        }

        for (const [parameter, newProperty] of Object.entries(
            newProperties,
        )) {
            if (!oldProperties[parameter]) {
                changes.push({
                    tool: oldTool.name,
                    kind: "parameter_added",
                    parameter,
                    after: newProperty.type,
                    severity: newRequired.has(parameter)
                        ? "breaking"
                        : "non-breaking",
                });
            } else if (
                !oldRequired.has(parameter) &&
                newRequired.has(parameter)
            ) {
                changes.push({
                    tool: oldTool.name,
                    kind: "required_added",
                    parameter,
                    severity: "breaking",
                });
            }
        }
    }

    return changes;
}
