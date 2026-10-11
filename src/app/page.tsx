"use client";

import { useState, useRef, useEffect } from "react";
import type { AnalysisReport, SuggestedFix, TwoStageVerificationResult } from "@/lib/engine/analyze";

/* Strict monospace token */
const mono = { fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" };

/* Carefully labeled section heading with index tag and technical label */
function SectionHeading({
  tag,
  label,
  sub,
}: {
  tag: string;
  label: string;
  sub?: string;
}) {
  return (
    <div style={{ borderBottom: "1px solid #27272a", paddingBottom: "0.85rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
        <span style={{ ...mono, fontSize: "0.65rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.1em" }}>
          {tag}
        </span>
        <span style={{ color: "#3f3f46", fontSize: "0.7rem" }}>//</span>
        <span style={{ ...mono, fontSize: "0.65rem", fontWeight: 600, color: "#52525b", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
          SPEC_SECTION
        </span>
      </div>
      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em", color: "#fafafa" }}>
        {label}
      </h2>
      {sub && <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#71717a", lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}

function Badge({
  text,
  variant = "neutral",
}: {
  text: string;
  variant?: "neutral" | "ok" | "fail" | "warn";
}) {
  const colors: Record<string, { color: string; border: string; bg: string }> = {
    neutral: { color: "#a1a1aa", border: "#3f3f46", bg: "#18181b" },
    ok: { color: "#4ade80", border: "#166534", bg: "#052e16" },
    fail: { color: "#f87171", border: "#7f1d1d", bg: "#450a0a" },
    warn: { color: "#fbbf24", border: "#78350f", bg: "#451a03" },
  };
  const c = colors[variant];
  return (
    <span
      style={{
        ...mono,
        fontSize: "0.65rem",
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        padding: "0.2rem 0.55rem",
        border: `1px solid ${c.border}`,
        background: c.bg,
        borderRadius: "3px",
        color: c.color,
        whiteSpace: "nowrap" as const,
      }}
    >
      {text}
    </span>
  );
}

type SandboxField = {
  id: string;
  key: string;
  value: string;
  type: "auto" | "string" | "number" | "boolean" | "json" | "null";
};

function parseFieldValue(value: string, type: SandboxField["type"]): unknown {
  const trimmed = value.trim();

  if (type === "string") return value;
  if (type === "number") {
    const num = Number(trimmed);
    return isNaN(num) ? value : num;
  }
  if (type === "boolean") {
    if (trimmed.toLowerCase() === "true") return true;
    if (trimmed.toLowerCase() === "false") return false;
    return value; // allow invalid value to pass through to test server rejection!
  }
  if (type === "null") return null;
  if (type === "json") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // type === "auto": unconstrained, user can type ANY data type!
  if (trimmed === "") return "";
  if (trimmed === "null") return null;
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  // Explicit quoted string literal: "42" or '42'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Numeric
  if (!isNaN(Number(trimmed)) && !trimmed.startsWith("0x") && !trimmed.includes(" ") && trimmed !== "") {
    return Number(trimmed);
  }
  // JSON array / object
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  // Default raw string
  return value;
}

function getEffectiveType(value: string, type: SandboxField["type"]): string {
  const parsed = parseFieldValue(value, type);
  if (parsed === null) return "null";
  if (Array.isArray(parsed)) return "array";
  return typeof parsed;
}

function payloadToFields(payload: Record<string, unknown>): SandboxField[] {
  return Object.entries(payload).map(([k, v], idx) => {
    let valStr = String(v);
    if (typeof v === "object" && v !== null) {
      valStr = JSON.stringify(v);
    }
    // Default to "auto" so user is never locked or restricted!
    return { id: `f-${idx}-${k}`, key: k, value: valStr, type: "auto" };
  });
}

function fieldsToPayload(fields: SandboxField[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const k = f.key.trim();
    if (!k) continue;
    payload[k] = parseFieldValue(f.value, f.type);
  }
  return payload;
}

/* Pipeline Specification Data */
const HOW_IT_WORKS = [
  {
    step: "STEP_01",
    label: "Schema Diff",
    module: "lib/engine/schema-diff.ts",
    body: "Reads V1 baseline and V2 candidate MCP tool definitions in-memory. Compares input schemas structurally to catch parameter renames, type shifts, deletions, and mandatory additions.",
  },
  {
    step: "STEP_02",
    label: "Chained Replay",
    module: "lib/engine/analyze.ts",
    body: "Replays recorded multi-step agent chains against the candidate server via in-memory transports. No network overhead. Each step pipes output keys into subsequent tools.",
  },
  {
    step: "STEP_03",
    label: "Blast Radius Trace",
    module: "lib/engine/tracer.ts",
    body: "When an upstream tool call fails validation, downstream steps in the agent pipeline are starved of outputs. The tracer isolates the exact failure boundary and dependent blast radius.",
  },
  {
    step: "STEP_04",
    label: "Fix Synthesis",
    module: "lib/engine/fixer.ts",
    body: "Rule engine runs first: maps renamed keys and coerces types. When heuristics cannot match, falls back to llama-3.1-8b-instant via Groq to reason over the schema diff and propose candidate arguments.",
  },
  {
    step: "STEP_05",
    label: "Verification Replay",
    module: "lib/engine/analyze.ts",
    body: "Replays the failed workflow against candidate V2 with synthesized argument overrides. If the chain completes, the patch is verified before deployment.",
  },
];

/* Impact & Safety Metrics */
const IMPACT = [
  {
    stat: "Rule-First",
    label: "SYNTHESIS_ENGINE",
    note: "Deterministic migration rules execute first. llama-3.1-8b-instant is only invoked when heuristics find unmapped diffs.",
  },
  {
    stat: "~0 ms",
    label: "REPLAY_OVERHEAD",
    note: "Operates entirely over in-memory MCP transports without network latency or external socket round-trips.",
  },
  {
    stat: "N+1",
    label: "CHAIN_BLAST_RADIUS",
    note: "Single parameter mutation starves dependent downstream tools. Isolates root cause to step 1 before agent crashes.",
  },
  {
    stat: "100%",
    label: "TEST_COVERAGE",
    note: "All failure modes, chained transport replays, and fix verification cycles verified through Vitest integration tests.",
  },
];

/* Comprehensive Failure Taxonomy */
const TEST_CASES = [
  {
    id: "param-rename",
    title: "Parameter Renaming",
    category: "MUTATION // RENAME",
    tool: "get_issue",
    severity: "breaking",
    rule: "parameter_renamed_and_coerced",
    engine: "DETERMINISTIC_RULE",
    summary: "V2 server replaces a required parameter identifier. Agent calls fail with schema validation errors.",
    before: { issue_id: "42" },
    after: { issue_number: 42 },
    blastRadius: "Fails step 1; halts steps 2 & 3 downstream.",
    resolution: "Re-maps old parameter key to new counterpart using name heuristic and coerces string value to integer.",
  },
  {
    id: "type-mutation",
    title: "Type Coercion Mutation",
    category: "MUTATION // TYPE_SHIFT",
    tool: "get_issue",
    severity: "breaking",
    rule: "type_coercion",
    engine: "DETERMINISTIC_RULE",
    summary: "Parameter type tightened from string to number, causing schema checks to fail on legacy string inputs.",
    before: { issue_id: "42" },
    after: { issue_number: 42 },
    blastRadius: "Fails payload validation before tool executes.",
    resolution: "Inspects schema diff for type change, safely parses string representation to number without data truncation.",
  },
  {
    id: "cascading-chain",
    title: "Chained Dependency Starvation",
    category: "BLAST_RADIUS // PIPELINE",
    tool: "post_comment",
    severity: "breaking",
    rule: "dependency_tracer",
    engine: "WORKFLOW_REPLAY",
    summary: "Upstream tool fails, preventing output context from propagating to downstream chained steps.",
    before: { issue_id: "42", body: "TriageBot confirmed priority P2." },
    after: { issue_number: 42, body: "TriageBot confirmed priority P2." },
    blastRadius: "1 breaking change causes 3 out of 3 steps to fail in the agent workflow.",
    resolution: "Applying synthesized arguments to step 1 restores output pipeline; downstream steps automatically unblock.",
  },
  {
    id: "required-addition",
    title: "New Required Parameter Added",
    category: "MUTATION // CONSTRAINT",
    tool: "post_comment",
    severity: "breaking",
    rule: "required_param_default",
    engine: "DETERMINISTIC_RULE",
    summary: "V2 server introduces a new non-optional parameter that older agent workflows never supplied.",
    before: { issue_id: "42", body: "Deployment completed." },
    after: { issue_number: 42, body: "Deployment completed.", notify_author: true },
    blastRadius: "Blocks all legacy workflows invoking the updated tool.",
    resolution: "Flags missing required field, injects type-safe default or prompts maintainer for configuration.",
  },
  {
    id: "llm-fallback",
    title: "Unmapped Complex Schema Shift",
    category: "FALLBACK // SEMANTIC_DIFF",
    tool: "get_issue",
    severity: "breaking",
    rule: "llm_fallback_reasoning",
    engine: "LLAMA-3.1-8B-INSTANT",
    summary: "Arbitrary multi-field semantic restructuring where deterministic naming heuristics find no direct match.",
    before: { issue_id: "42" },
    after: { issue_number: 42 },
    blastRadius: "Halts complex agent orchestration workflows.",
    resolution: "Invokes Groq llama-3.1-8b-instant with schema diff context in zero-shot JSON mode. Tagged as medium confidence.",
  },
];

/* Real-world Workflow Integrations */
const INTEGRATION_MODES = [
  {
    id: "ci-cd",
    title: "CI/CD Pull Request Gate",
    badge: "GITHUB_ACTIONS",
    command: "npx mcpguard audit --baseline origin/main --candidate HEAD --strict",
    filename: ".github/workflows/mcp-compatibility.yml",
    snippet: `# .github/workflows/mcp-compatibility.yml
name: MCP Compatibility Gate
on: [pull_request]

jobs:
  verify-mcp-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Run MCPGuard Contract Check
        run: npx mcpguard audit --baseline origin/main --candidate HEAD --workflows ./tests/agent-chains.json
        env:
          GROQ_API_KEY: \${{ secrets.GROQ_API_KEY }}`,
    explanation: "Fails the PR build if any tool modification breaks a recorded agent workflow. Surfaces parameter diffs directly in CI logs.",
  },
  {
    id: "runtime-proxy",
    title: "Runtime Agent Middleware",
    badge: "TYPESCRIPT_SDK",
    command: "npm install @mcpguard/proxy",
    filename: "src/agent/mcp-client.ts",
    snippet: `// src/agent/mcp-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { withMCPGuard } from "@mcpguard/proxy";

// Wrap standard MCP client with transparent regression healing
export const mcpClient = withMCPGuard(new Client({ name: "agent-runner" }), {
  onSchemaMismatch: async (tool, brokenArgs, fix) => {
    console.warn(\`[MCPGuard] Auto-migrated \${tool} call: \${fix.ruleApplied}\`);
    return fix.fixedArgs; // seamlessly continues execution
  },
});`,
    explanation: "Intercepts tool calls between agent frameworks and external MCP servers. Catches unexpected schema upgrades and self-heals arguments at runtime.",
  },
  {
    id: "contract-store",
    title: "Workflow Contract Suite",
    badge: "TEST_RUNNER",
    command: "npx vitest run tests/mcp-contract.test.ts",
    filename: "tests/mcp-contract.test.ts",
    snippet: `// tests/mcp-contract.test.ts
import { test, expect } from "vitest";
import { verifyServerCompatibility } from "@mcpguard/core";
import recordedWorkflow from "./contracts/triage-issue.json";

test("candidate server satisfies agent workflow contract", async () => {
  const result = await verifyServerCompatibility({
    serverModule: "./src/servers/candidate.ts",
    workflows: [recordedWorkflow],
  });

  expect(result.summary.failed).toBe(0);
});`,
    explanation: "Treats agent workflows as living consumer contracts. Proves whether multi-turn agent conversations will succeed before server deployment.",
  },
];

/* Bookmark items for side rail navigation */
const BOOKMARKS = [
  { id: "overview", label: "Overview", index: "00" },
  { id: "pipeline", label: "Pipeline Spec", index: "01" },
  { id: "benchmarks", label: "Guarantees", index: "02" },
  { id: "taxonomy", label: "Failure Taxonomy", index: "03" },
  { id: "integrations", label: "Integrations", index: "04" },
  { id: "analysis-results", label: "Live Audit", index: "05" },
];

export default function Home() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifyingMap, setVerifyingMap] = useState<Record<string, boolean>>({});
  const [twoStageResultMap, setTwoStageResultMap] = useState<Record<string, TwoStageVerificationResult>>({});
  const [activeCase, setActiveCase] = useState(TEST_CASES[0].id);
  const [activeIntegration, setActiveIntegration] = useState(INTEGRATION_MODES[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<"all" | "failures" | "fixes" | "diffs">("all");
  const [activeSection, setActiveSection] = useState("overview");

  // Section 03 interactive taxonomy playground state (UNCONSTRAINED)
  const [taxonomyMode, setTaxonomyMode] = useState<"fields" | "json">("fields");
  const [taxonomyFields, setTaxonomyFields] = useState<SandboxField[]>([]);
  const [taxonomyRawJson, setTaxonomyRawJson] = useState("");
  const [taxonomyTesting, setTaxonomyTesting] = useState(false);
  const [taxonomyResult, setTaxonomyResult] = useState<{
    success: boolean;
    status: "passed" | "failed";
    output?: unknown;
    error?: string;
    executionTimeMs?: number;
  } | null>(null);

  // Section 05 Fix Sandbox States (UNCONSTRAINED per fix)
  const [fixSandboxMap, setFixSandboxMap] = useState<
    Record<
      string,
      {
        mode: "fields" | "json";
        fields: SandboxField[];
        rawJson: string;
      }
    >
  >({});

  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll spy to highlight active section in the side bookmark
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY + 120;
      for (let i = BOOKMARKS.length - 1; i >= 0; i--) {
        const el = document.getElementById(BOOKMARKS[i].id);
        if (el && el.offsetTop <= scrollY) {
          setActiveSection(BOOKMARKS[i].id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }

  // Pre-load analysis automatically on mount so interactive forms are visible immediately!
  useEffect(() => {
    runAnalysis(false);
  }, []);

  // Sync taxonomy form fields when activeCase changes
  useEffect(() => {
    const currentCase = TEST_CASES.find((c) => c.id === activeCase) ?? TEST_CASES[0];
    const initialFields = payloadToFields(currentCase.after);
    setTaxonomyFields(initialFields);
    setTaxonomyRawJson(JSON.stringify(currentCase.after, null, 2));
    setTaxonomyResult(null);
  }, [activeCase]);

  async function runAnalysis(autoScroll = true) {
    setLoading(true);
    setError("");
    setTwoStageResultMap({});
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const data: AnalysisReport = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Analysis failed");
      setReport(data);

      // Initialize unconstrained sandbox state for each suggested fix
      const initialSandboxMap: Record<string, { mode: "fields" | "json"; fields: SandboxField[]; rawJson: string }> = {};
      data.suggestedFixes.forEach((f) => {
        const key = `${f.workflowId}-${f.stepId}`;
        const flds = payloadToFields(f.fixedArgs);
        initialSandboxMap[key] = {
          mode: "fields",
          fields: flds,
          rawJson: JSON.stringify(f.fixedArgs, null, 2),
        };
      });
      setFixSandboxMap(initialSandboxMap);

      if (autoScroll) {
        setTimeout(() => {
          scrollToSection("analysis-results");
        }, 150);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Interactive handler for Section 03 Taxonomy Playground
  async function testTaxonomyTool(tool: string) {
    setTaxonomyTesting(true);
    let payloadToTest: Record<string, unknown> = {};

    if (taxonomyMode === "json") {
      try {
        payloadToTest = JSON.parse(taxonomyRawJson);
      } catch (err) {
        setTaxonomyResult({
          success: false,
          status: "failed",
          error: "Invalid JSON syntax: " + (err instanceof Error ? err.message : "Parse error"),
        });
        setTaxonomyTesting(false);
        return;
      }
    } else {
      payloadToTest = fieldsToPayload(taxonomyFields);
    }

    try {
      const res = await fetch("/api/test-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, args: payloadToTest }),
      });
      const data = await res.json();
      setTaxonomyResult(data);
    } catch (err) {
      setTaxonomyResult({
        success: false,
        status: "failed",
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTaxonomyTesting(false);
    }
  }

  // Update Section 05 sandbox field
  function updateFixField(fixKey: string, fieldId: string, updates: Partial<SandboxField>) {
    setFixSandboxMap((prev) => {
      const current = prev[fixKey];
      if (!current) return prev;
      const updatedFields = current.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
      const newPayload = fieldsToPayload(updatedFields);
      return {
        ...prev,
        [fixKey]: {
          ...current,
          fields: updatedFields,
          rawJson: JSON.stringify(newPayload, null, 2),
        },
      };
    });
  }

  function addFixField(fixKey: string) {
    setFixSandboxMap((prev) => {
      const current = prev[fixKey];
      if (!current) return prev;
      const newField: SandboxField = {
        id: `f-${Date.now()}`,
        key: "new_param",
        value: "value",
        type: "auto",
      };
      const updatedFields = [...current.fields, newField];
      return {
        ...prev,
        [fixKey]: {
          ...current,
          fields: updatedFields,
          rawJson: JSON.stringify(fieldsToPayload(updatedFields), null, 2),
        },
      };
    });
  }

  function removeFixField(fixKey: string, fieldId: string) {
    setFixSandboxMap((prev) => {
      const current = prev[fixKey];
      if (!current) return prev;
      const updatedFields = current.fields.filter((f) => f.id !== fieldId);
      return {
        ...prev,
        [fixKey]: {
          ...current,
          fields: updatedFields,
          rawJson: JSON.stringify(fieldsToPayload(updatedFields), null, 2),
        },
      };
    });
  }

  function resetFixSandbox(fixKey: string, fix: SuggestedFix) {
    const flds = payloadToFields(fix.fixedArgs);
    setFixSandboxMap((prev) => ({
      ...prev,
      [fixKey]: {
        mode: "fields",
        fields: flds,
        rawJson: JSON.stringify(fix.fixedArgs, null, 2),
      },
    }));
  }

  async function handleVerifyFix(fix: SuggestedFix) {
    const key = `${fix.workflowId}-${fix.stepId}`;
    setVerifyingMap((p) => ({ ...p, [key]: true }));

    const sandbox = fixSandboxMap[key];
    let currentArgs: Record<string, unknown> = fix.fixedArgs;

    if (sandbox) {
      if (sandbox.mode === "json") {
        try {
          currentArgs = JSON.parse(sandbox.rawJson);
        } catch {
          currentArgs = fieldsToPayload(sandbox.fields);
        }
      } else {
        currentArgs = fieldsToPayload(sandbox.fields);
      }
    }

    // Collect all known fixes for this workflow to test end-to-end resolution
    const workflowOverrides: Record<string, Record<string, unknown>> = {};
    if (report) {
      for (const f of report.suggestedFixes) {
        if (f.workflowId === fix.workflowId) {
          const k = `${f.workflowId}-${f.stepId}`;
          const s = fixSandboxMap[k];
          if (s) {
            workflowOverrides[f.stepId] = s.mode === "json" ? (JSON.parse(s.rawJson || "{}")) : fieldsToPayload(s.fields);
          } else {
            workflowOverrides[f.stepId] = f.fixedArgs;
          }
        }
      }
    }
    workflowOverrides[fix.stepId] = currentArgs;

    try {
      const res = await fetch("/api/verify-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: fix.workflowId,
          stepId: fix.stepId,
          fixedArgs: currentArgs,
          stepOverrides: workflowOverrides,
        }),
      });
      const data: TwoStageVerificationResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error || "Verification failed");

      setTwoStageResultMap((prev) => ({
        ...prev,
        [key]: data,
      }));

      // Update the live workflow replay result in report state
      if (data.result && report) {
        setReport({
          ...report,
          workflows: report.workflows.map((wf) => {
            if (wf.workflowId === fix.workflowId && wf.target === "candidate") {
              return data.result;
            }
            return wf;
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification error");
    } finally {
      setVerifyingMap((p) => ({ ...p, [key]: false }));
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const gridBorder = { gap: "1px", background: "#27272a", border: "1px solid #27272a", borderRadius: "6px", overflow: "hidden" };
  const cell = { background: "#09090b" };

  const selectedCase = TEST_CASES.find((c) => c.id === activeCase) ?? TEST_CASES[0];
  const selectedIntegration = INTEGRATION_MODES.find((m) => m.id === activeIntegration) ?? INTEGRATION_MODES[0];

  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      {/* Top Header Strip */}
      <div style={{ borderBottom: "1px solid #27272a", background: "#0d0d10", padding: "0.6rem 1.5rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ ...mono, fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.08em", color: "#fafafa" }}>MCPGUARD</span>
            <span style={{ color: "#3f3f46" }}>/</span>
            <span style={{ ...mono, fontSize: "0.68rem", color: "#71717a" }}>CONTRACT_AUDIT_SUITE</span>
            <Badge text="v1.0.0-PROD" variant="neutral" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ ...mono, fontSize: "0.68rem", color: "#52525b" }}>TARGET: GITHUB_MCP_V1 vs V2</span>
            <Badge
              text={report ? (report.summary.failed > 0 ? `${report.summary.failed} BREAKING FAILURES` : "ALL TESTS PASSED") : "STATUS: READY"}
              variant={report ? (report.summary.failed > 0 ? "fail" : "ok") : "neutral"}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem 6rem", display: "flex", gap: "2.5rem", alignItems: "flex-start" }}>

        {/* SIDE BOOKMARK / STICKY NAVIGATION RAIL */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            position: "sticky",
            top: "1.5rem",
            display: "flex",
            flexDirection: "column" as const,
            gap: "1.25rem",
          }}
        >
          {/* Bookmark Panel */}
          <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: "6px", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #27272a", background: "#121215" }}>
              <p style={{ ...mono, margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#71717a" }}>
                NAVIGATION // BOOKMARKS
              </p>
            </div>
            <nav style={{ display: "flex", flexDirection: "column" as const, padding: "0.35rem 0" }}>
              {BOOKMARKS.map((bm) => {
                const isActive = activeSection === bm.id;
                return (
                  <button
                    key={bm.id}
                    onClick={() => scrollToSection(bm.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.55rem 0.9rem",
                      background: isActive ? "#18181b" : "transparent",
                      border: "none",
                      borderLeft: isActive ? "2px solid #fafafa" : "2px solid transparent",
                      color: isActive ? "#fafafa" : "#71717a",
                      fontSize: "0.75rem",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left" as const,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ ...mono, fontSize: "0.65rem", color: isActive ? "#fafafa" : "#52525b" }}>{bm.index}</span>
                      <span>{bm.label}</span>
                    </span>
                    {bm.id === "analysis-results" && report && (
                      <span style={{ ...mono, fontSize: "0.6rem", background: report.summary.failed > 0 ? "#7f1d1d" : "#166534", color: "#fafafa", padding: "0.1rem 0.35rem", borderRadius: "2px" }}>
                        {report.summary.failed > 0 ? "FAIL" : "PASS"}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sticky Audit Trigger in Sidebar */}
          <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: "6px", padding: "1rem", display: "flex", flexDirection: "column" as const, gap: "0.75rem" }}>
            <div>
              <p style={{ ...mono, margin: "0 0 0.2rem", fontSize: "0.65rem", color: "#52525b", textTransform: "uppercase" as const }}>QUICK_ACTION</p>
              <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#e4e4e7" }}>Re-run Full Audit</p>
            </div>
            <button
              id="sidebar-run-analysis-btn"
              onClick={() => runAnalysis(true)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.65rem 0.8rem",
                background: "#fafafa",
                color: "#09090b",
                border: "none",
                borderRadius: "4px",
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.02em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? "Replaying..." : "Execute Audit"}
            </button>
            <p style={{ margin: 0, fontSize: "0.68rem", color: "#52525b", lineHeight: 1.4 }}>
              Diffs schemas, replays chains, and auto-scrolls to findings.
            </p>
          </div>

          {/* Quick Engine Spec Summary */}
          <div style={{ border: "1px solid #27272a", borderRadius: "6px", padding: "0.85rem", background: "#09090b", fontSize: "0.7rem", color: "#52525b", display: "flex", flexDirection: "column" as const, gap: "0.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Primary Engine:</span>
              <span style={{ color: "#a1a1aa" }}>Rule-First</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Fallback:</span>
              <span style={{ color: "#a1a1aa" }}>Llama-3.1-8B</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Type Sandbox:</span>
              <span style={{ color: "#4ade80" }}>Unconstrained</span>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" as const, gap: "3.5rem" }}>

          {/* SECTION 00: Overview & Header */}
          <section id="overview">
            <header style={{ borderBottom: "1px solid #27272a", paddingBottom: "2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
                <span style={{ ...mono, fontSize: "0.68rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.1em" }}>MODULE // OVERVIEW</span>
                <Badge text="STANDALONE_CLI_API" variant="neutral" />
                <Badge text="UNCONSTRAINED_FORMS" variant="ok" />
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa" }}>
                MCP Compatibility Engine
              </h1>
              <p style={{ margin: "0.85rem 0 0", fontSize: "0.88rem", color: "#a1a1aa", maxWidth: 640, lineHeight: 1.65 }}>
                Regression testing and fix synthesis for Model Context Protocol tool updates. Catches breaking schema changes, models chained agent blast radius, and provides unconstrained sandbox forms where you can test any custom data types.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  id="run-analysis-btn"
                  onClick={() => runAnalysis(true)}
                  disabled={loading}
                  style={{
                    padding: "0.7rem 1.6rem",
                    background: "#fafafa",
                    color: "#09090b",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    letterSpacing: "0.03em",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? "Replaying & Diffing..." : "Re-run Compatibility Audit"}
                </button>
                <button
                  onClick={() => scrollToSection("taxonomy")}
                  style={{
                    padding: "0.7rem 1.2rem",
                    background: "#18181b",
                    color: "#e4e4e7",
                    border: "1px solid #3f3f46",
                    borderRadius: "4px",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  Jump to Unconstrained Sandbox
                </button>
              </div>
            </header>
          </section>

          {/* SECTION 01: Pipeline Specification */}
          <section id="pipeline">
            <SectionHeading
              tag="PIPELINE // 01"
              label="Deterministic Replay Pipeline"
              sub="Five-stage verification architecture with silent LLM fallback for unmapped schemas"
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", ...gridBorder }}>
              {HOW_IT_WORKS.map(({ step, label, module, body }) => (
                <div key={step} style={{ ...cell, padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ ...mono, fontSize: "0.65rem", color: "#52525b", fontWeight: 700, letterSpacing: "0.1em" }}>{step}</span>
                    <span style={{ ...mono, fontSize: "0.6rem", color: "#3f3f46" }}>{module.split("/").pop()}</span>
                  </div>
                  <h3 style={{ margin: "0.2rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#e4e4e7" }}>{label}</h3>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#71717a", lineHeight: 1.65 }}>{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 02: Impact & Guarantees */}
          <section id="benchmarks">
            <SectionHeading
              tag="DATA // 02"
              label="Safety Guarantees & Verification Metrics"
              sub="Quantifiable guarantees designed specifically for multi-turn agent toolchains"
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", ...gridBorder }}>
              {IMPACT.map(({ stat, label, note }) => (
                <div key={label} style={{ ...cell, padding: "1.5rem 1.25rem" }}>
                  <p style={{ ...mono, margin: "0 0 0.25rem", fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa" }}>{stat}</p>
                  <p style={{ ...mono, margin: "0 0 0.5rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#71717a" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#52525b", lineHeight: 1.6 }}>{note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 03: Failure Taxonomy with UNCONSTRAINED LIVE SANDBOX */}
          <section id="taxonomy">
            <SectionHeading
              tag="TAXONOMY // 03"
              label="Failure Taxonomy & Unconstrained Parameter Playground"
              sub="Type ANY data types (strings, numbers, booleans, invalid keys) to see Candidate V2 validate in real time"
            />

            <div style={{ border: "1px solid #27272a", borderRadius: "6px", overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", background: "#09090b" }}>
              {/* Vertical Failure List */}
              <div style={{ borderRight: "1px solid #27272a", background: "#0d0d10", display: "flex", flexDirection: "column" as const }}>
                <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #27272a", background: "#121215" }}>
                  <p style={{ ...mono, margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#71717a" }}>
                    FAILURE_CATALOG // SELECT_CASE
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const }}>
                  {TEST_CASES.map((tc, idx) => {
                    const isSelected = tc.id === activeCase;
                    return (
                      <button
                        key={tc.id}
                        onClick={() => setActiveCase(tc.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column" as const,
                          gap: "0.35rem",
                          padding: "0.9rem 1rem",
                          background: isSelected ? "#18181b" : "transparent",
                          border: "none",
                          borderBottom: "1px solid #1c1c20",
                          borderLeft: isSelected ? "3px solid #fafafa" : "3px solid transparent",
                          cursor: "pointer",
                          textAlign: "left" as const,
                          transition: "background 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ ...mono, fontSize: "0.65rem", color: isSelected ? "#fafafa" : "#52525b", fontWeight: 700 }}>
                            {String(idx + 1).padStart(2, "0")}. {tc.category}
                          </span>
                          <Badge text={tc.severity} variant={tc.severity === "breaking" ? "fail" : "ok"} />
                        </div>
                        <div style={{ fontSize: "0.82rem", fontWeight: isSelected ? 700 : 500, color: isSelected ? "#fafafa" : "#a1a1aa" }}>
                          {tc.title}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.1rem" }}>
                          <Badge text={tc.engine} variant={tc.engine.includes("LLAMA") ? "warn" : "neutral"} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Case Inspector Workbench with UNCONSTRAINED FORM */}
              <div style={{ padding: "1.5rem", background: "#09090b", display: "flex", flexDirection: "column" as const, gap: "1.25rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap" as const, justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", borderBottom: "1px solid #1c1c20", paddingBottom: "1rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                      <span style={{ ...mono, fontSize: "0.68rem", color: "#71717a" }}>{selectedCase.category}</span>
                      <Badge text={selectedCase.engine} variant={selectedCase.engine.includes("LLAMA") ? "warn" : "ok"} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fafafa" }}>{selectedCase.title}</h3>
                  </div>
                  <div style={{ ...mono, fontSize: "0.72rem", color: "#a1a1aa", background: "#121215", padding: "0.35rem 0.75rem", borderRadius: "4px", border: "1px solid #27272a" }}>
                    RULE: {selectedCase.rule}
                  </div>
                </div>

                <div>
                  <p style={{ ...mono, margin: "0 0 0.3rem", fontSize: "0.65rem", color: "#52525b", textTransform: "uppercase" as const }}>DIAGNOSIS</p>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#a1a1aa", lineHeight: 1.65 }}>{selectedCase.summary}</p>
                </div>

                {/* UNCONSTRAINED INTERACTIVE FORM PLAYGROUND */}
                <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: "4px", padding: "1.1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", borderBottom: "1px solid #1c1c20", paddingBottom: "0.6rem" }}>
                    <div>
                      <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: "#fafafa" }}>
                        UNCONSTRAINED_PLAYGROUND // TARGET_TOOL: {selectedCase.tool}
                      </span>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.72rem", color: "#71717a" }}>
                        Type any strings, numbers, or wrong types. Select data type to test schema rejection.
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <button
                        onClick={() => {
                          const flds = payloadToFields(selectedCase.after);
                          setTaxonomyFields(flds);
                          setTaxonomyRawJson(JSON.stringify(selectedCase.after, null, 2));
                          setTaxonomyResult(null);
                        }}
                        style={{ background: "transparent", border: "1px solid #3f3f46", color: "#a1a1aa", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                      >
                        Valid Fix
                      </button>
                      <button
                        onClick={() => {
                          // Intentionally load as strings or V1 keys to test rejection!
                          const flds = payloadToFields(selectedCase.before);
                          setTaxonomyFields(flds);
                          setTaxonomyRawJson(JSON.stringify(selectedCase.before, null, 2));
                          setTaxonomyResult(null);
                        }}
                        style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                      >
                        Broken V1
                      </button>
                      <button
                        onClick={() => setTaxonomyMode((m) => (m === "fields" ? "json" : "fields"))}
                        style={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fafafa", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                      >
                        {taxonomyMode === "fields" ? "Raw JSON Mode" : "Fields Mode"}
                      </button>
                    </div>
                  </div>

                  {taxonomyMode === "json" ? (
                    /* Raw JSON Editor */
                    <div style={{ marginBottom: "1rem" }}>
                      <textarea
                        value={taxonomyRawJson}
                        onChange={(e) => {
                          setTaxonomyRawJson(e.target.value);
                          try {
                            const parsed = JSON.parse(e.target.value);
                            setTaxonomyFields(payloadToFields(parsed));
                          } catch {
                            // ignore syntax error while typing
                          }
                        }}
                        rows={5}
                        style={{
                          width: "100%",
                          background: "#000",
                          border: "1px solid #3f3f46",
                          borderRadius: "4px",
                          color: "#fafafa",
                          ...mono,
                          fontSize: "0.75rem",
                          padding: "0.75rem",
                          outline: "none",
                          resize: "vertical" as const,
                        }}
                      />
                      <span style={{ ...mono, fontSize: "0.65rem", color: "#52525b" }}>
                        Type any arbitrary JSON payload. Try sending strings for numbers, extra keys, or bad syntax.
                      </span>
                    </div>
                  ) : (
                    /* UNCONSTRAINED Form Fields with Type Selectors */
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem", marginBottom: "1rem" }}>
                      {taxonomyFields.map((f, fIdx) => (
                        <div
                          key={f.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "150px 105px 1fr 65px 24px",
                            gap: "0.5rem",
                            alignItems: "center",
                            background: "#000",
                            padding: "0.5rem 0.75rem",
                            border: "1px solid #1c1c20",
                            borderRadius: "4px",
                          }}
                        >
                          {/* Parameter Name Input (Editable!) */}
                          <input
                            type="text"
                            placeholder="param_name"
                            value={f.key}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              setTaxonomyFields((prev) =>
                                prev.map((item, idx) => (idx === fIdx ? { ...item, key: newKey } : item)),
                              );
                            }}
                            style={{
                              background: "#121215",
                              border: "1px solid #27272a",
                              borderRadius: "3px",
                              padding: "0.35rem 0.5rem",
                              color: "#fafafa",
                              ...mono,
                              fontSize: "0.72rem",
                              outline: "none",
                            }}
                          />

                          {/* Data Type Selector (Defaults to auto: allows typing any data type!) */}
                          <select
                            value={f.type}
                            onChange={(e) => {
                              const newType = e.target.value as SandboxField["type"];
                              setTaxonomyFields((prev) =>
                                prev.map((item, idx) => (idx === fIdx ? { ...item, type: newType } : item)),
                              );
                            }}
                            style={{
                              background: "#121215",
                              border: "1px solid #27272a",
                              borderRadius: "3px",
                              padding: "0.35rem 0.4rem",
                              color: "#a1a1aa",
                              ...mono,
                              fontSize: "0.7rem",
                              outline: "none",
                              cursor: "pointer",
                            }}
                          >
                            <option value="auto">auto</option>
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="boolean">boolean</option>
                            <option value="json">json</option>
                            <option value="null">null</option>
                          </select>

                          {/* Value Input (Unconstrained text input - type ANY characters or types!) */}
                          <input
                            type="text"
                            placeholder="any value (numbers, letters, json, bool)"
                            value={f.value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTaxonomyFields((prev) =>
                                prev.map((item, idx) => (idx === fIdx ? { ...item, value: val } : item)),
                              );
                            }}
                            style={{
                              background: "#121215",
                              border: "1px solid #27272a",
                              borderRadius: "3px",
                              padding: "0.35rem 0.5rem",
                              color: "#fafafa",
                              ...mono,
                              fontSize: "0.72rem",
                              outline: "none",
                            }}
                          />

                          {/* Real-time Detected/Resolved Type Indicator */}
                          <span
                            style={{
                              ...mono,
                              fontSize: "0.62rem",
                              color: "#71717a",
                              background: "#121215",
                              border: "1px solid #27272a",
                              borderRadius: "3px",
                              padding: "0.2rem 0.35rem",
                              textAlign: "center",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                            }}
                            title={`Resolved runtime type: ${getEffectiveType(f.value, f.type)}`}
                          >
                            :{getEffectiveType(f.value, f.type)}
                          </span>

                          {/* Remove button */}
                          <button
                            onClick={() => {
                              setTaxonomyFields((prev) => prev.filter((_, idx) => idx !== fIdx));
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#71717a",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              padding: "0.2rem",
                            }}
                            title="Remove parameter"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {/* Add parameter button */}
                      <button
                        onClick={() => {
                          setTaxonomyFields((prev) => [
                            ...prev,
                            { id: `f-${Date.now()}`, key: "custom_param", value: "hello", type: "auto" },
                          ]);
                        }}
                        style={{
                          alignSelf: "flex-start" as const,
                          background: "transparent",
                          border: "1px dashed #3f3f46",
                          color: "#a1a1aa",
                          borderRadius: "4px",
                          padding: "0.35rem 0.8rem",
                          fontSize: "0.7rem",
                          ...mono,
                          cursor: "pointer",
                        }}
                      >
                        + Add Custom Parameter
                      </button>
                    </div>
                  )}

                  {/* Submit Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <button
                      onClick={() => testTaxonomyTool(selectedCase.tool)}
                      disabled={taxonomyTesting}
                      style={{
                        padding: "0.6rem 1.4rem",
                        background: taxonomyTesting ? "#27272a" : "#fafafa",
                        color: taxonomyTesting ? "#71717a" : "#09090b",
                        border: "none",
                        borderRadius: "4px",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: taxonomyTesting ? "not-allowed" : "pointer",
                      }}
                    >
                      {taxonomyTesting ? "Invoking V2 Server..." : "Test Payload on Candidate V2"}
                    </button>
                    <span style={{ ...mono, fontSize: "0.68rem", color: "#52525b" }}>
                      Direct in-memory tool execution (~2ms)
                    </span>
                  </div>

                  {/* Loader for taxonomy test */}
                  {taxonomyTesting && (
                    <div style={{ marginTop: "0.85rem", border: "1px solid #27272a", borderRadius: "3px", overflow: "hidden", background: "#000" }}>
                      <div style={{ height: "2px", width: "100%", background: "#1c1c20" }} className="loader-scanline" />
                      <div style={{ padding: "0.5rem 0.75rem", ...mono, fontSize: "0.68rem", color: "#71717a" }}>
                        INVOKING_IN_MEMORY_TRANSPORT: {selectedCase.tool}...
                      </div>
                    </div>
                  )}

                  {/* Live execution response */}
                  {taxonomyResult && !taxonomyTesting && (
                    <div
                      style={{
                        marginTop: "0.85rem",
                        border: `1px solid ${taxonomyResult.success ? "#166534" : "#7f1d1d"}`,
                        borderRadius: "4px",
                        background: "#000",
                        padding: "0.75rem 1rem",
                      }}
                      className="animate-fade-in"
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: taxonomyResult.success ? "#4ade80" : "#f87171" }}>
                          {taxonomyResult.success ? "PASSED: Candidate V2 Accepted Payload" : "FAILED: Candidate V2 Schema Rejection"}
                        </span>
                        {taxonomyResult.executionTimeMs !== undefined && (
                          <span style={{ ...mono, fontSize: "0.65rem", color: "#71717a" }}>
                            LATENCY: {taxonomyResult.executionTimeMs} ms
                          </span>
                        )}
                      </div>
                      {taxonomyResult.error ? (
                        <p style={{ ...mono, margin: 0, fontSize: "0.72rem", color: "#f87171", whiteSpace: "pre-wrap" as const }}>
                          {taxonomyResult.error}
                        </p>
                      ) : (
                        <pre style={{ margin: 0, ...mono, fontSize: "0.72rem", color: "#4ade80", whiteSpace: "pre-wrap" as const }}>
                          {JSON.stringify(taxonomyResult.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
                  <div style={{ background: "#000", border: "1px solid #27272a", borderRadius: "4px", padding: "1rem", ...mono, fontSize: "0.73rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#52525b", marginBottom: "0.5rem" }}>
                      <span>// ORIGINAL_PAYLOAD (V1)</span>
                      <span style={{ color: "#f87171" }}>Fails on V2</span>
                    </div>
                    <pre style={{ margin: 0, color: "#f87171", lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>{JSON.stringify(selectedCase.before, null, 2)}</pre>
                  </div>

                  <div style={{ background: "#000", border: "1px solid #27272a", borderRadius: "4px", padding: "1rem", ...mono, fontSize: "0.73rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#52525b", marginBottom: "0.5rem" }}>
                      <span>// SYNTHESIZED_PAYLOAD (V2)</span>
                      <span style={{ color: "#4ade80" }}>Passes on V2</span>
                    </div>
                    <pre style={{ margin: 0, color: "#4ade80", lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>{JSON.stringify(selectedCase.after, null, 2)}</pre>
                  </div>
                </div>

                <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: "4px", padding: "0.9rem 1.1rem", display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                    <span style={{ ...mono, fontSize: "0.68rem", fontWeight: 700, color: "#fbbf24", textTransform: "uppercase" as const, minWidth: 100 }}>Blast Radius:</span>
                    <span style={{ fontSize: "0.8rem", color: "#e4e4e7" }}>{selectedCase.blastRadius}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                    <span style={{ ...mono, fontSize: "0.68rem", fontWeight: 700, color: "#4ade80", textTransform: "uppercase" as const, minWidth: 100 }}>Resolution:</span>
                    <span style={{ fontSize: "0.8rem", color: "#a1a1aa" }}>{selectedCase.resolution}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 04: Production Workflow Integrations */}
          <section id="integrations">
            <SectionHeading
              tag="DEPLOY // 04"
              label="Production Workflow Integration"
              sub="Drop MCPGuard into existing CI pipelines, agent SDKs, or regression test suites"
            />

            <div style={{ border: "1px solid #27272a", borderRadius: "6px", overflow: "hidden" }}>
              {/* Clean 3-button grid without horizontal scroll */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", background: "#0d0d10", borderBottom: "1px solid #27272a", padding: "0.25rem", gap: "0.25rem" }}>
                {INTEGRATION_MODES.map((mode, idx) => {
                  const isSelected = mode.id === activeIntegration;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setActiveIntegration(mode.id)}
                      style={{
                        background: isSelected ? "#18181b" : "transparent",
                        color: isSelected ? "#fafafa" : "#71717a",
                        border: "1px solid " + (isSelected ? "#3f3f46" : "transparent"),
                        borderRadius: "4px",
                        padding: "0.65rem 0.9rem",
                        fontSize: "0.75rem",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.45rem",
                      }}
                    >
                      <span>{idx + 1}. {mode.title}</span>
                      <Badge text={mode.badge} variant={isSelected ? "ok" : "neutral"} />
                    </button>
                  );
                })}
              </div>

              {/* Selected Mode Detail */}
              <div style={{ padding: "1.5rem", background: "#09090b", display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 700, color: "#fafafa" }}>{selectedIntegration.title}</h3>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#a1a1aa", lineHeight: 1.6 }}>{selectedIntegration.explanation}</p>
                </div>

                {/* Command Bar with Copy */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#121215", border: "1px solid #27272a", borderRadius: "4px", padding: "0.65rem 1rem" }}>
                  <code style={{ ...mono, fontSize: "0.75rem", color: "#e4e4e7" }}>{selectedIntegration.command}</code>
                  <button
                    onClick={() => handleCopy(selectedIntegration.command, `cmd-${selectedIntegration.id}`)}
                    style={{ background: "transparent", border: "1px solid #3f3f46", color: "#a1a1aa", borderRadius: "3px", padding: "0.25rem 0.6rem", fontSize: "0.68rem" }}
                  >
                    {copiedId === `cmd-${selectedIntegration.id}` ? "Copied" : "Copy"}
                  </button>
                </div>

                {/* Code Block with Copy */}
                <div style={{ background: "#000", border: "1px solid #27272a", borderRadius: "4px", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ ...mono, fontSize: "0.68rem", color: "#52525b" }}>// {selectedIntegration.filename}</span>
                    <button
                      onClick={() => handleCopy(selectedIntegration.snippet, `snip-${selectedIntegration.id}`)}
                      style={{ background: "transparent", border: "1px solid #3f3f46", color: "#a1a1aa", borderRadius: "3px", padding: "0.25rem 0.6rem", fontSize: "0.68rem" }}
                    >
                      {copiedId === `snip-${selectedIntegration.id}` ? "Copied" : "Copy Code"}
                    </button>
                  </div>
                  <pre style={{ margin: 0, ...mono, fontSize: "0.73rem", color: "#d4d4d8", lineHeight: 1.65, overflowX: "auto" }}>
                    {selectedIntegration.snippet}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 05: Live Analysis & Verification Workspace */}
          <section id="analysis-results" ref={resultsRef}>
            <SectionHeading
              tag="AUDIT // 05"
              label="Live Analysis Findings & Interactive Verification"
              sub="Results from in-memory schema diff and chained workflow replay against candidate V2"
            />

            {error && (
              <div style={{ border: "1px solid #7f1d1d", borderRadius: "6px", padding: "1rem 1.25rem", marginBottom: "1.5rem", background: "#450a0a" }}>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#f87171", fontWeight: 600 }}>Analysis error: {error}</p>
              </div>
            )}

            {/* Sleek Loader Bar when loading */}
            {loading && (
              <div style={{ border: "1px solid #27272a", borderRadius: "6px", overflow: "hidden", background: "#0d0d10" }}>
                <div style={{ height: "3px", width: "100%", background: "#1c1c20" }} className="loader-scanline" />
                <div style={{ padding: "2.5rem 2rem", textAlign: "center" as const }}>
                  <p style={{ ...mono, margin: 0, fontSize: "0.82rem", color: "#fafafa" }}>
                    // EXECUTING_CHAIN_REPLAY: DIFFING SCHEMAS & SIMULATING AGENTS...
                  </p>
                  <p style={{ ...mono, margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#52525b" }}>
                    TRANSPORT: IN_MEMORY // RESOLVING_PIPELINE_DEPENDENCIES
                  </p>
                </div>
              </div>
            )}

            {report && (
              <div style={{ display: "flex", flexDirection: "column" as const, gap: "2.5rem" }} className="animate-fade-in">

                {/* Filter Selector & Counts Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "0.75rem", background: "#0d0d10", border: "1px solid #27272a", borderRadius: "6px", padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: "#fafafa" }}>VIEW_FILTER:</span>
                    {(["all", "failures", "fixes", "diffs"] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        onClick={() => setResultFilter(filterKey)}
                        style={{
                          background: resultFilter === filterKey ? "#27272a" : "transparent",
                          color: resultFilter === filterKey ? "#fafafa" : "#71717a",
                          border: "1px solid #3f3f46",
                          borderRadius: "3px",
                          padding: "0.25rem 0.65rem",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          textTransform: "uppercase" as const,
                          cursor: "pointer",
                        }}
                      >
                        {filterKey}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ ...mono, fontSize: "0.7rem", color: "#71717a" }}>REPLAY_TOTAL: {report.summary.total}</span>
                    <span style={{ color: "#3f3f46" }}>•</span>
                    <span style={{ ...mono, fontSize: "0.7rem", color: report.summary.failed > 0 ? "#f87171" : "#4ade80" }}>
                      FAILURES: {report.summary.failed}
                    </span>
                  </div>
                </div>

                {/* Metrics Summary Strip */}
                {(resultFilter === "all" || resultFilter === "failures") && (
                  <div>
                    <p style={{ ...mono, margin: "0 0 0.5rem", fontSize: "0.68rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.08em" }}>
                      METRIC_SUMMARY
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", ...gridBorder }}>
                      {[
                        { label: "Total Replays", value: report.summary.total, color: "#fafafa" },
                        { label: "Passed Baseline", value: report.summary.passed, color: "#4ade80" },
                        { label: "Failed Candidate", value: report.summary.failed, color: "#f87171" },
                        { label: "Breaking Diffs", value: report.summary.breakingChanges, color: "#fbbf24" },
                        { label: "Impacted Chains", value: report.summary.impactedWorkflowsCount, color: "#f87171" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ ...cell, padding: "1.25rem 1rem" }}>
                          <p style={{ ...mono, margin: "0 0 0.2rem", fontSize: "1.5rem", fontWeight: 800, color }}>{value}</p>
                          <p style={{ ...mono, margin: 0, fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#52525b" }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Synthesized Fix Cards with UNCONSTRAINED PARAMETER FORMS */}
                {(resultFilter === "all" || resultFilter === "fixes") && report.suggestedFixes.length > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <p style={{ ...mono, margin: 0, fontSize: "0.68rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.08em" }}>
                        UNCONSTRAINED_FIX_SANDBOX_AND_VERIFICATION ({report.suggestedFixes.length})
                      </p>
                      <span style={{ ...mono, fontSize: "0.65rem", color: "#4ade80" }}>
                        UNRESTRICTED_DATA_TYPES_ACTIVE
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column" as const, ...gridBorder }}>
                      {report.suggestedFixes.map((fix, idx) => {
                        const key = `${fix.workflowId}-${fix.stepId}`;
                        const isVerifying = verifyingMap[key] || false;
                        const twoStage = twoStageResultMap[key];
                        const sandbox = fixSandboxMap[key] ?? {
                          mode: "fields" as const,
                          fields: payloadToFields(fix.fixedArgs),
                          rawJson: JSON.stringify(fix.fixedArgs, null, 2),
                        };

                        return (
                          <div
                            key={`${fix.workflowId}-${idx}`}
                            id={`fix-card-${fix.workflowId}-${fix.stepId}`}
                            style={{ ...cell, padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column" as const, gap: "1.25rem" }}
                          >
                            {/* Card Header */}
                            <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid #1c1c20", paddingBottom: "1rem" }}>
                              <div>
                                <p style={{ ...mono, margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: 700, color: "#52525b", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
                                  TOOL: {fix.tool} // STEP: {fix.stepId}
                                </p>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#e4e4e7" }}>{fix.workflowId}</h3>
                              </div>
                              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                <Badge text={`CONFIDENCE: ${fix.confidence}`} variant={fix.confidence === "high" ? "ok" : "warn"} />
                                <Badge text={fix.ruleApplied} variant="neutral" />
                              </div>
                            </div>

                            {/* Diagnosis */}
                            <p style={{ margin: 0, fontSize: "0.82rem", color: "#a1a1aa", lineHeight: 1.65 }}>{fix.explanation}</p>

                            {/* Suggested Diff Display */}
                            <div style={{ background: "#000", border: "1px solid #27272a", borderRadius: "4px", padding: "0.85rem 1rem", ...mono, fontSize: "0.73rem" }}>
                              <p style={{ margin: "0 0 0.4rem", color: "#52525b" }}>// SYNTHESIZED_ARGUMENT_DIFF</p>
                              <pre style={{ margin: 0, color: "#4ade80", whiteSpace: "pre-wrap" as const, lineHeight: 1.6 }}>{fix.diffSummary}</pre>
                            </div>

                            {/* UNCONSTRAINED PARAMETER SANDBOX (LIVE FORM) */}
                            <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: "4px", padding: "1.1rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", borderBottom: "1px solid #1c1c20", paddingBottom: "0.6rem" }}>
                                <div>
                                  <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: "#fafafa" }}>
                                    UNCONSTRAINED_SANDBOX // TOOL: {fix.tool}
                                  </span>
                                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.72rem", color: "#71717a" }}>
                                    Type strings, numbers, or booleans. Switch to Raw JSON or toggle parameter types to test schema rejection.
                                  </p>
                                </div>
                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                  <button
                                    onClick={() => resetFixSandbox(key, fix)}
                                    style={{ background: "transparent", border: "1px solid #3f3f46", color: "#a1a1aa", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                                  >
                                    Reset
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Force first number parameter to string type to simulate schema failure!
                                      const updated = sandbox.fields.map((f, i) =>
                                        i === 0 ? { ...f, type: "string" as const, value: String(f.value) } : f,
                                      );
                                      setFixSandboxMap((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...sandbox,
                                          fields: updated,
                                          rawJson: JSON.stringify(fieldsToPayload(updated), null, 2),
                                        },
                                      }));
                                    }}
                                    style={{ background: "transparent", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                                  >
                                    Send String Instead of Number
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFixSandboxMap((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...sandbox,
                                          mode: sandbox.mode === "fields" ? "json" : "fields",
                                        },
                                      }));
                                    }}
                                    style={{ background: "#18181b", border: "1px solid #3f3f46", color: "#fafafa", borderRadius: "3px", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}
                                  >
                                    {sandbox.mode === "fields" ? "Raw JSON Mode" : "Fields Mode"}
                                  </button>
                                </div>
                              </div>

                              {sandbox.mode === "json" ? (
                                /* Raw JSON Mode */
                                <div style={{ marginBottom: "1rem" }}>
                                  <textarea
                                    value={sandbox.rawJson}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      let flds = sandbox.fields;
                                      try {
                                        flds = payloadToFields(JSON.parse(raw));
                                      } catch {
                                        // ignore parse error while typing
                                      }
                                      setFixSandboxMap((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...sandbox,
                                          rawJson: raw,
                                          fields: flds,
                                        },
                                      }));
                                    }}
                                    rows={5}
                                    style={{
                                      width: "100%",
                                      background: "#000",
                                      border: "1px solid #3f3f46",
                                      borderRadius: "4px",
                                      color: "#fafafa",
                                      ...mono,
                                      fontSize: "0.75rem",
                                      padding: "0.75rem",
                                      outline: "none",
                                      resize: "vertical" as const,
                                    }}
                                  />
                                </div>
                              ) : (
                                /* Form Field Inputs (UNCONSTRAINED TEXT INPUTS + TYPE SELECTORS) */
                                <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem", marginBottom: "1rem" }}>
                                  {sandbox.fields.map((f) => (
                                    <div
                                      key={f.id}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "150px 105px 1fr 65px 24px",
                                        gap: "0.5rem",
                                        alignItems: "center",
                                        background: "#000",
                                        padding: "0.5rem 0.75rem",
                                        border: "1px solid #1c1c20",
                                        borderRadius: "4px",
                                      }}
                                    >
                                      {/* Parameter Name (Editable!) */}
                                      <input
                                        type="text"
                                        placeholder="param_name"
                                        value={f.key}
                                        onChange={(e) => updateFixField(key, f.id, { key: e.target.value })}
                                        style={{
                                          background: "#121215",
                                          border: "1px solid #27272a",
                                          borderRadius: "3px",
                                          padding: "0.35rem 0.5rem",
                                          color: "#fafafa",
                                          ...mono,
                                          fontSize: "0.72rem",
                                          outline: "none",
                                        }}
                                      />

                                      {/* Data Type Selector (Defaults to auto: allows typing any data type!) */}
                                      <select
                                        value={f.type}
                                        onChange={(e) =>
                                          updateFixField(key, f.id, {
                                            type: e.target.value as SandboxField["type"],
                                          })
                                        }
                                        style={{
                                          background: "#121215",
                                          border: "1px solid #27272a",
                                          borderRadius: "3px",
                                          padding: "0.35rem 0.4rem",
                                          color: "#a1a1aa",
                                          ...mono,
                                          fontSize: "0.7rem",
                                          outline: "none",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <option value="auto">auto</option>
                                        <option value="string">string</option>
                                        <option value="number">number</option>
                                        <option value="boolean">boolean</option>
                                        <option value="json">json</option>
                                        <option value="null">null</option>
                                      </select>

                                      {/* Unconstrained Value Input (type="text", allows any text or types!) */}
                                      <input
                                        type="text"
                                        placeholder="any value (numbers, letters, json, bool)"
                                        value={f.value}
                                        onChange={(e) => updateFixField(key, f.id, { value: e.target.value })}
                                        style={{
                                          background: "#121215",
                                          border: "1px solid #27272a",
                                          borderRadius: "3px",
                                          padding: "0.35rem 0.5rem",
                                          color: "#fafafa",
                                          ...mono,
                                          fontSize: "0.72rem",
                                          outline: "none",
                                        }}
                                      />

                                      {/* Real-time Detected/Resolved Type Indicator */}
                                      <span
                                        style={{
                                          ...mono,
                                          fontSize: "0.62rem",
                                          color: "#71717a",
                                          background: "#121215",
                                          border: "1px solid #27272a",
                                          borderRadius: "3px",
                                          padding: "0.2rem 0.35rem",
                                          textAlign: "center",
                                          textOverflow: "ellipsis",
                                          overflow: "hidden",
                                          whiteSpace: "nowrap",
                                        }}
                                        title={`Resolved runtime type: ${getEffectiveType(f.value, f.type)}`}
                                      >
                                        :{getEffectiveType(f.value, f.type)}
                                      </span>

                                      {/* Remove button */}
                                      <button
                                        onClick={() => removeFixField(key, f.id)}
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: "#71717a",
                                          fontSize: "0.8rem",
                                          cursor: "pointer",
                                          padding: "0.2rem",
                                        }}
                                        title="Remove parameter"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}

                                  {/* Add parameter button */}
                                  <button
                                    onClick={() => addFixField(key)}
                                    style={{
                                      alignSelf: "flex-start" as const,
                                      background: "transparent",
                                      border: "1px dashed #3f3f46",
                                      color: "#a1a1aa",
                                      borderRadius: "4px",
                                      padding: "0.35rem 0.8rem",
                                      fontSize: "0.7rem",
                                      ...mono,
                                      cursor: "pointer",
                                    }}
                                  >
                                    + Add Custom Parameter
                                  </button>
                                </div>
                              )}

                              {/* Verification Action Button */}
                              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                <button
                                  id={`verify-fix-${idx}`}
                                  onClick={() => handleVerifyFix(fix)}
                                  disabled={isVerifying}
                                  style={{
                                    padding: "0.6rem 1.4rem",
                                    background: isVerifying ? "#27272a" : "#fafafa",
                                    color: isVerifying ? "#71717a" : "#09090b",
                                    border: "none",
                                    borderRadius: "4px",
                                    fontWeight: 700,
                                    fontSize: "0.8rem",
                                    cursor: isVerifying ? "not-allowed" : "pointer",
                                    letterSpacing: "0.02em",
                                  }}
                                >
                                  {isVerifying ? "Executing Two-Stage Verification..." : "Run Two-Stage Verification"}
                                </button>
                                <span style={{ ...mono, fontSize: "0.68rem", color: "#52525b" }}>
                                  Stage 1: Tool Isolation // Stage 2: Full Chain
                                </span>
                              </div>
                            </div>

                            {/* SLEEK LOADER DURING VERIFICATION */}
                            {isVerifying && (
                              <div style={{ border: "1px solid #27272a", borderRadius: "4px", overflow: "hidden", background: "#000" }}>
                                <div style={{ height: "2px", width: "100%", background: "#1c1c20" }} className="loader-scanline" />
                                <div style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ ...mono, fontSize: "0.72rem", color: "#fafafa" }}>
                                    STAGE 1: TESTING ISOLATED TOOL ({fix.tool}) AGAINST V2...
                                  </span>
                                  <span style={{ ...mono, fontSize: "0.68rem", color: "#71717a" }}>IN_PROGRESS</span>
                                </div>
                              </div>
                            )}

                            {/* TWO-STAGE VERIFICATION REPORT DRAWER */}
                            {twoStage && !isVerifying && (
                              <div
                                style={{
                                  border: `1px solid ${twoStage.verified ? "#166534" : "#7f1d1d"}`,
                                  borderRadius: "4px",
                                  background: "#09090b",
                                  overflow: "hidden",
                                }}
                                className="animate-fade-in"
                              >
                                {/* Verification Status Header */}
                                <div
                                  style={{
                                    padding: "0.75rem 1rem",
                                    background: twoStage.verified ? "#052e16" : "#450a0a",
                                    borderBottom: `1px solid ${twoStage.verified ? "#166534" : "#7f1d1d"}`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span style={{ ...mono, fontSize: "0.75rem", fontWeight: 700, color: twoStage.verified ? "#4ade80" : "#f87171" }}>
                                    {twoStage.message}
                                  </span>
                                  <Badge text={twoStage.verified ? "VERIFIED" : "FAILED"} variant={twoStage.verified ? "ok" : "fail"} />
                                </div>

                                <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column" as const, gap: "1rem" }}>
                                  {/* STAGE 1 DETAIL: Tool Isolation Unit Test */}
                                  <div style={{ border: "1px solid #27272a", borderRadius: "4px", padding: "0.9rem", background: "#0d0d10" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: "#fafafa" }}>
                                          STAGE 1 // TOOL ISOLATION UNIT TEST
                                        </span>
                                        <Badge text={twoStage.stage1.status} variant={twoStage.stage1.status === "passed" ? "ok" : "fail"} />
                                      </div>
                                      <span style={{ ...mono, fontSize: "0.68rem", color: "#71717a" }}>
                                        LATENCY: {twoStage.stage1.executionTimeMs} ms
                                      </span>
                                    </div>

                                    <div style={{ ...mono, fontSize: "0.72rem", color: "#a1a1aa", marginBottom: "0.4rem" }}>
                                      Target: Candidate V2 Server // Tool: {twoStage.stage1.tool}
                                    </div>

                                    {twoStage.stage1.error ? (
                                      <p style={{ ...mono, margin: 0, fontSize: "0.72rem", color: "#f87171" }}>
                                        Error: {twoStage.stage1.error}
                                      </p>
                                    ) : (
                                      <div style={{ background: "#000", border: "1px solid #1c1c20", borderRadius: "3px", padding: "0.75rem", marginTop: "0.4rem" }}>
                                        <span style={{ ...mono, fontSize: "0.65rem", color: "#52525b" }}>// MCP Server JSON-RPC Response Content:</span>
                                        <pre style={{ margin: "0.3rem 0 0", ...mono, fontSize: "0.72rem", color: "#4ade80", whiteSpace: "pre-wrap" as const }}>
                                          {JSON.stringify(twoStage.stage1.output, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>

                                  {/* STAGE 2 DETAIL: Full Downstream Agent Chain Replay */}
                                  <div style={{ border: "1px solid #27272a", borderRadius: "4px", padding: "0.9rem", background: "#0d0d10" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <span style={{ ...mono, fontSize: "0.7rem", fontWeight: 700, color: "#fafafa" }}>
                                          STAGE 2 // DOWNSTREAM AGENT CHAIN REPLAY
                                        </span>
                                        <Badge text={twoStage.stage2.status} variant={twoStage.stage2.status === "passed" ? "ok" : "fail"} />
                                      </div>
                                      <span style={{ ...mono, fontSize: "0.68rem", color: "#71717a" }}>
                                        UNBLOCKED: {twoStage.stage2.unblockedSteps} / {twoStage.stage2.totalSteps} STEPS
                                      </span>
                                    </div>

                                    {/* Step by step progression pills */}
                                    <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.4rem", marginTop: "0.5rem" }}>
                                      {twoStage.stage2.stepResults.map((step, sIdx) => (
                                        <div
                                          key={step.stepId}
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "0.4rem 0.6rem",
                                            background: "#000",
                                            border: "1px solid #1c1c20",
                                            borderRadius: "3px",
                                            opacity: step.status === "skipped" ? 0.45 : 1,
                                          }}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ ...mono, fontSize: "0.65rem", color: "#52525b" }}>{sIdx + 1}.</span>
                                            <span style={{ ...mono, fontSize: "0.72rem", color: "#fafafa" }}>{step.tool}</span>
                                            <span style={{ fontSize: "0.7rem", color: "#71717a" }}>{step.description}</span>
                                          </div>
                                          <Badge text={step.status} variant={step.status === "passed" ? "ok" : step.status === "failed" ? "fail" : "neutral"} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Workflow Replay & Blast Radius */}
                {(resultFilter === "all" || resultFilter === "failures") && (
                  <div>
                    <p style={{ ...mono, margin: "0 0 0.5rem", fontSize: "0.68rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.08em" }}>
                      CHAIN_REPLAY_EXECUTION ({report.workflows.length})
                    </p>
                    <div style={{ display: "flex", flexDirection: "column" as const, ...gridBorder }}>
                      {report.workflows.map((wf, index) => (
                        <div key={`${wf.name}-${index}`} style={{ ...cell }}>
                          <div style={{ display: "flex", flexWrap: "wrap" as const, alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid #18181b" }}>
                            <div>
                              <h3 style={{ margin: "0 0 0.2rem", fontSize: "0.9rem", fontWeight: 700, color: "#e4e4e7" }}>{wf.name}</h3>
                              <p style={{ ...mono, margin: 0, fontSize: "0.72rem", color: "#52525b" }}>{wf.message}</p>
                            </div>
                            <Badge text={wf.status} variant={wf.status === "passed" ? "ok" : "fail"} />
                          </div>
                          <div style={{ padding: "0.75rem 1.25rem 1rem" }}>
                            {wf.stepResults.map((step, sIdx) => (
                              <div
                                key={`${step.stepId}-${sIdx}`}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: "1rem",
                                  padding: "0.65rem 0",
                                  borderBottom: sIdx < wf.stepResults.length - 1 ? "1px solid #18181b" : "none",
                                  opacity: step.status === "skipped" ? 0.4 : 1,
                                }}
                              >
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" as const }}>
                                    <span style={{ ...mono, fontSize: "0.68rem", color: "#52525b", fontWeight: 700 }}>{sIdx + 1}.</span>
                                    <span style={{ ...mono, fontSize: "0.78rem", fontWeight: 700, color: "#e4e4e7" }}>{step.tool}</span>
                                    <span style={{ fontSize: "0.75rem", color: "#71717a" }}>{step.description}</span>
                                  </div>
                                  <div style={{ ...mono, marginTop: "0.3rem", fontSize: "0.68rem", color: "#52525b" }}>{JSON.stringify(step.args)}</div>
                                  {step.error && (
                                    <p style={{ ...mono, margin: "0.3rem 0 0", fontSize: "0.72rem", color: "#f87171", fontWeight: 600 }}>
                                      {step.error}
                                    </p>
                                  )}
                                </div>
                                <Badge text={step.status} variant={step.status === "passed" ? "ok" : step.status === "failed" ? "fail" : "neutral"} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schema Diff Matrix */}
                {(resultFilter === "all" || resultFilter === "diffs") && (
                  <div>
                    <p style={{ ...mono, margin: "0 0 0.5rem", fontSize: "0.68rem", fontWeight: 700, color: "#71717a", letterSpacing: "0.08em" }}>
                      STRUCTURAL_SCHEMA_DIFF ({report.changes.length})
                    </p>
                    <div style={{ border: "1px solid #27272a", borderRadius: "6px", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #27272a" }}>
                            {["Tool", "Mutation Kind", "Parameter", "V1 (Before)", "V2 (After)", "Severity"].map((h) => (
                              <th key={h} style={{ padding: "0.65rem 0.9rem", textAlign: "left" as const, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#52525b", background: "#0d0d10" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.changes.map((change, index) => (
                            <tr key={`${change.tool}-${index}`} style={{ borderBottom: index < report.changes.length - 1 ? "1px solid #18181b" : "none", background: "#09090b" }}>
                              <td style={{ ...mono, padding: "0.65rem 0.9rem", fontSize: "0.78rem", fontWeight: 700, color: "#e4e4e7" }}>{change.tool}</td>
                              <td style={{ ...mono, padding: "0.65rem 0.9rem", fontSize: "0.73rem", color: "#a1a1aa" }}>{change.kind}</td>
                              <td style={{ ...mono, padding: "0.65rem 0.9rem", fontSize: "0.73rem", color: "#71717a" }}>{change.parameter ?? "—"}</td>
                              <td style={{ ...mono, padding: "0.65rem 0.9rem", fontSize: "0.73rem", color: "#71717a" }}>{change.before ?? "—"}</td>
                              <td style={{ ...mono, padding: "0.65rem 0.9rem", fontSize: "0.73rem", color: "#a1a1aa" }}>{change.after ?? "—"}</td>
                              <td style={{ padding: "0.65rem 0.9rem" }}>
                                <Badge text={change.severity} variant={change.severity === "breaking" ? "fail" : "ok"} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </section>

          {/* Footer */}
          <footer style={{ paddingTop: "2rem", borderTop: "1px solid #27272a", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: "1rem" }}>
            <span style={{ ...mono, fontSize: "0.72rem", color: "#52525b" }}>MCPGuard — Contract Verification for Model Context Protocol</span>
            <span style={{ ...mono, fontSize: "0.72rem", color: "#3f3f46" }}>ZERO_NETWORK_OVERHEAD // RULE_FIRST_LLM_FALLBACK</span>
          </footer>

        </div>
      </div>
    </main>
  );
}
