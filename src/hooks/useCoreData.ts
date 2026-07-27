import { useCallback, useEffect, useState } from 'react';
import {
  getCoreData,
  type CoreEnvelopeMap,
  type CoreResource,
} from '../data/coreData';

type CoreDataStatus = 'loading' | 'refreshing' | 'ready' | 'error';

export const useCoreData = <R extends CoreResource>(
  year: number,
  resource: R,
  round?: number,
) => {
  const [envelope, setEnvelope] = useState<CoreEnvelopeMap[R] | null>(null);
  const [status, setStatus] = useState<CoreDataStatus>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: number | undefined;

    const load = async () => {
      setStatus((current) => (
        current === 'ready' || current === 'refreshing' ? 'refreshing' : 'loading'
      ));
      setError(null);
      try {
        const response = await getCoreData(year, resource, controller.signal, round);
        if (controller.signal.aborted) return;
        setEnvelope(response);
        setStatus('ready');
        if (!['published', 'scheduled'].includes(response.meta.state)) {
          refreshTimer = window.setTimeout(load, 60_000);
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError : new Error('Publication data unavailable'));
        setStatus('error');
      }
    };

    load();
    return () => {
      controller.abort();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [requestVersion, resource, round, year]);

  return {
    envelope,
    status,
    error,
    retry,
  };
};
