import type { ReactNode } from 'react';

interface FilterBarProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export const FilterBar = ({
  eyebrow = 'Workspace controls',
  title,
  children,
  actions,
}: FilterBarProps) => (
  <section className="analysis-filter" aria-label={title}>
    <header className="analysis-filter__header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {actions}
    </header>
    <div className="analysis-filter__fields">{children}</div>
  </section>
);

interface FilterFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export const FilterField = ({
  label,
  children,
  className = '',
}: FilterFieldProps) => (
  <label className={`analysis-field ${className}`}>
    <span>{label}</span>
    {children}
  </label>
);

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
}

export const SegmentedControl = <T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) => (
  <div className="analysis-segmented" role="group" aria-label={label}>
    {options.map((option) => (
      <button
        className={value === option.value ? 'is-active' : ''}
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
