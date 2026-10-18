import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Loadable } from '../data/types';
import { loadModelFacts, type ModelFacts } from './model';
import { loadQwenTokenizer, type QwenTokenizer } from './tokenizer';

interface QwenState {
  facts: Loadable<ModelFacts>;
  tokenizer: Loadable<QwenTokenizer>;
  /** Fraction of the tokenizer download done, 0 to 1. */
  progress: number;
  loadTokenizer: () => void;
}

const QwenContext = createContext<QwenState | null>(null);

export function QwenProvider({ children }: { children: ReactNode }) {
  const [facts, setFacts] = useState<Loadable<ModelFacts>>({ status: 'loading' });
  const [tokenizer, setTokenizer] = useState<QwenState['tokenizer']>({ status: 'idle' });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let active = true;
    loadModelFacts()
      .then((data) => active && setFacts({ status: 'ready', data }))
      .catch((error: unknown) => active && setFacts({ status: 'error', message: String(error) }));
    return () => {
      active = false;
    };
  }, []);

  const loadTokenizer = useCallback(() => {
    setTokenizer((current) => {
      if (current.status !== 'idle' && current.status !== 'error') return current;
      loadQwenTokenizer((loaded, total) => total && setProgress(loaded / total))
        .then((data) => setTokenizer({ status: 'ready', data }))
        .catch((error: unknown) => setTokenizer({ status: 'error', message: String(error) }));
      return { status: 'loading' };
    });
  }, []);

  const value = useMemo(() => ({ facts, tokenizer, progress, loadTokenizer }), [facts, tokenizer, progress, loadTokenizer]);
  return <QwenContext.Provider value={value}>{children}</QwenContext.Provider>;
}

function useQwen(): QwenState {
  const value = useContext(QwenContext);
  if (!value) throw new Error('Qwen hooks must be used inside QwenProvider');
  return value;
}

export function useModelFacts(): Loadable<ModelFacts> {
  return useQwen().facts;
}

/** The real tokenizer, downloaded the first time a page asks for it (about 13 MB, then cached). */
export function useQwenTokenizer(): { state: QwenState['tokenizer']; progress: number } {
  const { tokenizer, progress, loadTokenizer } = useQwen();
  useEffect(() => {
    loadTokenizer();
  }, [loadTokenizer]);
  return { state: tokenizer, progress };
}
