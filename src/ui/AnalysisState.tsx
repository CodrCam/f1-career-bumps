import {
  CircleAlert,
  Database,
  RefreshCw,
} from 'lucide-react';

interface AnalysisStateProps {
  state: 'loading' | 'error' | 'empty';
  title: string;
  detail: string;
  onRetry?: () => void;
}

export const AnalysisState = ({
  state,
  title,
  detail,
  onRetry,
}: AnalysisStateProps) => {
  const Icon = state === 'loading'
    ? RefreshCw
    : state === 'error'
      ? CircleAlert
      : Database;

  return (
    <div className={`analysis-state is-${state}`} role={state === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" size={25} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
};
