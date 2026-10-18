/** Cache layouts the memory simulator can draw. */
export type LayoutMethod = 'dynamic' | 'static' | 'paged' | 'prefix';

export type RequestId = 'a' | 'b';

/**
 * Two requests that share the start of their prompts. Token counts come from the real
 * tokenizer; the simulator never invents them.
 */
export interface Scenario {
  /** Tokens both prompts start with (system prompt and chat markers). */
  sharedPrefixTokens: number;
  /** Full prompt length of each request, including the shared prefix. */
  promptTokensA: number;
  promptTokensB: number;
  /** Decode steps after both prefills; each adds one token to each request. */
  decodeSteps: number;
  /** Token slots per block for paged layouts. */
  blockSize: number;
  /** Slots a static cache reserves per request up front. */
  staticReservePerRequest: number;
  /** Size of the memory pool in token slots. */
  totalSlots: number;
}

export interface Slot {
  /** 'reserved' = allocated to a request but not holding a token yet. */
  state: 'free' | 'reserved' | 'filled';
  /** Requests whose cache uses this slot. Two owners means the slot is shared. */
  owners: RequestId[];
  /** Position in the owner's token sequence (prompt first, then generated). */
  position: number | null;
  kind: 'prompt' | 'generated' | null;
}

export interface Metrics {
  /** Slots that hold a token's keys and values. Shared slots count once. */
  slotsUsed: number;
  /** Slots set aside for a request, filled or not. */
  slotsAllocated: number;
  /** Allocated but empty. */
  wastedSlots: number;
  /** Prompt tokens whose keys and values were computed during prefill, so far. */
  prefillComputed: number;
  /** Token entries copied by reallocation, so far. */
  tokensCopied: number;
}

export interface MemoryState {
  step: number;
  slots: Slot[];
  /** Block indices per request, in sequence order. Only for paged layouts. */
  blockTables: Record<RequestId, number[]> | null;
  metrics: Metrics;
  /** Tokens in each request's sequence at this step. */
  lengths: Record<RequestId, number>;
}
