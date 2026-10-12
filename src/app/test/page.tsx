"use client";

import { useMemo, useState } from "react";

type TestResult = { success: boolean; status: "passed" | "failed"; output?: unknown; error?: string; executionTimeMs?: number };
type Fix = { workflowId: string; stepId: string; tool: string; fixedArgs: Record<string, unknown>; explanation: string; confidence: string };
type Report = { summary: { total: number; passed: number; failed: number; breakingChanges: number; impactedWorkflowsCount: number }; changes: Array<{ tool: string; kind: string; parameter?: string; severity: string }>; workflows: Array<{ workflowId: string; name: string; target: string; status: string; stepResults: Array<{ tool: string; status: string; description: string; error?: string }> }>; suggestedFixes: Fix[] };
type Verification = { verified: boolean; message: string; stage1: { status: string; executionTimeMs: number }; stage2: { unblockedSteps: number; totalSteps: number } };
type AiFix = { path: string; model: string; deterministicRuleMatched: boolean; error: string; originalArgs: Record<string, unknown>; change: { tool: string; parameter?: string; before?: string; after?: string }; result: { fixedArgs: Record<string, unknown>; explanation: string; diffSummary: string; confidence: string } };

const tools: Record<string, { label: string; payload: Record<string, unknown> }> = {
  get_issue: { label: "Get issue", payload: { issue_number: 42 } },
  get_user: { label: "Get user", payload: { user_id: "usr_octocat" } },
  post_comment: { label: "Post comment", payload: { issue_number: 42, body: "Compatibility check passed.", notify_author: true } },
  list_repositories: { label: "List repositories", payload: { org: "mcpguard" } },
};

