import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../config/api.js';

const useApiResource = (path, enabled = true) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(enabled ? 'loading' : 'idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setStatus('idle');
      setError(null);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setStatus('loading');
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}${path}`);
        if (!response.ok) throw new Error(`Race story API returned ${response.status}`);
        const body = await response.json();

        if (!cancelled) {
          setData(body);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(loadError);
          setStatus('error');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, path]);

  return { data, status, error };
};

export const useSeasonRaceAnalytics = (year) => (
  useApiResource(`/api/seasons/${year}/analytics`)
);

export const useRaceAnalytics = (year, round) => (
  useApiResource(
    `/api/seasons/${year}/races/${round}/analytics`,
    Number.isInteger(round) && round > 0,
  )
);
