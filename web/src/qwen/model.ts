/*
 * Everything the site knows about the model comes from its public files on the Hugging Face Hub,
 * pinned to one revision so the numbers can never change underneath the page.
 */

const MODEL_ID = 'Qwen/Qwen3.5-0.8B';
const MODEL_REVISION = '2fc06364715b967f1860aea9cf38778875588b17';
export const MODEL_NAME = MODEL_ID.split('/')[1];

export function hubFile(path: string): string {
  return `https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${path}`;
}

const HUB_API = `https://huggingface.co/api/models/${MODEL_ID}/revision/${MODEL_REVISION}`;

/** Facts derived from config.json. All arithmetic is in this file so it can be checked. */
export interface ModelFacts {
  model: string;
  dtype: string;
  bytesPerElement: number;
  numLayers: number;
  layerTypes: string[];
  fullAttentionLayers: number;
  numAttentionHeads: number;
  numKvHeads: number;
  headDim: number;
  maxContext: number | null;
  /** Total parameters in the published weights (from the Hub API). */
  parameters: number | null;
  /** Bytes of keys and values stored per token. */
  kvBytesPerToken: number;
  /** Bytes of fixed-size state per request held by linear-attention layers (0 for plain transformers). */
  fixedStateBytes: number;
}

const DTYPE_BYTES: Record<string, number> = { bfloat16: 2, float16: 2, float32: 4 };

interface TextConfig {
  num_hidden_layers: number;
  num_attention_heads: number;
  num_key_value_heads: number;
  head_dim?: number;
  hidden_size: number;
  layer_types?: string[];
  max_position_embeddings?: number;
  dtype?: string;
  torch_dtype?: string;
  linear_num_key_heads?: number;
  linear_num_value_heads?: number;
  linear_key_head_dim?: number;
  linear_value_head_dim?: number;
  linear_conv_kernel_dim?: number;
}

export function factsFromConfig(config: { text_config?: TextConfig } & Partial<TextConfig>, parameters: number | null): ModelFacts {
  const text = (config.text_config ?? config) as TextConfig;
  const dtype = text.dtype ?? text.torch_dtype ?? 'bfloat16';
  const bytes = DTYPE_BYTES[dtype] ?? 2;
  const layerTypes = text.layer_types ?? Array<string>(text.num_hidden_layers).fill('full_attention');
  const full = layerTypes.filter((t) => t === 'full_attention').length;
  const headDim = text.head_dim ?? text.hidden_size / text.num_attention_heads;

  // Linear-attention layers keep a recurrent state (stored in 32-bit floats by transformers) and a
  // short convolution state. Checked against a real cache: 1,097,728 bytes per layer for Qwen3.5-0.8B.
  let fixedPerLayer = 0;
  if (text.linear_num_value_heads && text.linear_key_head_dim && text.linear_value_head_dim) {
    const recurrent = text.linear_num_value_heads * text.linear_key_head_dim * text.linear_value_head_dim * 4;
    const convDim = (text.linear_num_key_heads ?? 0) * text.linear_key_head_dim * 2 + text.linear_num_value_heads * text.linear_value_head_dim;
    fixedPerLayer = recurrent + convDim * (text.linear_conv_kernel_dim ?? 0) * bytes;
  }

  return {
    model: MODEL_ID,
    dtype,
    bytesPerElement: bytes,
    numLayers: text.num_hidden_layers,
    layerTypes,
    fullAttentionLayers: full,
    numAttentionHeads: text.num_attention_heads,
    numKvHeads: text.num_key_value_heads,
    headDim,
    maxContext: text.max_position_embeddings ?? null,
    parameters,
    kvBytesPerToken: 2 * full * text.num_key_value_heads * headDim * bytes,
    fixedStateBytes: fixedPerLayer * (layerTypes.length - full),
  };
}

export async function loadModelFacts(): Promise<ModelFacts> {
  const [config, info] = await Promise.all([
    fetch(hubFile('config.json'), { cache: 'force-cache' }).then((r) => {
      if (!r.ok) throw new Error(`config.json: HTTP ${r.status}`);
      return r.json();
    }),
    fetch(HUB_API, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  return factsFromConfig(config, info?.safetensors?.total ?? null);
}
