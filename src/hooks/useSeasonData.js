import { useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from '../config/api.js';
import fallbackSeasonData from '../data/f1_2025_season.json';
import { normalizeSeasonTeamNames } from '../utils/dataProcessing.js';

const allowJsonFallback = import.meta.env.VITE_ALLOW_JSON_FALLBACK === 'true';

export const useSeasonData = (year = 2025) => {
  const fallbackData = useMemo(() => year === 2025 ? fallbackSeasonData : { races: [] }, [year]);
  const emptySeasonData = useMemo(() => ({ races: [] }), []);
  const [seasonData, setSeasonData] = useState(() => allowJsonFallback ? fallbackData : emptySeasonData);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadSeason = async () => {
      setStatus('loading');
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/seasons/${year}`);
        if (!response.ok) {
          throw new Error(`Season API returned ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) {
          setSeasonData(data);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setSeasonData(allowJsonFallback ? fallbackData : emptySeasonData);
          setError(loadError);
          setStatus(allowJsonFallback ? 'fallback' : 'error');
        }
      }
    };

    loadSeason();

    return () => {
      cancelled = true;
    };
  }, [year, fallbackData, emptySeasonData]);

  const normalizedSeasonData = useMemo(() => (
    normalizeSeasonTeamNames(seasonData, year)
  ), [seasonData, year]);
  const races = useMemo(() => normalizedSeasonData?.races ?? [], [normalizedSeasonData]);

  return {
    seasonData: normalizedSeasonData,
    races,
    status,
    error,
    usingFallback: status === 'fallback',
    apiBaseUrl,
  };
};
