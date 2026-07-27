import { useCallback, useEffect, useState } from 'react';
import {
  getSeasonOverview,
  type SeasonOverviewEnvelope,
} from '../data/seasonOverview';

type OverviewStatus = 'loading' | 'refreshing' | 'ready' | 'error';

export const useSeasonOverview = (year: number) => {
  const [overview, setOverview] = useState<SeasonOverviewEnvelope | null>(null);
  const [status, setStatus] = useState<OverviewStatus>('loading');
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
        const response = await getSeasonOverview(year, controller.signal);
        if (controller.signal.aborted) return;

        setOverview(response);
        setStatus('ready');

        if (!['published', 'scheduled'].includes(response.meta.state)) {
          refreshTimer = window.setTimeout(load, 60_000);
        }
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError : new Error('Season desk unavailable'));
        setStatus('error');
      }
    };

    load();

    return () => {
      controller.abort();
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [requestVersion, year]);

  return {
    overview,
    status,
    error,
    retry,
  };
};
