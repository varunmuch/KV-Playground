/*
 * How many tokens' keys and values the model computes, with and without a cache.
 * Step 0 is the prefill (reading the prompt). Step k >= 1 feeds the k-th generated token back in.
 */

/** Keys and values computed at one step. */
export function computedAtStep(promptTokens: number, step: number, cached: boolean): number {
  if (step === 0) return promptTokens;
  // Without a cache the whole sequence (prompt + k generated tokens) is processed again.
  return cached ? 1 : promptTokens + step;
}

/** Keys and values computed from the prefill through step k, inclusive. */
export function computedThrough(promptTokens: number, step: number, cached: boolean): number {
  let total = 0;
  for (let s = 0; s <= step; s++) total += computedAtStep(promptTokens, s, cached);
  return total;
}
