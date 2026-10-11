import { init, trace, flush } from "neatlogs";

let initialized = false;

/**
 * Initializes neatlogs telemetry if NEATLOGS_API_KEY is provided.
 * Gracefully operates in mock/disabled mode if no key is present.
 */
export async function initTelemetry(): Promise<void> {
  if (initialized) return;

  const apiKey = process.env.NEATLOGS_API_KEY;
  try {
    if (apiKey) {
      await init({
        apiKey,
        workflowName: "mcp-guard",
      });
    } else {
      await init({
        apiKey: "mcp-guard-local-dev",
        workflowName: "mcp-guard",
        disableExport: true,
      });
    }
    initialized = true;
  } catch (err) {
    console.warn("[telemetry] neatlogs init warning:", err);
  }
}

/**
 * Executes a function within a neatlogs trace span.
 */
export async function withTrace<T>(
  name: string,
  kind: "WORKFLOW" | "AGENT" | "TOOL" | "GUARDRAIL",
  metadata: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  await initTelemetry();

  try {
    return await trace(
      {
        name,
        kind,
        attributes: {
          ...metadata,
          timestamp: new Date().toISOString(),
        },
      },
      async () => {
        return await fn();
      }
    );
  } catch (err) {
    // If tracing wrapper encounters issues, run raw function directly to ensure zero agent disruption
    console.warn(`[telemetry] Falling back to direct execution for ${name}:`, err);
    return await fn();
  }
}

/**
 * Flushes all pending telemetry spans to neatlogs.
 */
export async function flushTelemetry(): Promise<void> {
  try {
    await flush();
  } catch {
    // Ignore flush errors in dev
  }
}
