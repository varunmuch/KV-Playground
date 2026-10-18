import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  badge: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
  id?: string;
}

export function ChartCard({ title, badge, caption, children, id }: ChartCardProps) {
  return (
    <figure className="card chart-card" id={id}>
      <div className="figure-head">
        <figcaption className="chart-card__title">{title}</figcaption>
        {badge}
      </div>
      {children}
      {caption && <div className="chart-card__caption">{caption}</div>}
    </figure>
  );
}
