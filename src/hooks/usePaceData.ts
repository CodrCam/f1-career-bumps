import { useCallback, useEffect, useState } from 'react';
import {
  getPaceSessionData,
  getPaceSessions,
  type PaceSession,
  type PaceSessionData,
} from '../data/paceData';

type LoadStatus = 'loading' | 'ready' | 'error' | 'idle';

export const usePaceSessions = (year: number) => {
  const [sessions, setSessions] = useState<PaceSession[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    getPaceSessions(year, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setSessions(response);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError : new Error('Timing sessions unavailable'));
        setStatus('error');
      });
    return () => controller.abort();
  }, [version, year]);

  return { sessions, status, error, retry };
};

export const usePaceSessionData = (year: number, sessionKey?: number) => {
  const [data, setData] = useState<PaceSessionData | null>(null);
  const [status, setStatus] = useState<LoadStatus>(sessionKey ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!sessionKey) {
      setData(null);
      setStatus('idle');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    getPaceSessionData(year, sessionKey, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setData(response);
        setStatus('ready');
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError : new Error('Session timing unavailable'));
        setStatus('error');
      });
    return () => controller.abort();
  }, [sessionKey, version, year]);

  return { data, status, error, retry };
};
