import type { TokenPiece } from '../data/types';

/*
 * Client for engine/server.py. Same origin by default (the dev server proxies /api);
 * set VITE_LAB_API at build time when the server runs elsewhere.
 */
const BASE = (import.meta.env.VITE_LAB_API ?? '').replace(/\/$/, '');

export interface Health {
  model: string;
  gpu: string;
  busy: boolean;
}

export type Method = 'no_cache' | 'dynamic' | 'static' | 'prefix_sharing';

export interface MethodResult {
  method: Method;
  ttft_ms_p50: number;
  ttft_ms_p95: number;
  ms_per_token: number;
  kv_cache_mib: number;
  peak_memory_mib: number;
  /** Share of prompt tokens found already cached (prefix sharing only). */
  reused_fraction: number;
  /** null for "no cache" itself. */
  matches_no_cache: boolean | null;
  first_difference: number | null;
  per_question: {
    prompt_tokens: number;
    cached_tokens: number;
    ttft_ms: number;
    ms_per_token: number | null;
    answer: string;
    answer_tokens: number;
    /** false if the safety stop cut the answer off before the model finished. */
    finished: boolean;
  }[];
}

export interface BenchmarkResult {
  model: string;
  gpu: string;
  repeats: number;
  /** "No cache" is timed on this many tokens of each answer (it slows down with every token). */
  no_cache_tokens: number;
  date: string;
  prompt_tokens: number[];
  methods: MethodResult[];
}

export type BenchmarkEvent =
  | { type: 'queued' }
  | { type: 'start'; method: Method; question: number; pass: number; done: number; total: number }
  | { type: 'token'; method: Method; question: number; text: string }
  | { type: 'result'; data: BenchmarkResult }
  | { type: 'error'; message: string };

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const detail = await response.json().then((d) => d.detail, () => null);
    throw new Error(typeof detail === 'string' ? detail : `The model server answered ${response.status}.`);
  }
  return response;
}

export async function fetchHealth(): Promise<Health | null> {
  try {
    const response = await fetch(`${BASE}/api/health`);
    return response.ok && response.headers.get('content-type')?.includes('json') ? await response.json() : null;
  } catch {
    return null;
  }
}

/** The model's whole greedy answer, as tokens. */
export async function generate(system: string, question: string, signal?: AbortSignal): Promise<TokenPiece[]> {
  return (await (await post('/api/generate', { system, question }, signal)).json()).tokens;
}

export interface RaceToken {
  text: string;
  /** Time to produce this token: the first one includes reading the prompt. */
  ms: number;
}

export interface RaceResult {
  gpu: string;
  prompt_tokens: number;
  no_cache: RaceToken[];
  dynamic: RaceToken[];
}

/** The whole answer with no cache and with a KV cache, every token timed. */
export async function race(system: string, question: string): Promise<RaceResult> {
  return (await post('/api/race', { system, question })).json();
}

/** A question written by the model to fit the given system prompt. */
export async function suggest(system: string): Promise<string> {
  return (await (await post('/api/suggest', { system })).json()).question;
}

/** Time every method on the given prompts. Calls onEvent for each streamed event. */
export async function runBenchmark(
  system: string,
  questions: string[],
  repeats: number,
  onEvent: (event: BenchmarkEvent) => void,
  signal: AbortSignal,
) {
  const response = await post('/api/benchmark', { system, questions, repeats }, signal);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Server-Sent Events: each event is "data: {json}" followed by a blank line.
    let split: number;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const line = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)));
    }
  }
}
