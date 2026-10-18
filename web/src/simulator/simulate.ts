import type { LayoutMethod, MemoryState, Metrics, RequestId, Scenario, Slot } from './types';

/*
 * Step timeline, shared by every method:
 *   step 0      nothing has run
 *   step 1      prefill request A (its whole prompt)
 *   step 2      prefill request B
 *   step 3..    decode: A gains one token, then B gains one token
 */

type StepPhase =
  | { kind: 'empty' }
  | { kind: 'prefill'; request: RequestId }
  | { kind: 'decode'; index: number };

export function lastStep(scenario: Scenario): number {
  return 2 + scenario.decodeSteps;
}

export function stepPhase(step: number): StepPhase {
  if (step === 0) return { kind: 'empty' };
  if (step === 1) return { kind: 'prefill', request: 'a' };
  if (step === 2) return { kind: 'prefill', request: 'b' };
  return { kind: 'decode', index: step - 2 };
}

function generatedAt(step: number): number {
  return Math.max(0, step - 2);
}

export function lengthsAt(scenario: Scenario, step: number): Record<RequestId, number> {
  const generated = generatedAt(step);
  return {
    a: step >= 1 ? scenario.promptTokensA + generated : 0,
    b: step >= 2 ? scenario.promptTokensB + generated : 0,
  };
}

function promptTokens(scenario: Scenario, request: RequestId): number {
  return request === 'a' ? scenario.promptTokensA : scenario.promptTokensB;
}

function kindAt(scenario: Scenario, request: RequestId, position: number): Slot['kind'] {
  return position < promptTokens(scenario, request) ? 'prompt' : 'generated';
}

function emptySlots(count: number): Slot[] {
  return Array.from({ length: count }, () => ({ state: 'free', owners: [], position: null, kind: null }));
}

function countFilled(slots: Slot[]): number {
  return slots.filter((slot) => slot.state === 'filled').length;
}

/** Throws if the scenario cannot be drawn without running out of memory. */
export function validateScenario(scenario: Scenario): void {
  const { blockSize, totalSlots, staticReservePerRequest, sharedPrefixTokens } = scenario;
  const final = lengthsAt(scenario, lastStep(scenario));
  if (!Number.isInteger(blockSize) || blockSize < 1) throw new Error('blockSize must be a positive integer');
  if (totalSlots % blockSize !== 0) throw new Error('totalSlots must be a multiple of blockSize');
  if (sharedPrefixTokens > Math.min(scenario.promptTokensA, scenario.promptTokensB)) {
    throw new Error('shared prefix is longer than a prompt');
  }
  if (Math.max(final.a, final.b) > staticReservePerRequest) {
    throw new Error('static reservation is smaller than a request');
  }
  if (2 * staticReservePerRequest > totalSlots) throw new Error('two static reservations do not fit');
  const blocks = (n: number) => Math.ceil(n / blockSize);
  if ((blocks(final.a) + blocks(final.b)) * blockSize > totalSlots) throw new Error('paged blocks do not fit');
}

function checkStep(scenario: Scenario, step: number): void {
  if (!Number.isInteger(step) || step < 0 || step > lastStep(scenario)) {
    throw new RangeError(`step must be an integer from 0 to ${lastStep(scenario)}`);
  }
}

function prefillComputed(scenario: Scenario, step: number, reusedByB: number): number {
  return (step >= 1 ? scenario.promptTokensA : 0) + (step >= 2 ? scenario.promptTokensB - reusedByB : 0);
}

// ---------------------------------------------------------------------------
// Dynamic: each request is one contiguous tensor that grows by concatenation.
// ---------------------------------------------------------------------------

function simulateDynamic(scenario: Scenario, step: number): MemoryState {
  const lengths = lengthsAt(scenario, step);
  const slots = emptySlots(scenario.totalSlots);
  let offset = 0;
  for (const request of ['a', 'b'] as const) {
    for (let position = 0; position < lengths[request]; position++) {
      slots[offset + position] = { state: 'filled', owners: [request], position, kind: kindAt(scenario, request, position) };
    }
    offset += lengths[request];
  }

  // torch.cat allocates a new tensor and copies the whole cache into it, every decode step, per request.
  let tokensCopied = 0;
  for (let s = 3; s <= step; s++) {
    const at = lengthsAt(scenario, s);
    tokensCopied += at.a + at.b;
  }

  const used = countFilled(slots);
  return {
    step,
    slots,
    blockTables: null,
    lengths,
    metrics: { slotsUsed: used, slotsAllocated: used, wastedSlots: 0, prefillComputed: prefillComputed(scenario, step, 0), tokensCopied },
  };
}

