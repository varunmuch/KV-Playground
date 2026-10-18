import { useRef, useState } from 'react';
import { EXAMPLE_PROMPTS, LONG_QUESTION, randomExample } from '../../content/examplePrompts';
import { runBenchmark, suggest, type BenchmarkResult, type Method } from '../../live/api';
import { useLive } from '../../live/LiveContext';
import { METHOD_INFO } from './methods';

/** What the model is writing right now, shown while the benchmark runs. */
interface Current {
  method: Method;
  question: number;
  pass: number;
  text: string;
}

const MAX_QUESTIONS = 4;

export function BenchmarkForm({ onResult }: { onResult: (result: BenchmarkResult, questions: string[], system: string) => void }) {
  const live = useLive();
  const [system, setSystem] = useState(EXAMPLE_PROMPTS[0].system);
  const [questions, setQuestions] = useState<string[]>([...EXAMPLE_PROMPTS[0].questions]);
  const [repeats, setRepeats] = useState(1);
  const [status, setStatus] = useState<'idle' | 'running' | 'queued'>('idle');
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState<Current | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const running = status !== 'idle';

  const setQuestion = (i: number, text: string) => setQuestions(questions.map((q, j) => (j === i ? text : q)));
  const addQuestion = (text: string) => questions.length < MAX_QUESTIONS && setQuestions([...questions, text]);

  const random = () => {
    const example = randomExample();
    setSystem(example.system);
    setQuestions([...example.questions]);
  };

  const askModel = async () => {
    try {
      addQuestion(await suggest(system));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setStatus('running');
    setProgress(0);
    setCurrent(null);
    setError(null);
    const asked = questions.filter((q) => q.trim());
    try {
      await runBenchmark(
        system,
        asked,
        repeats,
        (event) => {
          if (event.type === 'queued') setStatus('queued');
          if (event.type === 'start') {
            setStatus('running');
            setProgress(event.done / event.total);
            setCurrent({ method: event.method, question: event.question, pass: event.pass, text: '' });
          }
          if (event.type === 'token') setCurrent((c) => (c ? { ...c, text: c.text + event.text } : c));
          if (event.type === 'result') onResult(event.data, asked, system);
          if (event.type === 'error') setError(event.message);
        },
        abort.signal,
      );
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus('idle');
      setCurrent(null);
    }
  };

  return (
    <section className="card bench-form" aria-labelledby="bench-form-title">
      <h2 id="bench-form-title" className="card__title">Your prompts</h2>
      <p className="muted small">
        Each method answers every question in full: a KV cache, a static cache and prefix sharing. “No cache” is the
        reference; because it slows down with every token, it’s timed on the first 16 tokens of each answer. Questions
        share the system prompt, so prefix sharing can reuse it.
      </p>

      {!live && (
        <p className="notice small">
          This needs the model server. On the machine with the GPU, run <span className="mono">cd engine && .venv/bin/python server.py</span>.
          The page notices when it starts.
        </p>
      )}

      <div className="button-row">
        <button type="button" className="btn btn--secondary btn--small" onClick={random} disabled={running}>
          Random example
        </button>
        {live && (
          <button type="button" className="btn btn--secondary btn--small" onClick={askModel} disabled={running || questions.length >= MAX_QUESTIONS}>
            Let the model write a question
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--small" onClick={() => addQuestion(LONG_QUESTION)} disabled={running || questions.length >= MAX_QUESTIONS || questions.includes(LONG_QUESTION)}>
          Add a long question
        </button>
      </div>

      <label className="field">
        <span className="field__label">System prompt</span>
        <textarea rows={2} value={system} onChange={(e) => setSystem(e.target.value)} disabled={running} />
      </label>

      <div className="bench-form__questions">
        {questions.map((q, i) => (
          <div key={i} className="field">
            <label className="field__label" htmlFor={`question-${i}`}>
              Question {i + 1}
            </label>
            <textarea id={`question-${i}`} rows={2} value={q} onChange={(e) => setQuestion(i, e.target.value)} disabled={running} />
            {questions.length > 1 && (
              <button type="button" className="btn btn--secondary btn--small" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} disabled={running}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {questions.length < MAX_QUESTIONS && (
        <button type="button" className="btn btn--secondary btn--small bench-form__add" onClick={() => addQuestion('')} disabled={running}>
          Add a question
        </button>
      )}

      <div className="control-row" role="group" aria-label="How many measured runs">
        <span className="control-row__label">Runs</span>
        <button type="button" className="btn btn--small" aria-pressed={repeats === 1} onClick={() => setRepeats(1)} disabled={running}>
          Quick · 1 run
        </button>
        <button type="button" className="btn btn--small" aria-pressed={repeats === 3} onClick={() => setRepeats(3)} disabled={running}>
          Steadier · 3 runs
        </button>
      </div>

      <div className="button-row">
        {running ? (
          <button type="button" className="btn btn--secondary" onClick={() => controller.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={run} disabled={!live || !questions.some((q) => q.trim())}>
            Run benchmark
          </button>
        )}
        {status === 'queued' && <span className="muted small">Waiting for another run to finish…</span>}
        {status === 'running' && <span className="muted small">{Math.round(progress * 100)}% done</span>}
      </div>
      {running && (
        <span className="progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      )}
      {current && (
        <div className="now-writing" aria-live="off">
          <p className="now-writing__head">
            <span className="swatch" style={{ background: METHOD_INFO[current.method].color }} aria-hidden="true" />
            <strong>{METHOD_INFO[current.method].name}</strong>
            <span className="muted small">
              is answering question {current.question + 1}
              {repeats > 1 ? ` · run ${current.pass} of ${repeats}` : ''}
            </span>
          </p>
          <p className="now-writing__text">{current.text || '…'}</p>
          {current.method === 'no_cache' && (
            <p className="small muted">No cache is slow: every new token re-reads the whole prompt. It’s timed on the first 16 tokens only.</p>
          )}
        </div>
      )}
      {error && <p className="field__error" role="alert">{error}</p>}
    </section>
  );
}
