import type { TokenPiece } from '../data/types';
import { hubFile } from './model';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { type: 'function'; function: { name: string; arguments: Record<string, unknown> } }[];
}

export interface QwenTokenizer {
  /** Apply the model's chat template (thinking off, as the engine does) and split into tokens. */
  chat(messages: ChatMessage[], tools?: unknown[]): TokenPiece[];
  /** Split plain text into tokens, without the chat template. */
  text(text: string): TokenPiece[];
}

/** Bytes loaded so far and the total, for a progress bar. */
type Progress = (loaded: number, total: number) => void;

async function fetchWithProgress(url: string, onProgress?: Progress): Promise<string> {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok || !response.body) throw new Error(`${url.split('/').pop()}: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

/** Downloads Qwen's real tokenizer and chat template from the Hub and builds it in the browser. */
export async function loadQwenTokenizer(onProgress?: Progress): Promise<QwenTokenizer> {
  const [{ Tokenizer }, { Template }, tokenizerJson, configJson, templateText] = await Promise.all([
    import('@huggingface/tokenizers'),
    import('@huggingface/jinja'),
    fetchWithProgress(hubFile('tokenizer.json'), onProgress),
    fetchWithProgress(hubFile('tokenizer_config.json')),
    fetchWithProgress(hubFile('chat_template.jinja')),
  ]);
  const config = JSON.parse(configJson);
  const tokenizer = new Tokenizer(JSON.parse(tokenizerJson), config);
  const template = new Template(templateText);
  const special = new Set<number>(
    Object.entries(config.added_tokens_decoder ?? {}).map(([id]) => Number(id)),
  );

  const pieces = (ids: number[]): TokenPiece[] =>
    ids.map((id) => ({ id, text: tokenizer.decode([id]), special: special.has(id) }));

  return {
    chat(messages, tools) {
      const text = template.render({
        messages,
        tools,
        add_generation_prompt: true,
        enable_thinking: false,
        bos_token: '',
        eos_token: config.eos_token ?? '',
      });
      return pieces(tokenizer.encode(text, { add_special_tokens: false }).ids);
    },
    text(text) {
      return pieces(tokenizer.encode(text, { add_special_tokens: false }).ids);
    },
  };
}