function Arrow() { return <svg viewBox="0 0 16 16"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" /></svg>; }
function Mark() { return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>; }

export default function TestPage() {
  const [tool, setTool] = useState("get_issue");
  const [payload, setPayload] = useState(JSON.stringify(tools.get_issue.payload, null, 2));
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [audit, setAudit] = useState<Report | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<Record<string, Verification>>({});
  const [aiFix, setAiFix] = useState<AiFix | null>(null);
  const [aiResolving, setAiResolving] = useState(false);
  const prettyPayload = useMemo(() => { try { return JSON.stringify(JSON.parse(payload), null, 2); } catch { return payload; } }, [payload]);

  function chooseTool(nextTool: string) { setTool(nextTool); setPayload(JSON.stringify(tools[nextTool].payload, null, 2)); setTestResult(null); }
  async function testPayload() {
    setTesting(true); setError(""); setTestResult(null);
    try { const args = JSON.parse(payload); const response = await fetch("/api/test-tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool, args }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Test could not be completed."); setTestResult(data); }
    catch (err) { setError(err instanceof Error ? err.message : "Payload must be valid JSON."); }
    finally { setTesting(false); }
  }
  async function runAudit() {
    setAuditing(true); setError("");
    try { const response = await fetch("/api/analyze", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Audit could not be completed."); setAudit(data); }
    catch (err) { setError(err instanceof Error ? err.message : "Audit could not be completed."); }
    finally { setAuditing(false); }
  }
  async function verifyFix(fix: Fix) {
    const key = `${fix.workflowId}-${fix.stepId}`; setVerifying(key); setError("");
    try { const response = await fetch("/api/verify-fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflowId: fix.workflowId, stepId: fix.stepId, fixedArgs: fix.fixedArgs }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Verification could not be completed."); setVerifications((current) => ({ ...current, [key]: data })); }
    catch (err) { setError(err instanceof Error ? err.message : "Verification could not be completed."); }
    finally { setVerifying(null); }
  }
  async function runAiFallback() {
    setAiResolving(true); setError(""); setAiFix(null);
    try { const response = await fetch("/api/ai-fix", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "AI fallback could not be completed."); setAiFix(data); }
    catch (err) { setError(err instanceof Error ? err.message : "AI fallback could not be completed."); }
    finally { setAiResolving(false); }
  }

  return <main className="test-page">
    <nav className="test-nav"><a className="brand" href="/"><Mark />MCPGuard</a><div><a href="/">Product</a><a className="active" href="/test">Test workspace</a></div><button onClick={runAudit}>{auditing ? "Running…" : "Run full audit"}</button></nav>
    <header className="test-header"><p className="eyebrow">Interactive compatibility workspace</p><h1>Test the release<br />before it ships.</h1><p>Exercise individual tool payloads, then run the full contract audit and verify generated migrations end to end.</p></header>
    {error && <div className="test-error">{error}</div>}
    <section className="tool-tester"><div className="tester-side"><p className="eyebrow dark">Isolated tool test</p><h2>Send a payload.</h2><p>Choose a registered tool, edit its JSON arguments, and run it against the candidate contract.</p><div className="tool-list">{Object.entries(tools).map(([id, item]) => <button className={tool === id ? "selected" : ""} key={id} onClick={() => chooseTool(id)}><span>{item.label}</span><code>{id}</code></button>)}</div></div><div className="payload-area"><div className="payload-title"><span>Arguments</span><code>{tool}</code></div><textarea value={payload} onChange={(event) => setPayload(event.target.value)} spellCheck={false} aria-label="JSON payload" /><div className="payload-actions"><button onClick={() => setPayload(prettyPayload)} className="quiet-button">Format JSON</button><button onClick={testPayload} className="test-button" disabled={testing}>{testing ? "Testing…" : "Test payload"} <Arrow /></button></div>{testResult && <div className={`test-output ${testResult.success ? "pass" : "fail"}`}><div><strong>{testResult.success ? "Request passed" : "Request failed"}</strong><span>{testResult.executionTimeMs !== undefined ? `${testResult.executionTimeMs}ms` : ""}</span></div><pre>{JSON.stringify(testResult.success ? testResult.output : { error: testResult.error }, null, 2)}</pre></div>}</div></section>
    <section className="ai-workspace"><div><p className="eyebrow">Non-deterministic migration</p><h2>Escalate ambiguous changes<br />to Groq.</h2><p>When no deterministic migration rule matches, MCPGuard records the fallback path and asks the configured Llama model for a minimal schema-safe payload.</p><dl><div><dt>Error</dt><dd><code>include_resolved</code> changed from string to boolean</dd></div><div><dt>Rule match</dt><dd>None — requires AI-assisted reasoning</dd></div><div><dt>Trace</dt><dd>Neatlogs AGENT span: <code>mcp-ai-fallback</code></dd></div></dl><button className="test-button" onClick={runAiFallback} disabled={aiResolving}>{aiResolving ? "Asking Groq…" : "Run AI-assisted fix"} <Arrow /></button></div>{aiFix && <div className="ai-result"><div><span>AI-assisted fallback</span><b>{aiFix.result.confidence} confidence</b></div><p>{aiFix.model}</p><pre>{JSON.stringify(aiFix.result.fixedArgs, null, 2)}</pre><p>{aiFix.result.explanation}</p><small>Deterministic rule matched: {String(aiFix.deterministicRuleMatched)}</small></div>}</section>
    <section className="audit-workspace"><div className="audit-workspace-head"><div><p className="eyebrow">Release audit</p><h2>Replay saved workflows.</h2><p>Run the full diff, blast-radius trace, and workflow replay. Results appear here only after a real audit runs.</p></div><button className="test-button" onClick={runAudit} disabled={auditing}>{auditing ? "Auditing…" : "Run audit"} <Arrow /></button></div>{!audit ? <div className="audit-empty">No audit has run in this session.</div> : <><div className="audit-summary"><div><b>{audit.summary.total}</b><span>workflow replays</span></div><div><b>{audit.summary.breakingChanges}</b><span>breaking changes</span></div><div><b>{audit.summary.impactedWorkflowsCount}</b><span>workflows at risk</span></div><div><b>{audit.summary.passed}</b><span>passing replays</span></div></div><div className="audit-detail-grid"><div className="audit-list"><h3>Workflow results</h3>{audit.workflows.map((workflow, index) => <article key={`${workflow.workflowId}-${workflow.target}-${index}`}><div><code>{workflow.name}</code><b className={workflow.status === "passed" ? "safe" : "breaking"}>{workflow.status}</b></div>{workflow.stepResults.map((step, stepIndex) => <p key={`${step.tool}-${stepIndex}`}><span className={`step-dot ${step.status}`} /><code>{step.tool}</code><em>{step.status}</em>{step.error && <small>{step.error}</small>}</p>)}</article>)}</div><div className="audit-list"><h3>Suggested migrations</h3>{audit.suggestedFixes.length === 0 ? <p className="audit-empty">No migrations required.</p> : audit.suggestedFixes.map((fix) => { const key = `${fix.workflowId}-${fix.stepId}`; const result = verifications[key]; return <article className="migration" key={key}><div><code>{fix.tool}</code><b>{fix.confidence}</b></div><p>{fix.explanation}</p><pre>{JSON.stringify(fix.fixedArgs, null, 2)}</pre><button onClick={() => verifyFix(fix)} disabled={verifying === key}>{verifying === key ? "Verifying…" : "Verify migration"} <Arrow /></button>{result && <div className={result.verified ? "verify-result pass" : "verify-result fail"}><strong>{result.verified ? "Verified" : "Needs review"}</strong><span>{result.message}</span><small>{result.stage1.status} in isolation · {result.stage2.unblockedSteps}/{result.stage2.totalSteps} workflow steps unblocked</small></div>}</article>; })}</div></div></>}</section>
  </main>;
}
