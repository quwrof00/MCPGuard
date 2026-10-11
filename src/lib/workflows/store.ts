export type WorkflowStep = {
  id: string;
  tool: string;
  description: string;
  args: Record<string, unknown>;
  fromPrevious?: {
    stepId: string;
    sourceKey: string;
    targetKey: string;
  };
};

export type AgentWorkflow = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  steps: WorkflowStep[];
};

export const SAVED_WORKFLOWS: AgentWorkflow[] = [
  {
    id: "wf-triage-issue",
    name: "Triage Issue and Notify Author",
    description: "Fetches issue metadata, retrieves author profile, and posts an automated triage confirmation.",
    tags: ["core", "github", "triage"],
    steps: [
      {
        id: "step-1",
        tool: "get_issue",
        description: "Fetch issue #42 details",
        args: {
          issue_id: "42",
        },
      },
      {
        id: "step-2",
        tool: "get_user",
        description: "Retrieve profile of issue author",
        args: {
          user_id: "usr_octocat",
        },
        fromPrevious: {
          stepId: "step-1",
          sourceKey: "author_id",
          targetKey: "user_id",
        },
      },
      {
        id: "step-3",
        tool: "post_comment",
        description: "Post triage acknowledgment comment on the issue",
        args: {
          issue_id: "42",
          body: "TriageBot has indexed this issue and assigned priority P2.",
        },
      },
    ],
  },
  {
    id: "wf-explore-org",
    name: "Explore Organization Repositories",
    description: "Lists active repositories for an organization and inspects maintainer permissions.",
    tags: ["audit", "safe-control"],
    steps: [
      {
        id: "step-1",
        tool: "list_repositories",
        description: "List all repositories in the organization",
        args: {
          org: "octo-org",
        },
      },
      {
        id: "step-2",
        tool: "get_user",
        description: "Verify organization maintainer account",
        args: {
          user_id: "usr_octocat",
        },
      },
    ],
  },
  {
    id: "wf-release-note",
    name: "Post Production Release Comment",
    description: "Updates an existing tracker issue with a release deployment milestone.",
    tags: ["deployment", "notifications"],
    steps: [
      {
        id: "step-1",
        tool: "post_comment",
        description: "Post deployment confirmation comment",
        args: {
          issue_id: "42",
          body: "Release v2.4.0 successfully deployed to production.",
        },
      },
    ],
  },
];
