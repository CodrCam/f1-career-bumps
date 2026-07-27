import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalysisEnvelope,
  DriverDirectoryData,
} from '../data/analysisData';
import {
  executeStatisticsQuery,
  type StatisticsQuestionInput,
  type StatisticsResult,
} from '../data/queryData';

type QueryStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useStatisticsQuery = (
  directory: AnalysisEnvelope<DriverDirectoryData> | null,
) => {
  const [result, setResult] = useState<StatisticsResult | null>(null);
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (input: StatisticsQuestionInput) => {
    if (!directory) throw new Error('The published driver dataset is not ready.');
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('loading');
    setError(null);
    try {
      const response = await executeStatisticsQuery(input, directory, controller.signal);
      if (controller.signal.aborted) return null;
      setResult(response);
      setStatus('ready');
      return response;
    } catch (loadError) {
      if (controller.signal.aborted) return null;
      const nextError = loadError instanceof Error
        ? loadError
        : new Error('Statistics query unavailable');
      setError(nextError);
      setStatus('error');
      return null;
    }
  }, [directory]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setResult(null);
    setStatus('idle');
    setError(null);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    result,
    status,
    error,
    execute,
    reset,
  };
};