// ---------------------------------------------------------------------------
// Static: each request owns a fixed region reserved when it starts.
// ---------------------------------------------------------------------------

function simulateStatic(scenario: Scenario, step: number): MemoryState {
  const lengths = lengthsAt(scenario, step);
  const reserve = scenario.staticReservePerRequest;
  const slots = emptySlots(scenario.totalSlots);
  let allocated = 0;

  (['a', 'b'] as const).forEach((request, i) => {
    if (lengths[request] === 0) return;
    allocated += reserve;
    const start = i * reserve;
    for (let position = 0; position < reserve; position++) {
      slots[start + position] =
        position < lengths[request]
          ? { state: 'filled', owners: [request], position, kind: kindAt(scenario, request, position) }
          : { state: 'reserved', owners: [request], position: null, kind: null };
    }
  });

  const used = countFilled(slots);
  return {
    step,
    slots,
    blockTables: null,
    lengths,
    metrics: { slotsUsed: used, slotsAllocated: allocated, wastedSlots: allocated - used, prefillComputed: prefillComputed(scenario, step, 0), tokensCopied: 0 },
  };
}

// ---------------------------------------------------------------------------
// Paged and prefix sharing: fixed-size blocks handed out on demand.
// ---------------------------------------------------------------------------

function simulateBlocks(scenario: Scenario, step: number, sharePrefix: boolean): MemoryState {
  const { blockSize } = scenario;
  const lengths = lengthsAt(scenario, step);
  const freeBlocks = Array.from({ length: scenario.totalSlots / blockSize }, (_, i) => i);
  const tables: Record<RequestId, number[]> = { a: [], b: [] };

  // Only whole blocks can be shared; a partly filled last prefix block belongs to one request.
  const sharedBlockCount = sharePrefix ? Math.floor(scenario.sharedPrefixTokens / blockSize) : 0;
  let sharedBlocks: number[] = [];

  const grow = (request: RequestId, length: number) => {
    const needed = Math.ceil(length / blockSize);
    while (tables[request].length < needed) {
      const block = freeBlocks.shift();
      if (block === undefined) throw new Error('out of blocks');
      tables[request].push(block);
    }
  };

  // Replay allocations in arrival order up to the requested step.
  for (let s = 1; s <= step; s++) {
    const at = lengthsAt(scenario, s);
    if (s === 1) {
      grow('a', at.a);
      sharedBlocks = tables.a.slice(0, sharedBlockCount);
    } else if (s === 2) {
      tables.b = [...sharedBlocks];
      grow('b', at.b);
    } else {
      grow('a', at.a);
      grow('b', at.b);
    }
  }

  const slots = emptySlots(scenario.totalSlots);
  const ownersOf = (block: number): RequestId[] =>
    (['a', 'b'] as const).filter((request) => tables[request].includes(block));

  for (const request of ['a', 'b'] as const) {
    for (let position = 0; position < lengths[request]; position++) {
      const block = tables[request][Math.floor(position / blockSize)];
      const index = block * blockSize + (position % blockSize);
      slots[index] = { state: 'filled', owners: ownersOf(block), position, kind: kindAt(scenario, request, position) };
    }
  }

  const allocatedBlocks = new Set([...tables.a, ...tables.b]);
  for (const block of allocatedBlocks) {
    for (let i = 0; i < blockSize; i++) {
      const index = block * blockSize + i;
      if (slots[index].state === 'free') {
        slots[index] = { state: 'reserved', owners: ownersOf(block), position: null, kind: null };
      }
    }
  }

  const used = countFilled(slots);
  const allocated = allocatedBlocks.size * blockSize;
  const metrics: Metrics = {
    slotsUsed: used,
    slotsAllocated: allocated,
    wastedSlots: allocated - used,
    prefillComputed: prefillComputed(scenario, step, sharedBlockCount * blockSize),
    tokensCopied: 0,
  };
  return { step, slots, blockTables: tables, lengths, metrics };
}

// ---------------------------------------------------------------------------

export function simulate(method: LayoutMethod, scenario: Scenario, step: number): MemoryState {
  checkStep(scenario, step);
  switch (method) {
    case 'dynamic':
      return simulateDynamic(scenario, step);
    case 'static':
      return simulateStatic(scenario, step);
    case 'paged':
      return simulateBlocks(scenario, step, false);
    case 'prefix':
      return simulateBlocks(scenario, step, true);
  }
}

/** Tokens of the shared prefix that request B reuses instead of computing (prefix sharing only). */
export function reusedPrefixTokens(scenario: Scenario): number {
  return Math.floor(scenario.sharedPrefixTokens / scenario.blockSize) * scenario.blockSize;
}
