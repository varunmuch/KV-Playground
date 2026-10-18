import type { ReactNode } from 'react';

/** Where a number comes from: measured on a GPU, calculated, or simulated. */
export function Badge({ kind, children }: { kind: 'measured' | 'simulated' | 'theoretical'; children: ReactNode }) {
  return <span className={`badge badge--${kind}`}>{children}</span>;
}
