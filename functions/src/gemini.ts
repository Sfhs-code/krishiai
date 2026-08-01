import { CONFIG, hasGemini } from './config';

/**
 * Thin Gemini client over the REST API.
 *
 * Deliberately dependency-free: the generative-language endpoint is stable and
 * a direct fetch keeps the cold-start of these functions small, which matters
 * when the caller is a farmer on an intermittent connection.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class NoGeminiKey extends Error {
  constructor() {
    super('gemini-key-missing');
  }
}

export interface InlineImage {
  mimeType: string;
  data: string; // base64, no data: prefix
}

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GenerateOptions {
  system?: string;
  history?: { role: 'user' | 'assistant'; text: string }[];
  image?: InlineImage;
  /** Ask for strict JSON back. Pass the schema description in the prompt. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  if (!hasGemini()) throw new NoGeminiKey();

  const contents: { role: string; parts: Part[] }[] = [];

  for (const turn of opts.history ?? []) {
    contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] });
  }

  const parts: Part[] = [{ text: prompt }];
  if (opts.image) {
    parts.push({ inline_data: { mime_type: opts.image.mimeType, data: opts.image.data } });
  }
  contents.push({ role: 'user', parts });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
    safetySettings: [
      // Agricultural chemistry (pesticide dosing, poisoning first aid) trips
      // the default dangerous-content filter. These are legitimate, safety-
      // critical answers for a farmer, so the threshold is relaxed to BLOCK_ONLY_HIGH.
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);

  try {
    const res = await fetch(`${ENDPOINT}/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`gemini-${res.status}: ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (json.promptFeedback?.blockReason) {
      throw new Error(`gemini-blocked: ${json.promptFeedback.blockReason}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('gemini-empty-response');
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate and parse JSON. Gemini occasionally wraps JSON in a fenced block
 * even in JSON mode, so the fence is stripped before parsing.
 */
export async function generateJson<T>(prompt: string, opts: GenerateOptions = {}): Promise<T> {
  const raw = await generate(prompt, { ...opts, json: true });
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last resort: pull the outermost JSON object or array out of the text.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error('gemini-invalid-json');
  }
}

/** Shared persona. Short sentences, no jargon — this text gets read aloud. */
export function farmerSystemPrompt(language: string): string {
  return [
    'You are KrishiSathi, an agricultural extension advisor for smallholder farmers in India.',
    `Always reply in ${language}.`,
    'Your answers are read aloud to farmers who may not read well, so:',
    '- Use short, plain sentences. No markdown, no bullet symbols, no headings.',
    '- Lead with the action to take, then the reason.',
    '- Give exact quantities in local units (kg per acre, litres per acre, grams per litre of water).',
    '- Name products by their common Indian trade names where useful.',
    '- Keep the whole answer under 120 words unless the farmer asked for steps.',
    'Safety rules you must follow:',
    '- When you recommend any pesticide, always state the protective equipment and the pre-harvest interval.',
    '- Never recommend a pesticide banned in India.',
    '- If a question is about human or animal medical harm, tell them to call 1800-180-1551 or 108 first.',
    '- If you are not confident, say so plainly and suggest they visit the nearest Krishi Vigyan Kendra.',
  ].join('\n');
}
