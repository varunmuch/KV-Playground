import type { ReactNode } from 'react';
import { WordsToKnow } from '../../components/Term';

interface ChapterProps {
  id: string;
  number: number;
  title: string;
  /** One-sentence takeaway shown under the title. */
  summary: string;
  /** Key terms this chapter introduces: [term, one-line meaning]. */
  terms: [string, string][];
  children: ReactNode;
}

export function Chapter({ id, number, title, summary, terms, children }: ChapterProps) {
  return (
    <section id={id} className="chapter" aria-labelledby={`${id}-title`}>
      <p className="chapter__num mono">Chapter {number}</p>
      <h2 id={`${id}-title`} className="chapter__title">
        {title}
      </h2>
      <p className="chapter__summary">{summary}</p>
      <div className="chapter__body">
        {children}
        <WordsToKnow terms={terms} />
      </div>
    </section>
  );
}
