/** One token: its id in the vocabulary and the text it stands for. */
export interface TokenPiece {
  id: number;
  text: string;
  special: boolean;
  /** An answer word we couldn't generate (no model server). Shown as “?”, never as real text. */
  placeholder?: boolean;
}

/** Something loaded asynchronously, such as the tokenizer. */
export type Loadable<T> = { status: 'idle' | 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };
