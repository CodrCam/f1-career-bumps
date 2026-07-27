import type { ReactNode } from 'react';
import type { ApiMeta } from '../data/seasonOverview';
import { DataStatus } from '../ui/DataStatus';

interface CorePageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: ApiMeta;
  actions?: ReactNode;
}

export const CorePageHeader = ({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: CorePageHeaderProps) => (
  <header className="core-page__header">
    <div className="core-page__heading">
      <span className="core-page__eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <div className="core-page__header-tools">
      {actions}
      <DataStatus compact state={meta.state} updatedAt={meta.publishedAt} />
    </div>
  </header>
);
