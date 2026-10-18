import { useEffect, useState } from 'react';
import { Badge } from '../../components/Badge';
import { ChartCard } from '../../components/charts/ChartCard';
import { LineChart } from '../../components/charts/LineChart';
import { WhiskerChart } from '../../components/charts/WhiskerChart';
import type { BenchmarkResult, Method, MethodResult } from '../../live/api';
import { formatMs } from '../../lib/format';
import { METHOD_INFO } from './methods';


const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function Headlines({ methods }: { methods: Record<Method, MethodResult> }) {
  const none = methods.no_cache;
  const cache = methods.dynamic;
  const prefix = methods.prefix_sharing;
  // Prefix sharing only helps questions that found the system prompt cached; the first one never does.
  const reused = prefix.per_question.map((q, i) => ({ q, c: cache.per_question[i] })).filter(({ q }) => q.cached_tokens > 0);
  const saved = reused.length ? Math.round((1 - sum(reused.map(({ q }) => q.ttft_ms)) / sum(reused.map(({ c }) => c.ttft_ms))) * 100) : 0;

  return (
    <div className="headline-row">
      <p className="headline">
        <span className="headline__value mono">{(none.ms_per_token / cache.ms_per_token).toFixed(1)}×</span>
        <span>
          faster per token with a KV cache: {formatMs(cache.ms_per_token)} instead of {formatMs(none.ms_per_token)}.
        </span>
      </p>
      {saved >= 1 && (
        <p className="headline">
          <span className="headline__value mono">{saved}%</span>
          <span>
            less waiting for the first word with prefix sharing, on the questions that found the system prompt already cached.
          </span>
        </p>
      )}
    </div>
  );
}

function LengthChart({ result }: { result: BenchmarkResult }) {
  const lengths = result.prompt_tokens;
  // Only meaningful when the questions differ a lot in length.
  if (Math.max(...lengths) < Math.min(...lengths) * 1.5) {
    return (
      <ChartCard title="Time per token vs. prompt length" badge={null}>
        <p className="muted small">
          Your questions are all about the same length. Click “Add a long question” and run again to see how a longer prompt
          slows down “No cache” but not the others.
        </p>
      </ChartCard>
    );
  }
  const series = result.methods.map((m) => ({
    id: m.method,
    ...METHOD_INFO[m.method],
    label: METHOD_INFO[m.method].name,
    points: m.per_question
      .filter((q) => q.ms_per_token != null)
      .map((q) => ({ x: q.prompt_tokens, y: q.ms_per_token! }))
      .sort((a, b) => a.x - b.x)
      .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x),
  }));
  return (
    <ChartCard
      title="Time per token vs. prompt length"
      badge={<Badge kind="measured">Measured on {result.gpu}</Badge>}
      caption={<p>Without a cache, every new token re-reads the whole prompt, so a longer prompt means slower tokens.</p>}
    >
      <LineChart series={series} label="Milliseconds per token for each method at each prompt length" xLabel="Prompt tokens" yLabel="ms per token" />
    </ChartCard>
  );
}

function sameAnswer(m: MethodResult): string {
  if (m.matches_no_cache === null) return 'Reference';
  return m.matches_no_cache ? 'Yes' : `From token ${m.first_difference}`;
}

/** An answer the safety stop cut off gets "…". */
const shown = (q: { answer: string; finished: boolean }) => (q.finished ? q.answer.trim() : `${q.answer.trim()}…`);

