import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MetricItem {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  definition?: string;
}

interface MetricStripProps {
  items: MetricItem[];
  label: string;
}

export const MetricStrip = ({ items, label }: MetricStripProps) => (
  <dl
    className="slip-metric-strip"
    aria-label={label}
    style={{ '--metric-count': Math.min(items.length, 4) } as CSSProperties}
  >
    {items.map((item) => (
      <div className="slip-metric-strip__item" key={item.label}>
        <dt>
          {item.label}
          {item.definition && (
            <Link
              className="slip-definition-link"
              to={`/methodology#${item.definition}`}
              aria-label={`Read the definition of ${item.label}`}
            >
              ?
            </Link>
          )}
        </dt>
        <dd>{item.value}</dd>
        {item.detail && <span>{item.detail}</span>}
      </div>
    ))}
  </dl>
);
