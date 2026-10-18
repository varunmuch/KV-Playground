import { useState } from 'react';
import { randomExample } from '../../content/examplePrompts';
import { suggest } from '../../live/api';
import type { AnswerState, LessonInput } from './useLesson';

interface LessonPromptPanelProps {
  value: LessonInput;
  onChange: (value: LessonInput) => void;
  serverOnline: boolean;
  tokenizerStatus: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  answerState: AnswerState;
  promptTokens: number | null;
  /** The model's real answer, once it has arrived. */
  answer: { text: string; tokens: number } | null;
}

export function LessonPromptPanel({ value, onChange, serverOnline, tokenizerStatus, progress, answerState, promptTokens, answer }: LessonPromptPanelProps) {
  const [suggesting, setSuggesting] = useState(false);
  const set = (patch: Partial<LessonInput>) => onChange({ ...value, ...patch });

  const random = () => {
    const example = randomExample();
    onChange({ ...value, system: example.system, questionA: example.questions[0], questionB: example.questions[1] });
  };

  const askModel = async () => {
    setSuggesting(true);
    try {
      // Both questions fit the current system prompt, so chapter 6's two people make sense together.
      const questionA = await suggest(value.system);
      const questionB = await suggest(value.system);
      if (questionA) onChange({ ...value, questionA, questionB: questionB || value.questionB });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <section className="card lesson-prompt" aria-labelledby="lesson-prompt-title">
      <div className="figure-head">
        <h2 id="lesson-prompt-title" className="lesson-prompt__title">Pick a prompt to follow through the lesson</h2>
      </div>
      <p className="muted small">
        Type anything, or start from an example. The model can also write questions that fit your system prompt. Every
        chapter below updates to use it.
      </p>

      <div className="lesson-prompt__actions">
        <button type="button" className="btn btn--secondary btn--small" onClick={random}>
          Random example
        </button>
        {serverOnline && (
          <button type="button" className="btn btn--secondary btn--small" onClick={askModel} disabled={suggesting}>
            {suggesting ? 'The model is writing…' : 'Let the model write the questions'}
          </button>
        )}
      </div>

      <div className="lesson-prompt__fields">
        <label className="field">
          <span className="field__label">System prompt <span className="muted">(instructions the app adds)</span></span>
          <textarea rows={2} value={value.system} onChange={(e) => set({ system: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Your question</span>
          <textarea rows={2} value={value.questionA} onChange={(e) => set({ questionA: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Someone else’s question <span className="muted">(used in chapter 6)</span></span>
          <textarea rows={2} value={value.questionB} onChange={(e) => set({ questionB: e.target.value })} />
        </label>
      </div>

      <div className="lesson-prompt__status" aria-live="polite">
        {tokenizerStatus === 'loading' && (
          <p className="small">
            Downloading Qwen’s tokenizer from Hugging Face (about 13 MB, only the first time)…{' '}
            <span className="mono">{Math.round(progress * 100)}%</span>
            <span className="progress" aria-hidden="true">
              <span style={{ width: `${progress * 100}%` }} />
            </span>
          </p>
        )}
        {tokenizerStatus === 'error' && <p className="field__error small">Could not download the tokenizer from Hugging Face. Check your connection and reload.</p>}
        {promptTokens != null && <p className="small">Your prompt is <strong>{promptTokens} tokens</strong>, split by the model’s real tokenizer in your browser.</p>}
        {answerState === 'loading' && <p className="small muted">The model is writing its answer…</p>}
        {answerState === 'ready' && answer && (
          <div className="answer-box">
            <p className="answer-box__label">The model’s answer · {answer.tokens} tokens</p>
            <p className="answer-box__text">{answer.text.trim()}</p>
          </div>
        )}
        {(answerState === 'none' || answerState === 'error') && tokenizerStatus === 'ready' && (
          <p className="small muted">
            The model server isn’t running, so the answer shows as 12 blank <span className="mono">?</span> tokens. The real
            answer may be longer. Every count about your prompt is still exact. Run <span className="mono">engine/server.py</span> to see the real words.
          </p>
        )}
      </div>
    </section>
  );
}
