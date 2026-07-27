import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Radio,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import {
  getTimingCheckStatus,
  requestTimingCheck,
  type TimingCheckResponse,
  type TimingCheckSessionType,
} from '../data/timingCheck';

interface TimingCheckControlProps {
  year: number;
  round: number;
  sessionType?: TimingCheckSessionType;
}

const statusIcon = (status?: string) => {
  if (status === 'up_to_date' || status === 'provisional') return CheckCircle2;
  if (status === 'not_available' || status === 'not_checked') return Clock3;
  if (
    status === 'error'
    || status === 'session_not_registered'
    || status === 'limit_reached'
  ) return TriangleAlert;
  return Radio;
};

export const TimingCheckControl = ({
  year,
  round,
  sessionType = 'race',
}: TimingCheckControlProps) => {
  const [result, setResult] = useState<TimingCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [polling, setPolling] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const requestAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return undefined;
    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!polling) return undefined;
    const controller = new AbortController();
    let polls = 0;
    const poll = async () => {
      polls += 1;
      try {
        const status = await getTimingCheckStatus({
          year,
          round,
          sessionType,
          signal: controller.signal,
        });
        setResult(status);
        if (
          polls < 12
          && ['not_checked', 'available', 'processing'].includes(status.status)
        ) {
          window.setTimeout(poll, 5_000);
        } else {
          setPolling(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            status: 'error',
            message: error instanceof Error
              ? error.message
              : 'The timing check could not be read.',
          });
          setPolling(false);
        }
      }
    };
    const timer = window.setTimeout(poll, 2_000);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [polling, round, sessionType, year]);

  useEffect(() => () => requestAbort.current?.abort(), []);

  const checkTiming = async () => {
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setChecking(true);
    try {
      const response = await requestTimingCheck({
        year,
        round,
        sessionType,
        signal: controller.signal,
      });
      setResult(response);
      setPolling(response.status === 'queued');
      const cooldown = response.cooldownSeconds ?? response.retryAfterSeconds ?? 90;
      setCooldownUntil(Date.now() + cooldown * 1_000);
    } catch (error) {
      if (!controller.signal.aborted) {
        setResult({
          status: 'error',
          message: error instanceof Error
            ? error.message
            : 'The timing check could not be requested.',
        });
        setCooldownUntil(Date.now() + 15_000);
      }
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  };

  const visibleResult = result?.status === 'cooldown' && result.current
    ? result.current
    : result;
  const Icon = statusIcon(visibleResult?.status);
  const limitReached = result?.status === 'limit_reached';
  const disabled = checking || remainingSeconds > 0 || limitReached;
  const buttonLabel = checking
    ? 'Checking source…'
    : limitReached
      ? 'Community check limit reached'
      : remainingSeconds > 0
        ? `Check again in ${remainingSeconds}s`
        : 'Check timing now';

  return (
    <aside className="timing-check-control" aria-live="polite">
      <div className="timing-check-control__copy">
        <span className="core-page__eyebrow">Community timing check</span>
        <h2>See whether detailed timing is ready</h2>
        <p>
          Request one availability probe for this race. A positive check queues ingestion;
          a negative check changes no published data.
        </p>
      </div>
      <div className={`timing-check-control__result state-${visibleResult?.status ?? 'idle'}`}>
        <Icon aria-hidden="true" size={18} />
        <span>
          <strong>{visibleResult?.message ?? 'No timing check requested from this page yet.'}</strong>
          <small>Checks are limited per race and do not launch duplicate recorder jobs.</small>
        </span>
      </div>
      <button
        disabled={disabled}
        onClick={checkTiming}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={checking ? 'is-spinning' : ''} size={16} />
        {buttonLabel}
      </button>
    </aside>
  );
};
