import { useCallback, useEffect, useState } from 'react';
import {
  getAnalysisData,
  type AnalysisEnvelopeMap,
  type AnalysisResource,
} from '../data/analysisData';

type AnalysisStatus = 'loading' | 'refreshing' | 'ready' | 'error';

export const useAnalysisData = <R extends AnalysisResource>(
  year: number,
  resource: R,
  driverId?: string,
) => {
  const [envelope, setEnvelope] = useState<AnalysisEnvelopeMap[R] | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('loading');
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
        const response = await getAnalysisData(year, resource, controller.signal, driverId);
        if (controller.signal.aborted) return;
        setEnvelope(response);
        setStatus('ready');
        if (!['published', 'scheduled'].includes(response.meta.state)) {
          refreshTimer = window.setTimeout(load, 60_000);
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError : new Error('Analysis data unavailable'));
        setStatus('error');
      }
    };

    load();
    return () => {
      controller.abort();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [driverId, requestVersion, resource, year]);

  return {
    envelope,
    status,
    error,
    retry,
  };
};
