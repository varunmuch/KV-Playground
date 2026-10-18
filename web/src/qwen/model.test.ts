import { describe, expect, it } from 'vitest';
import { factsFromConfig } from './model';

// The text_config fields of Qwen/Qwen3.5-0.8B at the pinned revision.
const QWEN35_08B = {
  text_config: {
    num_hidden_layers: 24,
    num_attention_heads: 8,
    num_key_value_heads: 2,
    head_dim: 256,
    hidden_size: 1024,
    dtype: 'bfloat16',
    max_position_embeddings: 262144,
    layer_types: Array.from({ length: 24 }, (_, i) => ((i + 1) % 4 === 0 ? 'full_attention' : 'linear_attention')),
    linear_num_key_heads: 16,
    linear_num_value_heads: 16,
    linear_key_head_dim: 128,
    linear_value_head_dim: 128,
    linear_conv_kernel_dim: 4,
  },
};

describe('factsFromConfig', () => {
  it('matches the cache sizes measured from a real transformers cache', () => {
    const facts = factsFromConfig(QWEN35_08B, null);
    expect(facts.fullAttentionLayers).toBe(6);
    // Measured by the engine: 12,288 bytes of K/V per token, 19,759,104 bytes of fixed state.
    expect(facts.kvBytesPerToken).toBe(12288);
    expect(facts.fixedStateBytes).toBe(19759104);
  });

  it('treats a config without layer types as all full attention', () => {
    const facts = factsFromConfig(
      { num_hidden_layers: 24, num_attention_heads: 14, num_key_value_heads: 2, hidden_size: 896, torch_dtype: 'float16' },
      null,
    );
    // Qwen2.5-0.5B: 2 × 24 × 2 × 64 × 2 bytes = 12 KiB per token, no fixed state.
    expect(facts.kvBytesPerToken).toBe(12288);
    expect(facts.fixedStateBytes).toBe(0);
  });
});
