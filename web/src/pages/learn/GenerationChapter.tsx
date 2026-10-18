import { StepControls } from '../../components/StepControls';
import { Term } from '../../components/Term';
import { TokenRow, tokenLabel } from '../../components/TokenChip';
import { useStepper } from '../../hooks/useStepper';
import { Chapter } from './Chapter';
import type { Lesson } from './useLesson';

export function GenerationChapter({ lesson }: { lesson: Lesson }) {
  const answer = lesson.answerA;
  // Long answers play faster so the whole answer fits in a few seconds.
  const { step, setStep, playing, togglePlay } = useStepper(answer.length, Math.max(120, Math.min(900, 9000 / answer.length)));
  const n = lesson.promptA.length;
  const sequence = [...lesson.promptA, ...answer.slice(0, step)];

  return (
    <Chapter
      id="generation"
      number={2}
      title="Prefill, then one token at a time"
      summary="First the model reads the whole prompt at once. Then it writes the answer one token at a time, each new token added to the end."
      terms={[
        ['Prefill', 'The first step: the model reads the whole prompt in one go.'],
        ['Decoding', 'Every step after that: the model produces one more token.'],
        ['Autoregressive', 'Each new token depends on all the tokens before it, including the ones it just wrote.'],
        ['Time to first token (TTFT)', 'How long until the first token of the answer appears. Mostly the prefill.'],
      ]}
    >
      <ol className="plain-list">
        <li>
          <Term>Prefill</Term>: the model reads all {n} prompt tokens in one go and picks the first token of the answer.
          The wait for that first token is called the <Term>time to first token</Term> (TTFT).
        </li>
        <li>
          <Term>Decoding</Term>: that token is added to the end, and the model runs again to pick the next one. One token
          per run, until the answer is done.
        </li>
      </ol>
      <p>
        Because every new token is chosen from everything before it, including the tokens it just wrote, this kind of
        model is called <Term>autoregressive</Term>. Press Play to watch it.
      </p>

      <div className="card lesson-card">
        <StepControls step={step} lastStep={answer.length} playing={playing} onStep={setStep} onTogglePlay={togglePlay} showNumbers={false} label="Generation steps" />
        <p className="step-label" aria-live="polite">
          {step === 0
            ? `Before the answer: just the ${n}-token prompt.`
            : step === 1
              ? `Prefill: the model read all ${n} prompt tokens and picked answer token 1${answer[0].placeholder ? '' : `, “${tokenLabel(answer[0])}”`}.`
              : `Decoding step ${step - 1}: answer token ${step} was picked by running the model on all ${n + step - 1} tokens before it.`}
        </p>
        <TokenRow
          tokens={sequence}
          label="Prompt and answer so far"
          toneFor={(token, i) => (i >= n ? 'a-gen' : token.special ? 'special' : 'faded')}
          highlightIndex={step > 0 ? sequence.length - 1 : undefined}
        />
      </div>

      <p>
        Every run needs <em>all</em> the tokens before it: to pick token {answer.length}, the model looks at{' '}
        {n + answer.length - 1} tokens. Ask for a longer answer (say, “explain in detail”) and watch this number grow. How
        the model “looks back” is the next chapter.
      </p>
    </Chapter>
  );
}
