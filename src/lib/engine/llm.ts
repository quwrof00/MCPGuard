import Groq from 'groq-sdk';
import type { SchemaChange } from './schema-diff';
import { withTrace } from '../telemetry';

const MODEL = 'llama-3.1-8b-instant';

let _client: Groq | null = null;
function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _client = new Groq({ apiKey });
  }
  return _client;
}

export type LLMFixResult = {
  fixedArgs: Record<string, unknown>;
  explanation: string;
  diffSummary: string;
  confidence: 'medium';
};

/**
 * Fallback: when deterministic rules cannot match a schema change,
 * asks llama-3.1-8b-instant via Groq to reason about the diff and
 * propose a corrected argument payload.
 * Always returns null on any error — never blocks the deterministic path.
 */
export async function llmFallbackFix(params: {
  tool: string;
  args: Record<string, unknown>;
  errorMessage: string;
  changes: SchemaChange[];
}): Promise<LLMFixResult | null> {
  const { tool, args, errorMessage, changes } = params;
  const toolChanges = changes.filter((c) => c.tool === tool);

  const systemPrompt = [
    'You are an MCP (Model Context Protocol) schema migration expert.',
    'Your job is to produce a corrected JSON argument payload for a broken tool call.',
    'Rules:',
    '- Only change what is strictly necessary based on the schema diff provided.',
    '- Never invent fields that are not in the schema diff.',
    '- Respond ONLY with a valid JSON object with keys: fixedArgs, explanation, diffSummary.',
    '- No markdown, no code fences, no extra text.',
  ].join('\n');

  const userPrompt = [
    'Tool: ' + tool,
    'Original args: ' + JSON.stringify(args),
    'Error: ' + errorMessage,
    'Schema diff: ' + JSON.stringify(toolChanges),
    '',
    'Produce the minimal corrected argument payload.',
  ].join('\n');

  try {
    const chat = await withTrace("groq-schema-migration", "AGENT", {
      provider: "groq",
      model: MODEL,
      resolutionPath: "llm_fallback",
      tool,
      argumentKeys: Object.keys(args),
      schemaChangeCount: toolChanges.length,
    }, async () => getClient().chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }));

    const raw = (chat.choices[0]?.message?.content ?? '').trim();
    const parsed = JSON.parse(raw) as {
      fixedArgs?: Record<string, unknown>;
      explanation?: string;
      diffSummary?: string;
    };

    if (!parsed.fixedArgs || typeof parsed.fixedArgs !== 'object') return null;

    return {
      fixedArgs: parsed.fixedArgs,
      explanation: parsed.explanation ?? 'LLM-generated fix based on schema diff.',
      diffSummary: parsed.diffSummary ?? JSON.stringify(parsed.fixedArgs, null, 2),
      confidence: 'medium',
    };
  } catch {
    return null;
  }
}