/** What the model actually wrote for each question, and which methods wrote something different. */
function Answers({ result, questions, system }: { result: BenchmarkResult; questions: string[]; system: string }) {
  // The KV cache wrote each whole answer; "No cache" only its first tokens.
  const main = result.methods.find((m) => m.method === 'dynamic')!;
  const noCache = result.methods.find((m) => m.method === 'no_cache')!;
  return (
    <section className="answers" aria-labelledby="answers-title">
      <h3 id="answers-title" className="card__title">The prompts and the model’s answers</h3>
      {system.trim() && (
        <p className="small muted">
          System prompt: <span className="answers__system">{system}</span>
        </p>
      )}
      <ol className="answers__list">
        {questions.map((question, i) => {
          const answer = main.per_question[i];
          const others = result.methods.filter((m) => m.method === 'static' || m.method === 'prefix_sharing');
          const differing = others.filter((m) => m.per_question[i]?.answer !== answer.answer);
          const start = noCache.per_question[i];
          const noCacheSame = answer.answer.trim().startsWith(start.answer.trim());
          return (
            <li key={i} className="card answers__item">
              <p className="answers__question">
                <span className="mono small muted">Q{i + 1} · {result.prompt_tokens[i]} tokens</span>
                {question.length > 280 ? `${question.slice(0, 280)}…` : question}
              </p>
              <p className="answers__answer">
                {shown(answer)}
                <span className="mono small muted"> · {answer.answer_tokens} tokens, written with the KV cache</span>
              </p>
              {differing.length === 0 ? (
                <p className="small muted">The static cache and prefix sharing wrote exactly this answer.</p>
              ) : (
                differing.map((m) => (
                  <p key={m.method} className="small answers__diff">
                    <strong>{METHOD_INFO[m.method].name}</strong> wrote ({m.per_question[i].answer_tokens} tokens): {shown(m.per_question[i])}
                  </p>
                ))
              )}
              {noCacheSame ? (
                <p className="small muted">No cache started the same way (its first {start.answer_tokens} tokens).</p>
              ) : (
                <p className="small answers__diff">
                  <strong>No cache</strong> started differently: {shown(start)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function BenchmarkResults({ result, questions, system }: { result: BenchmarkResult; questions: string[]; system: string }) {
  const methods = Object.fromEntries(result.methods.map((m) => [m.method, m])) as Record<Method, MethodResult>;
  const [href, setHref] = useState<string | null>(null);
  // Any two methods writing different text deserves the rounding explanation.
  const cached = result.methods.filter((m) => m.method !== 'no_cache');
  const differs =
    result.methods.some((m) => m.matches_no_cache === false) ||
    cached.some((m) => m.per_question.some((q, i) => q.answer !== cached[0].per_question[i].answer));

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  return (
    <section className="results" aria-labelledby="results-title">
      <h2 id="results-title" className="section__title">Results</h2>
      <p className="muted small">
        {result.model.split('/')[1]} on {result.gpu} · {result.prompt_tokens.length} question
        {result.prompt_tokens.length > 1 ? 's' : ''} · answers run until the model finishes · {result.repeats === 1 ? '1 run' : `median of ${result.repeats} runs`} after a
        warm-up · no cache timed on the first {result.no_cache_tokens} tokens
      </p>

      <Headlines methods={methods} />

      <div className="chart-grid">
        <ChartCard
          title="Time to first word"
          badge={<Badge kind="measured">Measured on {result.gpu}</Badge>}
        >
          <WhiskerChart
            label="Time to first word for each method"
            data={result.methods.map((m) => ({ label: METHOD_INFO[m.method].name, p50: m.ttft_ms_p50, p95: m.ttft_ms_p95, color: METHOD_INFO[m.method].color }))}
          />
        </ChartCard>
        <LengthChart result={result} />
      </div>

      <div className="table-scroll" role="region" aria-label="Results table" tabIndex={0}>
        <table className="results-table">
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">First word</th>
              <th scope="col">Each word after</th>
              <th scope="col">KV cache size</th>
              <th scope="col">Peak GPU memory</th>
              <th scope="col">Same as no cache (first {result.no_cache_tokens} tokens)</th>
            </tr>
          </thead>
          <tbody>
            {result.methods.map((m) => (
              <tr key={m.method}>
                <th scope="row">
                  <span className="swatch" style={{ background: METHOD_INFO[m.method].color }} aria-hidden="true" />
                  {METHOD_INFO[m.method].name}
                </th>
                <td className="mono">{formatMs(m.ttft_ms_p50)}</td>
                <td className="mono">{formatMs(m.ms_per_token)}</td>
                <td className="mono">{m.kv_cache_mib.toFixed(2)} MiB</td>
                <td className="mono">{Math.round(m.peak_memory_mib)} MiB</td>
                <td>{sameAnswer(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {differs && (
        <p className="callout small">
          <strong>Why can the answer change?</strong> The GPU rounds numbers to 16 bits, and reading from the cache adds them up
          in a slightly different order than recomputing does. When two next words are almost tied, that tiny difference can
          flip the pick. It isn’t a bug in the cache.
        </p>
      )}

      <Answers result={result} questions={questions} system={system} />

      {href && (
        <a className="btn btn--secondary" href={href} download="kv-playground-benchmark.json">
          Download the raw numbers
        </a>
      )}
    </section>
  );
}
