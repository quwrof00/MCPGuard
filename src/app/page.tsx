"use client";

import { useEffect, useState } from "react";

type Report = { summary: { total: number; passed: number; failed: number; breakingChanges: number; impactedWorkflowsCount: number }; changes: Array<{ tool: string; parameter?: string; kind: string; severity: string }>; workflows: Array<{ workflowId: string; name: string; target: "baseline" | "candidate"; status: "passed" | "failed"; message: string; stepResults: Array<{ stepId: string; tool: string; description: string; status: "passed" | "failed" | "skipped"; error?: string }> }>; suggestedFixes: Array<{ workflowId: string; stepId: string; tool: string; fixedArgs: Record<string, unknown>; explanation: string; confidence: string }> };
type Verification = { verified: boolean; message: string; stage1: { status: string; executionTimeMs: number }; stage2: { status: string; unblockedSteps: number; totalSteps: number } };
type Integrations = { neatlogs: boolean; groq: boolean; entire: boolean; cfo: boolean };

const Arrow = () => <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5" /></svg>;
function Mark() { return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>; }

export default function Home() {
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [report] = useState<Report | null>(null);
  const loading = false;
  const error = "";
  const verifying: string | null = null;
  const verifications: Record<string, Verification> = {};

  useEffect(() => {
    fetch("/api/integrations").then((response) => response.ok ? response.json() : null).then(setIntegrations).catch(() => setIntegrations(null));
  }, []);

  function runCheck() {
    window.location.assign("/test");
  }

  function verifyFix(_fix?: unknown) {
    window.location.assign("/test");
  }

  return <main>
    <section className="hero" id="top">
      <div className="hero-copy">
        <nav className="nav" aria-label="Main navigation">
          <a className="brand" href="#top"><Mark />MCPGuard</a>
          <div className="nav-links"><a href="#how-it-works">Product</a><a href="#checks">Checks</a><a href="#security">Security</a><a href="/test">Testing</a></div>
          <a className="nav-action" href="/test">Open tests</a>
        </nav>
        <div className="hero-content">
          <p className="eyebrow">MCP compatibility guardrails</p>
          <h1>Ship MCP updates<br />without breaking<br />your agents.</h1>
          <p className="hero-description">MCPGuard diffs tool contracts, replays your agent workflows, and pinpoints breaking changes before they reach production.</p>
          <button className="primary-button" onClick={runCheck} disabled={loading}>{loading ? "Checking contracts…" : "Run compatibility check"} <Arrow /></button>
        </div>
        <div className="hero-footer"><span className="rule" /><p>Find the broken call, understand the blast radius, and verify a safe payload migration.</p></div>
      </div>
      <div className="hero-visual" aria-label="MCPGuard analysis preview">
        <div className="contour contour-one" /><div className="contour contour-two" /><div className="contour contour-three" />
        <div className="scan-card"><div className="scan-top"><span className="status-dot" />Candidate server <span className="live">Analysed</span></div><div className="scan-title"><Mark /> github-mock <span>v2.0.0</span></div><div className="scan-row"><span>get_issue</span><b>issue_id</b><em>→</em><b>issue_number</b></div><div className="scan-row"><span>Expected type</span><b>string</b><em>→</em><b>number</b></div><div className="scan-result"><span className="break-icon">!</span> Breaking change found in saved workflow</div></div>
        <div className="activity-card"><Mark /><span>Replaying dependent agent steps…</span><strong>03</strong></div>
      </div>
    </section>

    <section className="light-section" id="how-it-works">
      <div className="center-intro"><p className="eyebrow dark">Fits the way you build</p><h2>Protect the contracts<br />your agents rely on.</h2><p>MCPGuard works from your existing server definitions and saved workflows. No production traffic, no network calls, no guesswork.</p></div>
      <div className="workflow-grid" aria-label="MCPGuard workflow"><article><span>01</span><h3>Inspect</h3><p>Read baseline and candidate MCP tool schemas.</p></article><article><span>02</span><h3>Diff</h3><p>Classify renamed, removed, and type-shifted parameters.</p></article><article className="workflow-feature"><Mark /><h3>Guard</h3><p>Replay dependent workflows and isolate the failure boundary.</p></article><article><span>03</span><h3>Repair</h3><p>Propose a payload migration and verify it before release.</p></article></div>
    </section>

    <section className="dark-section" id="checks">
      <div className="section-copy"><p className="eyebrow">A release check with context</p><h2>Review every tool change.<br />Act on what it breaks.</h2><p>Schema changes can fail an upstream call and starve every agent step after it. MCPGuard traces the impact through the full workflow—not just the changed tool.</p><button className="secondary-button" onClick={runCheck} disabled={loading}>{loading ? "Running…" : "Analyze this project"} <Arrow /></button></div>
      <div className="audit-preview"><div className="preview-header"><span><Mark /> MCPGuard</span><span>Compatibility audit</span></div><div className="preview-body"><aside><b>Overview</b><span>Tool contracts</span><span>Workflow replay</span><span>Suggested fixes</span></aside><div className="preview-content"><div className="preview-tabs"><b>Breaking changes</b><span>Safe changes</span><span>Workflows</span></div><h3>Candidate server report</h3><div className="change-line"><span className="red-dot" /> <code>get_issue</code><strong>Parameter renamed</strong><em>breaking</em></div><div className="change-line"><span className="red-dot" /> <code>post_comment</code><strong>Type changed</strong><em>breaking</em></div><div className="score"><span>Workflow coverage</span><b>3 saved workflows</b><i>2 at risk</i></div></div></div></div>
    </section>

    <section className="security" id="security"><div className="security-heading"><p className="eyebrow">Built for safe releases</p><h2>Keep compatibility<br />under control.</h2><p>MCPGuard evaluates changes in an isolated, in-memory transport and gives engineers an auditable answer before deployment.</p></div><div className="security-grid"><article><div className="icon-box">⌁</div><h3>In-memory replay</h3><p>Runs contract checks without opening ports or touching production systems.</p></article><article><div className="icon-box">↗</div><h3>Blast radius tracing</h3><p>Shows which saved workflows and downstream calls are affected.</p></article><article><div className="icon-box">✓</div><h3>Verified fixes</h3><p>Tests a proposed payload against the tool, then replays the complete workflow.</p></article><article><div className="icon-box">◈</div><h3>Deterministic first</h3><p>Uses explicit migration rules before escalating to assisted reasoning.</p></article></div></section>

    <section className="integrations" id="integrations">
      <div className="integration-intro"><p className="eyebrow">Connected release infrastructure</p><h2>Trace the decision.<br />Keep the evidence.</h2><p>Every compatibility action is grounded in the services and artifacts already configured for MCPGuard.</p></div>
      <div className="integration-grid">
        <article><span className={integrations?.neatlogs ? "integration-state on" : "integration-state"}>{integrations?.neatlogs ? "Active" : "Not configured"}</span><h3>Neatlogs</h3><p>Audit and verification requests emit workflow and guardrail traces through the live telemetry wrapper.</p></article>
        <article><span className={integrations?.groq ? "integration-state on" : "integration-state"}>{integrations?.groq ? "Ready" : "Not configured"}</span><h3>Groq</h3><p>Ambiguous contract migrations use the configured Llama fallback only after deterministic rules cannot resolve them.</p></article>
        <article><span className={integrations?.entire ? "integration-state on" : "integration-state"}>{integrations?.entire ? "Checkpoint configured" : "Not configured"}</span><h3>Entire</h3><p>Repository checkpoints and the dependency topology preserve provenance for compatibility decisions.</p></article>
        <article><span className={integrations?.cfo ? "integration-state on" : "integration-state"}>{integrations?.cfo ? "Plan available" : "Not found"}</span><h3>CFO model</h3><p>The current pricing, COGS, runway, and release economics are maintained in the business plan artifact.</p></article>
      </div>
    </section>

    <section className="results" id="results" aria-live="polite" hidden>
      {error && <p className="error-message">{error}</p>}
      {report && <><div className="results-heading"><div><p className="eyebrow">Live project result</p><h2>Compatibility report</h2></div><button className="outline-button" onClick={runCheck} disabled={loading}>Run again <Arrow /></button></div><div className="result-stats"><div><b>{report.summary.total}</b><span>workflow replays</span></div><div><b>{report.summary.breakingChanges}</b><span>breaking changes</span></div><div><b>{report.summary.impactedWorkflowsCount}</b><span>workflows at risk</span></div><div><b>{report.summary.passed}</b><span>replays passing</span></div></div><div className="result-table"><div className="table-title">Detected changes <span>{report.changes.length}</span></div>{report.changes.map((change, index) => <div className="result-row" key={`${change.tool}-${index}`}><code>{change.tool}</code><span>{change.kind.replaceAll("_", " ")}</span><span>{change.parameter || "Tool contract"}</span><b className={change.severity === "breaking" ? "breaking" : "safe"}>{change.severity}</b></div>)}</div>
      <div className="working-grid"><div className="work-panel"><div className="table-title">Workflow replays <span>{report.workflows.length}</span></div>{report.workflows.map((workflow) => <article className="workflow-result" key={`${workflow.workflowId}-${workflow.target}`}><div className="workflow-result-head"><div><code>{workflow.name}</code><p>{workflow.message}</p></div><b className={workflow.status === "passed" ? "safe" : "breaking"}>{workflow.status}</b></div><div className="step-list">{workflow.stepResults.map((step) => <div className="step" key={step.stepId}><span className={`step-dot ${step.status}`} /><code>{step.tool}</code><span>{step.description}</span><em>{step.status}</em>{step.error && <small>{step.error}</small>}</div>)}</div></article>)}</div>
      <div className="work-panel fixes"><div className="table-title">Suggested fixes <span>{report.suggestedFixes.length}</span></div>{report.suggestedFixes.length === 0 ? <p className="empty-state">No migration is needed for this release.</p> : report.suggestedFixes.map((fix) => { const key = `${fix.workflowId}-${fix.stepId}`; const result = verifications[key]; return <article className="fix-card" key={key}><div><code>{fix.tool}</code><b>{fix.confidence} confidence</b></div><p>{fix.explanation}</p><pre>{JSON.stringify(fix.fixedArgs, null, 2)}</pre><button className="verify-button" onClick={() => verifyFix(fix)} disabled={verifying === key}>{verifying === key ? "Verifying..." : "Verify fix"} <Arrow /></button>{result && <div className={`verification ${result.verified ? "verified" : "not-verified"}`}><strong>{result.verified ? "Verified" : "Needs review"}</strong><span>{result.message}</span><small>Isolated call: {result.stage1.status} · Workflow replay: {result.stage2.unblockedSteps}/{result.stage2.totalSteps} steps</small></div>}</article>; })}</div></div></>}
    </section>
    <footer><a className="brand" href="#top"><Mark />MCPGuard</a><p>Contract verification for Model Context Protocol.</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}
