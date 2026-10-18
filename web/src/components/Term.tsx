import type { ReactNode } from 'react';

/** A key term, highlighted where it is first explained. */
export function Term({ children }: { children: ReactNode }) {
  return <dfn className="term">{children}</dfn>;
}

/** The terms a section introduced, recapped in one place. */
export function WordsToKnow({ terms }: { terms: [string, string][] }) {
  return (
    <aside className="words" aria-label="Words to know">
      <p className="words__title">Words to know</p>
      <dl className="words__list">
        {terms.map(([term, meaning]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
