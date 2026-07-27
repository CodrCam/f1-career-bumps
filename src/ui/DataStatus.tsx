import {
  CircleAlert,
  CircleCheck,
  Clock3,
  RefreshCw,
} from 'lucide-react';
import type { PublicationState } from '../data/seasonOverview';

const stateCopy: Record<PublicationState, { label: string; detail: string }> = {
  scheduled: {
    label: 'Season scheduled',
    detail: 'Waiting for the next official result.',
  },
  awaiting_results: {
    label: 'Results pending',
    detail: 'Waiting for the official classification.',
  },
  results_ready: {
    label: 'Results published',
    detail: 'Detailed race timing is still processing.',
  },
  awaiting_timing: {
    label: 'Story processing',
    detail: 'Official results are live while detailed timing is collected.',
  },
  timing_ready: {
    label: 'Timing received',
    detail: 'The race story is passing publication checks.',
  },
  published: {
    label: 'Analysis current',
    detail: 'The latest available race data is published.',
  },
  degraded: {
    label: 'Limited analysis',
    detail: 'Official results are live; some detailed timing is unavailable.',
  },
  failed: {
    label: 'Refresh needs attention',
    detail: 'The last detailed-data attempt did not pass publication checks.',
  },
};

const formatUpdatedAt = (value?: string) => {
  if (!value) return 'Update time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return 'Update time unavailable';

  const seconds = Math.round((date.valueOf() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (absoluteSeconds < 60) return formatter.format(seconds, 'second');
  if (absoluteSeconds < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (absoluteSeconds < 86_400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86_400), 'day');
};

interface DataStatusProps {
  state: PublicationState;
  updatedAt?: string;
  compact?: boolean;
  detail?: string;
}

export const DataStatus = ({
  state,
  updatedAt,
  compact = false,
  detail,
}: DataStatusProps) => {
  const copy = stateCopy[state];
  const Icon = state === 'published'
    ? CircleCheck
    : state === 'failed'
      ? CircleAlert
      : state === 'scheduled'
        ? Clock3
        : RefreshCw;

  return (
    <aside
      className={`slip-data-status state-${state} ${compact ? 'is-compact' : ''}`}
      aria-live="polite"
    >
      <span className="slip-data-status__icon" aria-hidden="true">
        <Icon size={compact ? 14 : 17} />
      </span>
      <span className="slip-data-status__copy">
        <strong>{copy.label}</strong>
        {!compact && <span>{detail ?? copy.detail}</span>}
      </span>
      <time dateTime={updatedAt}>{formatUpdatedAt(updatedAt)}</time>
    </aside>
  );
};
