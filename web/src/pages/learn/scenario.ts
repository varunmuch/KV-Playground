import type { TokenPiece } from '../../data/types';
import { lastStep, type RequestId, type Scenario } from '../../simulator';
import type { Lesson } from './useLesson';

/** What the visitor can change in the memory simulator. */
export interface SimSettings {
  /** Token slots per block (paged layouts). */
  blockSize: number;
  /** Answer tokens each person gets during the simulation; 0 means each whole answer. */
  answerTokens: number;
  /** Static reserves room for this many times the longest request. */
  reserveFactor: number;
}

export const DEFAULT_SETTINGS: SimSettings = { blockSize: 4, answerTokens: 6, reserveFactor: 1 };

/** The simulator scenario from real token counts and the visitor's settings. */
export function buildScenario(lesson: Lesson, settings: SimSettings): Scenario {
  const steps = settings.answerTokens || Math.max(lesson.answerA.length, lesson.answerB.length);
  const longest = Math.max(lesson.promptA.length, lesson.promptB.length) + steps;
  // A multiple of 16 keeps every block size (2, 4, 8, 16) lined up with the reservation.
  const reserve = Math.ceil((longest * settings.reserveFactor) / 16) * 16;
  return {
    sharedPrefixTokens: lesson.sharedPrefix,
    promptTokensA: lesson.promptA.length,
    promptTokensB: lesson.promptB.length,
    decodeSteps: steps,
    blockSize: settings.blockSize,
    staticReservePerRequest: reserve,
    totalSlots: reserve * 2,
  };
}

function padded(tokens: TokenPiece[], n: number): TokenPiece[] {
  const out = tokens.slice(0, n);
  while (out.length < n) out.push({ id: -1 - out.length, text: '', special: false, placeholder: true });
  return out;
}

/** Each person's tokens: their prompt, then their answer (real, or “?” placeholders). */
export function sequences(lesson: Lesson, scenario: Scenario): Record<RequestId, TokenPiece[]> {
  const steps = lastStep(scenario) - 2;
  return {
    a: [...lesson.promptA, ...padded(lesson.answerA, steps)],
    b: [...lesson.promptB, ...padded(lesson.answerB, steps)],
  };
}
