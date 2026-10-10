"use client";

import { useState } from "react";
import type { AnalysisReport } from "@/lib/engine/analyze";

export default function Home() {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runAnalysis() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-zinc-400">
              MCP COMPATIBILITY TESTING
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">MCP Guard</h1>
            <p className="mt-2 text-zinc-400">
              Find broken agent workflows before shipping tool updates.
            </p>
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading}
            className="rounded-lg bg-white px-5 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Run analysis"}
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">
            {error}
          </div>
        )}

        {!report && !loading && !error && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
            <h2 className="text-lg font-semibold">Ready to test</h2>
            <p className="mt-2 text-zinc-400">
              Compare MCP server v1 and v2, then replay a saved workflow against
              both versions.
            </p>
          </section>
        )}

        {loading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
            <p className="text-zinc-400 animate-pulse">
              Inspecting tools and replaying workflows...
            </p>
          </div>
        )}

        {report && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Executions", report.summary.total],
                ["Passed", report.summary.passed],
                ["Failed", report.summary.failed],
                ["Breaking changes", report.summary.breakingChanges],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
                >
                  <p className="text-sm text-zinc-400">{label}</p>
                  <p className="mt-2 text-3xl font-semibold">{value}</p>
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Schema changes</h2>

              {report.changes.length === 0 ? (
                <p className="text-zinc-400">No schema changes detected.</p>
              ) : (
                report.changes.map((change, index) => (
                  <div
                    key={`${change.tool}-${change.kind}-${index}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium font-mono text-zinc-200">
                        {change.tool}
                      </p>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                          change.severity === "breaking"
                            ? "bg-red-950/60 text-red-400 border border-red-800/60"
                            : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                        }`}
                      >
                        {change.severity}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-zinc-300">
                      {change.kind}
                      {change.parameter ? `: ${change.parameter}` : ""}
                    </p>

                    {(change.before || change.after) && (
                      <p className="mt-1 text-sm text-zinc-500 font-mono">
                        {change.before ?? "—"} → {change.after ?? "—"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Workflow results</h2>

              {report.workflows.map((workflow, index) => (
                <div
                  key={`${workflow.name}-${index}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{workflow.name}</p>
                    <span
                      className={`text-sm font-semibold ${
                        workflow.status === "passed"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {workflow.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-400">{workflow.message}</p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
