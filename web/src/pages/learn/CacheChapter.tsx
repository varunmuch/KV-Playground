import { Link } from 'react-router-dom';
import { StepControls } from '../../components/StepControls';
import { tokenLabel } from '../../components/TokenChip';
import type { TokenPiece } from '../../data/types';
import { useStepper } from '../../hooks/useStepper';
import { formatInt } from '../../lib/format';
import { computedAtStep, computedThrough } from '../../simulator';
import { Term } from '../../components/Term';
import { Chapter } from './Chapter';
import { LiveRace } from './LiveRace';
import type { Lesson } from './useLesson';

function WorkRow({ tokens, step, cached, title }: { tokens: TokenPiece[]; step: number; cached: boolean; title: string }) {
  const promptLength = tokens.length - step;
  const thisStep = computedAtStep(promptLength, step, cached);
  return (
    <div className="work-row">
      <div className="work-row__head">
        <h3 className="work-row__title">{title}</h3>
        <p className="work-row__count mono">
          {formatInt(thisStep)} computed this step · {formatInt(computedThrough(promptLength, step, cached))} so far
        </p>
      </div>
      <div className="work-cells" aria-hidden="true">
        {tokens.map((token, i) => {
          const computedNow = step === 0 || !cached || i === tokens.length - 1;
          return (
            <span key={i} className={`work-cell ${computedNow ? 'work-cell--computed' : 'work-cell--cached'}`} title={tokenLabel(token)} />
          );
        })}
      </div>
    </div>
  );
}

export function CacheChapter({ lesson }: { lesson: Lesson }) {
  const answer = lesson.answerA;
  const { step, setStep, playing, togglePlay } = useStepper(answer.length - 1, Math.max(120, Math.min(900, 9000 / answer.length)));
  const n = lesson.promptA.length;
  const tokens = [...lesson.promptA, ...answer.slice(0, step)];
  const steps = answer.length - 1;
  const endNone = computedThrough(n, steps, false);
  const endCached = computedThrough(n, steps, true);

  return (
    <Chapter
      id="cache"
      number={4}
      title="Without a cache vs. with a KV cache"
      summary="Without a cache, the model redoes all its past work for every new token. With a cache, it saves that work and only does the new part."
      terms={[
        ['KV cache', 'Memory that keeps every token’s keys and values so they are computed only once.'],
        ['Recomputation', 'Working out the same keys and values again. What happens without a cache.'],
        ['Time per output token', 'How long each token after the first takes. The cache makes this short and steady.'],
        ['Trade-off', 'The cache saves compute but costs memory. Chapter 5 shows how much.'],
      ]}
    >
      <p>
        <strong>Prefill is the same either way.</strong> The model reads all {n} prompt tokens at once, computes their
        keys and values, and picks answer token 1. After that, the two approaches split:
      </p>

      <div className="compare-cards">
        <div className="card compare-card">
          <h3>Without a KV cache</h3>
          <p>
            For every new token, the model throws away everything it computed and runs the whole sequence again from
            scratch. That repeated work is <Term>recomputation</Term>.
          </p>
          <ol className="plain-list">
            <li>For token 2, it recomputes the {n} prompt tokens + token 1 = <strong>{n + 1} tokens</strong>.</li>
            <li>For token 3, it recomputes the prompt + tokens 1 and 2 = <strong>{n + 2} tokens</strong>.</li>
            <li>For token 4: <strong>{n + 3} tokens</strong>. The work keeps growing.</li>
          </ol>
        </div>
        <div className="card compare-card compare-card--cache">
          <h3>With a KV cache</h3>
          <p>
            The model saves every token’s keys and values in memory: the <Term>KV cache</Term>. For each new token it
            computes only that one token, and reads the rest from the cache.
          </p>
          <ol className="plain-list">
            <li>For token 2: compute <strong>1 token</strong>, read {n} from the cache.</li>
            <li>For token 3: compute <strong>1 token</strong>, read {n + 1} from the cache.</li>
            <li>For token 4: compute <strong>1 token</strong>, read {n + 2}. Always just one.</li>
          </ol>
        </div>
      </div>

      <p>Step through it. Orange is work done in that step; green is read from the cache.</p>

      <div className="card lesson-card">
        <StepControls step={step} lastStep={steps} playing={playing} onStep={setStep} onTogglePlay={togglePlay} showNumbers={false} label="Decoding steps" />
        <p className="step-label" aria-live="polite">
          {step === 0
            ? `Prefill: both compute all ${n} prompt tokens once.`
            : `Token ${step + 1}: without a cache, ${n + step} tokens are recomputed. With a cache, just 1.`}
        </p>
        <WorkRow tokens={tokens} step={step} cached={false} title="Without a cache" />
        <WorkRow tokens={tokens} step={step} cached title="With a KV cache" />
        <ul className="legend">
          <li className="legend__item"><span className="work-cell work-cell--computed legend__swatch" aria-hidden="true" />Computed this step</li>
          <li className="legend__item"><span className="work-cell work-cell--cached legend__swatch" aria-hidden="true" />Read from the cache</li>
        </ul>
      </div>

      <p>
        For this {answer.length}-token answer, the model without a cache computes keys and values{' '}
        <strong>{formatInt(endNone)}</strong> times in total. With a cache: <strong>{formatInt(endCached)}</strong>, once
        per token. Longer answers make the gap bigger, because each step without a cache is longer than the last. The
        time each new token takes is called the <Term>time per output token</Term>; the cache keeps it short and steady.
        The catch is a <Term>trade-off</Term>: the saved keys and values take up memory.
      </p>

      <LiveRace lesson={lesson} />
      <p className="muted small">
        Want numbers for several prompts and all four methods? Time them on the <Link to="/benchmarks">Benchmarks</Link> page.
      </p>
    </Chapter>
  );
}
