import { useEffect, useMemo, useState } from 'react';
import type { TokenPiece } from '../../data/types';
import { generate } from '../../live/api';
import type { QwenTokenizer } from '../../qwen/tokenizer';

/** Blank answer slots shown when there is no model server to produce the real answer. */
const PLACEHOLDER_TOKENS = 12;

export interface LessonInput {
  system: string;
  questionA: string;
  questionB: string;
}

export interface Lesson extends LessonInput {
  questionTokens: TokenPiece[];
  promptA: TokenPiece[];
  promptB: TokenPiece[];
  /** Tokens both prompts start with. */
  sharedPrefix: number;
  answerA: TokenPiece[];
  answerB: TokenPiece[];
  /** True when the answers are the model's real output; false when they are blank placeholders. */
  answersReal: boolean;
}

export type AnswerState = 'none' | 'loading' | 'ready' | 'error';

function placeholders(n: number): TokenPiece[] {
  return Array.from({ length: n }, (_, i) => ({ id: -1 - i, text: '', special: false, placeholder: true }));
}

function messages(system: string, question: string) {
  return [...(system.trim() ? [{ role: 'system' as const, content: system }] : []), { role: 'user' as const, content: question }];
}

function sharedLength(a: TokenPiece[], b: TokenPiece[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n].id === b[n].id) n++;
  return n;
}

/**
 * Builds the lesson from whatever the visitor typed: real tokens from the in-browser tokenizer,
 * and the model's real answers when the live server is running.
 */
export function useLesson(input: LessonInput, tokenizer: QwenTokenizer | null, serverOnline: boolean) {
  const [answers, setAnswers] = useState<{ key: string; a: TokenPiece[]; b: TokenPiece[] } | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('none');
  const key = JSON.stringify(input);

  const tokens = useMemo(() => {
    if (!tokenizer || !input.questionA.trim()) return null;
    const promptA = tokenizer.chat(messages(input.system, input.questionA));
    const promptB = tokenizer.chat(messages(input.system, input.questionB.trim() || input.questionA));
    return { questionTokens: tokenizer.text(input.questionA), promptA, promptB };
  }, [tokenizer, input.system, input.questionA, input.questionB]);

  useEffect(() => {
    if (!serverOnline || !tokens) {
      setAnswerState('none');
      return;
    }
    const abort = new AbortController();
    setAnswerState('loading');
    const timer = window.setTimeout(async () => {
      try {
        const a = await generate(input.system, input.questionA, abort.signal);
        const b = await generate(input.system, input.questionB.trim() || input.questionA, abort.signal);
        setAnswers({ key, a, b });
        setAnswerState('ready');
      } catch {
        if (!abort.signal.aborted) setAnswerState('error');
      }
    }, 600);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
    // key captures every input field, so the answers refresh whenever the prompt changes
  }, [serverOnline, tokens, key]);

  const lesson: Lesson | null = useMemo(() => {
    if (!tokens) return null;
    const real = answers?.key === key && answerState === 'ready';
    return {
      ...input,
      ...tokens,
      sharedPrefix: sharedLength(tokens.promptA, tokens.promptB),
      answerA: real ? answers.a : placeholders(PLACEHOLDER_TOKENS),
      answerB: real ? answers.b : placeholders(PLACEHOLDER_TOKENS),
      answersReal: real,
    };
  }, [tokens, answers, answerState, key, input]);

  return { lesson, answerState };
}
