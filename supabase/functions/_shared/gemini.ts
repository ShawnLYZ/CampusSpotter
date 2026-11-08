import { type JsonSchema, validateJson } from './jsonschema.ts';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GROUNDING_RE = /grounding|google_search|not (supported|available)|billing|permission/i;

export type GeminiErrorCode = 'http' | 'schema' | 'grounding_unavailable' | 'rate_limited';

export class GeminiError extends Error {
  code: GeminiErrorCode;
  status?: number;
  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

/** Overall time budget for one request, across every Gemini call and retry it makes. */
export const REQUEST_DEADLINE_MS = 130_000;
/** A retry is skipped when less than this remains of the deadline. */
export const MIN_RETRY_MS = 5_000;

/** Absolute deadline (epoch ms) for a request; create it once and pass it to every call. */
export const newDeadline = (budgetMs = REQUEST_DEADLINE_MS, now: () => number = Date.now): number => now() + budgetMs;

export type CallGeminiOptions = {
  apiKey: string;
  system: string;
  prompt: string;
  schema?: JsonSchema;
  tools?: unknown[];
  temperature?: number;
  fetchFn?: typeof fetch;
  model?: string;
  /** Epoch ms by which the whole request must finish. Default: now + REQUEST_DEADLINE_MS. */
  deadlineAt?: number;
  /** Smallest remaining budget that still allows a retry. Default MIN_RETRY_MS. */
  minRetryMs?: number;
  /** Clock, for tests. */
  now?: () => number;
};

// Returns parsed JSON or an error description (never includes the model text itself).
function parseReply(text: string, grounded: boolean): { value?: unknown; error?: string } {
  let raw = text;
  if (grounded) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) return { error: 'reply contains no JSON object' };
    raw = text.slice(start, end + 1);
  }
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: 'reply is not valid JSON' };
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return String(body?.error?.message ?? `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function callGemini<T>(opts: CallGeminiOptions): Promise<{ data: T; attempts: number; model: string }> {
  const { apiKey, system, prompt, schema, tools } = opts;
  const model = opts.model ?? GEMINI_MODEL;
  const fetchFn = opts.fetchFn ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const grounded = !!tools;
  const now = opts.now ?? Date.now;
  const deadlineAt = opts.deadlineAt ?? newDeadline(REQUEST_DEADLINE_MS, now);
  const minRetryMs = opts.minRetryMs ?? MIN_RETRY_MS;

  let userText = prompt;
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Each attempt may use whatever is left of the overall budget; a retry needs a useful amount left.
    const remaining = deadlineAt - now();
    if (remaining <= 0) throw new GeminiError('http', 'Gemini call timed out');
    if (attempt > 1 && remaining < minRetryMs) {
      throw new GeminiError('schema', `Gemini reply failed schema validation: ${lastErrors.slice(0, 3).join('; ')}`);
    }
    const generationConfig: Record<string, unknown> = { temperature: opts.temperature ?? 0.2 };
    if (!grounded) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseJsonSchema = schema;
    }
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig,
    };
    if (grounded) body.tools = tools;

    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(remaining),
      });
    } catch {
      throw new GeminiError('http', 'network error or timeout calling Gemini');
    }

    if (!res.ok) {
      const message = await errorMessage(res);
      if (res.status === 429) throw new GeminiError('rate_limited', message, 429);
      if (grounded && (res.status === 400 || res.status === 403) && GROUNDING_RE.test(message)) {
        throw new GeminiError('grounding_unavailable', message, res.status);
      }
      throw new GeminiError('http', message, res.status);
    }

    const envelope = await res.json().catch(() => null);
    const parts: unknown[] = envelope?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => (p as { text?: unknown })?.text)
      .filter((t): t is string => typeof t === 'string')
      .join('');

    const parsed = parseReply(text, grounded);
    if (parsed.error) {
      lastErrors = [parsed.error];
    } else {
      lastErrors = schema ? validateJson(schema, parsed.value) : [];
      if (lastErrors.length === 0) return { data: parsed.value as T, attempts: attempt, model };
    }

    userText = `${prompt}\n\nYour previous reply did not match the schema: ${lastErrors.slice(0, 3).join('; ')}. Reply again with JSON only.`;
  }

  throw new GeminiError('schema', `Gemini reply failed schema validation: ${lastErrors.slice(0, 3).join('; ')}`);
}
