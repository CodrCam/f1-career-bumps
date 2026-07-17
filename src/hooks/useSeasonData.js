import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from '../config/api.js';
import fallbackSeasonData from '../data/f1_2025_season.json';
import { normalizeSeasonTeamNames } from '../utils/dataProcessing.js';
import { fetchSeason } from '../utils/fetchSeason.js';

const allowJsonFallback = import.meta.env.VITE_ALLOW_JSON_FALLBACK === 'true';

export const useSeasonData = (year = 2025) => {
  const fallbackData = useMemo(() => year === 2025 ? fallbackSeasonData : { races: [] }, [year]);
  const emptySeasonData = useMemo(() => ({ races: [] }), []);
  const [seasonData, setSeasonData] = useState(() => allowJsonFallback ? fallbackData : emptySeasonData);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const loadSeason = async () => {
      setStatus('loading');
      setError(null);

      try {
        const data = await fetchSeason({
          url: `${apiBaseUrl}/api/seasons/${year}`,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSeasonData(data);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setSeasonData(allowJsonFallback ? fallbackData : emptySeasonData);
          setError(loadError);
          setStatus(allowJsonFallback ? 'fallback' : 'error');
        }
      }
    };

    loadSeason();

    return () => {
      controller.abort();
    };
  }, [year, fallbackData, emptySeasonData, requestVersion]);

  const normalizedSeasonData = useMemo(() => (
    normalizeSeasonTeamNames(seasonData, year)
  ), [seasonData, year]);
  const races = useMemo(() => normalizedSeasonData?.races ?? [], [normalizedSeasonData]);

  return {
    seasonData: normalizedSeasonData,
    races,
    status,
    error,
    retry,
    usingFallback: status === 'fallback',
    apiBaseUrl,
  };
};
