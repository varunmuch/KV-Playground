import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, children }: PageHeaderProps) {
  return (
    <header>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {children && <p className="page-lede">{children}</p>}
    </header>
  );
}
