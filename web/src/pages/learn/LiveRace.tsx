import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '../../components/Badge';
import { formatMs } from '../../lib/format';
import { race, type RaceResult, type RaceToken } from '../../live/api';
import { useLive } from '../../live/LiveContext';
import type { Lesson } from './useLesson';

const LANES = [
  { key: 'no_cache', name: 'No cache', className: 'race-lane--none' },
  { key: 'dynamic', name: 'With a KV cache', className: 'race-lane--cache' },
] as const;

/** Cumulative time at which each token appeared. */
function arrivalTimes(tokens: RaceToken[]): number[] {
  let t = 0;
  return tokens.map((token) => (t += token.ms));
}

/** Replays a measured run at its real speed: token i appears at the moment it was produced. */
function useReplay(result: RaceResult | null) {
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef<number>();
  const end = result ? Math.max(...LANES.map((l) => arrivalTimes(result[l.key]).at(-1) ?? 0)) : 0;

  const play = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const e = now - start;
      setElapsed(Math.min(e, end));
      if (e < end) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [end]);

  // Start the replay as soon as a new result arrives.
  useEffect(() => {
    if (result) play();
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [result, play]);

  return { elapsed, end, play };
}

export function LiveRace({ lesson }: { lesson: Lesson }) {
  const live = useLive();
  const [result, setResult] = useState<RaceResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');
  const { elapsed, end, play } = useReplay(result);

  const start = async () => {
    setStatus('running');
    try {
      setResult(await race(lesson.system, lesson.questionA));
      setStatus('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  if (!live) {
    return (
      <p className="notice small">
        Start the model server (<span className="mono">engine/server.py</span>) to race both on the real model.
      </p>
    );
  }

  return (
    <div className="card lesson-card race">
      <div className="figure-head">
        <p className="figure-head__title">Race them on the real model</p>
        {result && <Badge kind="measured">Measured on {result.gpu}</Badge>}
      </div>
      <p className="small muted">
        Runs your prompt both ways until the model finishes its answer, times every token, then replays both side by side
        at the speed they were really produced. Without a cache, long answers take a while.
      </p>
      <div className="button-row">
        <button type="button" className="btn btn--primary" onClick={start} disabled={status === 'running'}>
          {status === 'running' ? 'Running on the model…' : result ? 'Run again' : 'Start the race'}
        </button>
        {result && (
          <button type="button" className="btn btn--secondary" onClick={play} disabled={status === 'running'}>
            Replay
          </button>
        )}
      </div>
      {status === 'error' && <p className="field__error">{error}</p>}

      {result &&
        LANES.map((lane) => {
          const tokens = result[lane.key];
          const times = arrivalTimes(tokens);
          const shown = times.filter((t) => t <= elapsed).length;
          const done = shown === tokens.length;
          const after = tokens.slice(1);
          return (
            <div key={lane.key} className={`race-lane ${lane.className}`}>
              <div className="race-lane__head">
                <strong>{lane.name}</strong>
                <span className="mono small">
                  {done ? `done in ${formatMs(times.at(-1)!)}` : `${shown} / ${tokens.length} tokens`}
                </span>
              </div>
              <p className="race-lane__text" aria-live="off">
                {tokens.slice(0, shown).map((t) => t.text).join('')}
                {!done && <span className="lane__cursor" aria-hidden="true" />}
              </p>
              <div className="race-lane__bar" aria-hidden="true">
                <span style={{ width: `${end ? (Math.min(elapsed, times.at(-1)!) / end) * 100 : 0}%` }} />
              </div>
              {done && after.length > 0 && (
                <p className="small muted">
                  First token {formatMs(tokens[0].ms)} (reading the prompt), then {formatMs(after.reduce((s, t) => s + t.ms, 0) / after.length)} per
                  token.
                </p>
              )}
            </div>
          );
        })}
      {result && elapsed >= end && result.no_cache.map((t) => t.text).join('') !== result.dynamic.map((t) => t.text).join('') && (
        <p className="small callout">
          <strong>The two answers differ.</strong> That isn’t the cache being wrong. The GPU rounds every number to 16 bits,
          and reading saved keys and values adds them up in a slightly different order than recomputing them. When two next
          words are almost tied, that tiny difference can flip the pick, and the rest of the answer follows a new path.
        </p>
      )}
      {result && elapsed >= end && (
        <p className="sr-only" aria-live="polite">
          No cache took {formatMs(arrivalTimes(result.no_cache).at(-1)!)}; with a KV cache, {formatMs(arrivalTimes(result.dynamic).at(-1)!)}.
        </p>
      )}
    </div>
  );
}
