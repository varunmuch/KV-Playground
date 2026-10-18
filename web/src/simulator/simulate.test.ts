import { describe, expect, it } from 'vitest';
import { computedAtStep, computedThrough } from './compute';
import { lastStep, lengthsAt, reusedPrefixTokens, simulate, validateScenario } from './simulate';
import type { LayoutMethod, Scenario } from './types';

// Small hand-checkable scenario: 8 shared tokens, A = 11-token prompt, B = 13, six decode steps.
const small: Scenario = {
  sharedPrefixTokens: 8,
  promptTokensA: 11,
  promptTokensB: 13,
  decodeSteps: 6,
  blockSize: 4,
  staticReservePerRequest: 24,
  totalSlots: 64,
};

const methods: LayoutMethod[] = ['dynamic', 'static', 'paged', 'prefix'];

describe('timeline', () => {
  it('has prefill A, prefill B, then one token per request per decode step', () => {
    expect(lastStep(small)).toBe(8);
    expect(lengthsAt(small, 0)).toEqual({ a: 0, b: 0 });
    expect(lengthsAt(small, 1)).toEqual({ a: 11, b: 0 });
    expect(lengthsAt(small, 2)).toEqual({ a: 11, b: 13 });
    expect(lengthsAt(small, 3)).toEqual({ a: 12, b: 14 });
    expect(lengthsAt(small, 8)).toEqual({ a: 17, b: 19 });
  });

  it('rejects steps outside the timeline', () => {
    expect(() => simulate('dynamic', small, -1)).toThrow(RangeError);
    expect(() => simulate('dynamic', small, 9)).toThrow(RangeError);
    expect(() => simulate('dynamic', small, 1.5)).toThrow(RangeError);
  });

  it('accepts the small scenario and rejects one that does not fit', () => {
    expect(() => validateScenario(small)).not.toThrow();
    expect(() => validateScenario({ ...small, staticReservePerRequest: 16 })).toThrow();
    expect(() => validateScenario({ ...small, totalSlots: 62 })).toThrow();
  });
});

describe('every method', () => {
  it('starts empty', () => {
    for (const method of methods) {
      const state = simulate(method, small, 0);
      expect(state.metrics).toEqual({ slotsUsed: 0, slotsAllocated: 0, wastedSlots: 0, prefillComputed: 0, tokensCopied: 0 });
      expect(state.slots.every((slot) => slot.state === 'free')).toBe(true);
    }
  });

  it('keeps wasted = allocated - used and never fills more slots than tokens exist', () => {
    for (const method of methods) {
      for (let step = 0; step <= lastStep(small); step++) {
        const { metrics, lengths } = simulate(method, small, step);
        expect(metrics.wastedSlots).toBe(metrics.slotsAllocated - metrics.slotsUsed);
        expect(metrics.slotsUsed).toBeLessThanOrEqual(lengths.a + lengths.b);
      }
    }
  });
});

describe('dynamic', () => {
  it('packs A then B contiguously with no waste', () => {
    const state = simulate('dynamic', small, 2);
    expect(state.slots.slice(0, 11).every((s) => s.owners[0] === 'a')).toBe(true);
    expect(state.slots.slice(11, 24).every((s) => s.owners[0] === 'b')).toBe(true);
    expect(state.slots[24].state).toBe('free');
    expect(state.metrics.slotsAllocated).toBe(24);
    expect(state.metrics.wastedSlots).toBe(0);
  });

  it('copies the full cache of both requests at every decode step', () => {
    expect(simulate('dynamic', small, 2).metrics.tokensCopied).toBe(0);
    expect(simulate('dynamic', small, 3).metrics.tokensCopied).toBe(12 + 14);
    expect(simulate('dynamic', small, 4).metrics.tokensCopied).toBe(12 + 14 + 13 + 15);
  });

  it('marks generated tokens after the prompt', () => {
    const state = simulate('dynamic', small, 3);
    expect(state.slots[10].kind).toBe('prompt');
    expect(state.slots[11]).toMatchObject({ owners: ['a'], position: 11, kind: 'generated' });
  });
});

describe('static', () => {
  it('reserves a fixed region per request once it starts', () => {
    const afterA = simulate('static', small, 1);
    expect(afterA.metrics).toMatchObject({ slotsUsed: 11, slotsAllocated: 24, wastedSlots: 13 });
    expect(afterA.slots[11].state).toBe('reserved');
    expect(afterA.slots[24].state).toBe('free');

    const afterB = simulate('static', small, 2);
    expect(afterB.slots[24]).toMatchObject({ state: 'filled', owners: ['b'], position: 0 });
    expect(afterB.metrics).toMatchObject({ slotsUsed: 24, slotsAllocated: 48, wastedSlots: 24 });
  });
});

describe('paged', () => {
  it('allocates blocks on demand in arrival order, interleaving requests', () => {
    expect(simulate('paged', small, 2).blockTables).toEqual({ a: [0, 1, 2], b: [3, 4, 5, 6] });
    // Step 3: A grows to 12 (still 3 blocks), B to 14 (still 4). Step 4: A needs a 4th block.
    expect(simulate('paged', small, 4).blockTables).toEqual({ a: [0, 1, 2, 7], b: [3, 4, 5, 6] });
  });

  it('wastes at most one partial block per request', () => {
    for (let step = 0; step <= lastStep(small); step++) {
      expect(simulate('paged', small, step).metrics.wastedSlots).toBeLessThanOrEqual(2 * (small.blockSize - 1));
    }
  });

  it('computes every prompt token in prefill', () => {
    expect(simulate('paged', small, 2).metrics.prefillComputed).toBe(24);
  });
});

describe('prefix sharing', () => {
  it('references the shared prefix blocks from both block tables', () => {
    const state = simulate('prefix', small, 2);
    expect(state.blockTables).toEqual({ a: [0, 1, 2], b: [0, 1, 3, 4] });
    expect(state.slots[0].owners).toEqual(['a', 'b']);
    expect(state.slots[8].owners).toEqual(['a']);
  });

  it('only computes B’s own tokens in prefill', () => {
    expect(simulate('prefix', small, 2).metrics.prefillComputed).toBe(11 + 5);
    expect(simulate('prefix', small, 2).metrics.slotsUsed).toBe(11 + 5);
  });

  it('shares only whole blocks when the prefix ends mid-block', () => {
    const odd: Scenario = { ...small, sharedPrefixTokens: 9 };
    expect(reusedPrefixTokens(odd)).toBe(8);
    const state = simulate('prefix', odd, 2);
    expect(state.metrics.prefillComputed).toBe(11 + 5);
    expect(state.blockTables?.b.slice(0, 2)).toEqual([0, 1]);
  });
});

describe('compute counts', () => {
  it('recomputes the whole sequence every step without a cache', () => {
    expect(computedAtStep(10, 0, false)).toBe(10);
    expect(computedAtStep(10, 3, false)).toBe(13);
    expect(computedThrough(10, 3, false)).toBe(10 + 11 + 12 + 13);
  });

  it('computes one new token per step with a cache', () => {
    expect(computedAtStep(10, 3, true)).toBe(1);
    expect(computedThrough(10, 3, true)).toBe(13);
  });
});
