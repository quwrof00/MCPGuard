import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createV1Server() {
  const server = new McpServer({
    name: "github-mock",
    version: "1.0.0",
  });

  // Tool 1: get_issue (breaking rename + type change in v2)
  server.registerTool(
    "get_issue",
    {
      description: "Fetch a GitHub issue by its identifier",
      inputSchema: {
        issue_id: z.string(),
      },
    },
    async ({ issue_id }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            issue_id,
            author_id: "usr_octocat",
            title: "OAuth token expiration handling",
            state: "open",
          }),
        },
      ],
    }),
  );

  // Tool 2: get_user (unchanged control)
  server.registerTool(
    "get_user",
    {
      description: "Fetch user profile by user identifier",
      inputSchema: {
        user_id: z.string(),
      },
    },
    async ({ user_id }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            user_id,
            username: "octocat",
            role: "core-maintainer",
            email: "octocat@github.com",
          }),
        },
      ],
    }),
  );

  // Tool 3: post_comment (breaking rename in v2)
  server.registerTool(
    "post_comment",
    {
      description: "Post a comment on a GitHub issue",
      inputSchema: {
        issue_id: z.string(),
        body: z.string(),
      },
    },
    async ({ issue_id, body }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            comment_id: "cmt_4021",
            issue_id,
            body,
            status: "posted",
          }),
        },
      ],
    }),
  );

  // Tool 4: list_repositories (unchanged control)
  server.registerTool(
    "list_repositories",
    {
      description: "List repositories belonging to an organization",
      inputSchema: {
        org: z.string(),
      },
    },
    async ({ org }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            org,
            repositories: ["mcpguard", "agent-framework", "mcp-proxy"],
          }),
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

  // Tool 1: get_issue (V2: renamed issue_id -> issue_number: number)
  server.registerTool(
    "get_issue",
    {
      description: "Fetch a GitHub issue by its numeric identifier",
      inputSchema: {
        issue_number: z.number(),
      },
    },
    async ({ issue_number }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            issue_number,
            author_id: "usr_octocat",
            title: "OAuth token expiration handling",
            state: "open",
          }),
        },
      ],
    }),
  );

  // Tool 2: get_user (Unchanged control)
  server.registerTool(
    "get_user",
    {
      description: "Fetch user profile by user identifier",
      inputSchema: {
        user_id: z.string(),
      },
    },
    async ({ user_id }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            user_id,
            username: "octocat",
            role: "core-maintainer",
            email: "octocat@github.com",
          }),
        },
      ],
    }),
  );

  // Tool 3: post_comment (V2: renamed issue_id -> issue_number: number, optional notify_author added)
  server.registerTool(
    "post_comment",
    {
      description: "Post a comment on a GitHub issue",
      inputSchema: {
        issue_number: z.number(),
        body: z.string(),
        notify_author: z.boolean().optional(),
      },
    },
    async ({ issue_number, body, notify_author }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            comment_id: "cmt_4021",
            issue_number,
            body,
            notify_author: notify_author ?? false,
            status: "posted",
          }),
        },
      ],
    }),
  );

  // Tool 4: list_repositories (Unchanged control)
  server.registerTool(
    "list_repositories",
    {
      description: "List repositories belonging to an organization",
      inputSchema: {
        org: z.string(),
      },
    },
    async ({ org }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            org,
            repositories: ["mcpguard", "agent-framework", "mcp-proxy"],
          }),
        },
      ],
    }),
  );

  return server;
}