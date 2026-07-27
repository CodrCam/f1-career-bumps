import {
  runStatisticsQuery,
  STATISTICS_METRIC_OPTIONS,
} from '../../server/statisticsQuery.js';
import { apiBaseUrl } from '../config/api.js';
import type {
  AnalysisEnvelope,
  DriverDirectoryData,
} from './analysisData';
import type { ApiMeta } from './seasonOverview';

export type StatisticsMetricId =
  | 'points'
  | 'race_points'
  | 'sprint_points'
  | 'wins'
  | 'podiums'
  | 'starts'
  | 'average_finish'
  | 'average_grid'
  | 'average_qualifying'
  | 'points_per_start'
  | 'reliability'
  | 'dnfs'
  | 'positions_gained'
  | 'consistency'
  | 'best_finish';

export interface StatisticsQuery {
  season: number;
  subject: 'drivers';
  metrics: StatisticsMetricId[];
  filters: {
    roundFrom: number;
    roundTo: number;
    team: string | null;
    driverIds: string[];
  };
  groupBy: ['driver'];
  sort: Array<{
    metric: StatisticsMetricId;
    direction: 'asc' | 'desc';
  }>;
  limit: number;
}

export interface StatisticsValue {
  value: number | null;
  formatted: string;
  unit: string;
  sampleSize: number;
}

export interface StatisticsRow {
  id: string;
  entity: string;
  code?: string;
  team?: string;
  resultCount: number;
  values: Record<string, StatisticsValue>;
}

export interface StatisticsEvidence {
  id: string;
  driverId: string;
  driver: string;
  team?: string;
  round: number;
  grandPrix: string;
  position: number | null;
  grid: number | null;
  qualifying: number | null;
  points: number;
  status: string;
  raceRoute: string;
}

export interface StatisticsResult {
  data: {
    answer: {
      headline: string;
      summary: string;
    };
    query: StatisticsQuery;
    queryKey: string;
    interpretation: {
      mode: 'deterministic' | 'structured';
      confidence: number;
      notes: string[];
    };
    metric: {
      id: StatisticsMetricId;
      label: string;
      shortLabel: string;
      unit: string;
      direction: 'asc' | 'desc';
      methodology: string;
    };
    rows: StatisticsRow[];
    evidence: StatisticsEvidence[];
    sample: {
      driverCount: number;
      roundCount: number;
      resultCount: number;
      roundFrom: number;
      roundTo: number;
      label: string;
    };
    calculation: {
      metric: StatisticsMetricId;
      definition: string;
      methodologyRoute: string;
    };
    caveats: string[];
    relatedRoutes: Array<{
      label: string;
      path: string;
    }>;
  };
  meta: ApiMeta;
}

export interface StatisticsQuestionInput {
  question?: string;
  season?: number;
  query?: StatisticsQuery;
  interpretationMode?: 'structured';
}

export const statisticsMetricOptions = STATISTICS_METRIC_OPTIONS as Array<{
  id: StatisticsMetricId;
  label: string;
  direction: 'asc' | 'desc';
  unit: string;
  methodology: string;
}>;

const runTypedStatisticsQuery = runStatisticsQuery as unknown as (input: {
  input: StatisticsQuestionInput;
  directory: AnalysisEnvelope<DriverDirectoryData>;
}) => StatisticsResult;

const queryError = async (response: Response) => {
  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    issues?: string[];
  };
  return new Error(
    payload.issues?.length
      ? `${payload.error ?? 'Query validation failed'} ${payload.issues.join(' ')}`
      : payload.error ?? `Statistics query failed with ${response.status}`,
  );
};

export const executeStatisticsQuery = async (
  input: StatisticsQuestionInput,
  directory: AnalysisEnvelope<DriverDirectoryData>,
  signal?: AbortSignal,
): Promise<StatisticsResult> => {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return runTypedStatisticsQuery({ input, directory });
  }

  if (response.ok) {
    const payload = await response.json() as StatisticsResult;
    if (payload.data?.query && payload.meta?.schemaVersion) return payload;
    throw new Error('Statistics query returned an invalid response.');
  }
  if ([404, 405, 501].includes(response.status)) {
    return runTypedStatisticsQuery({ input, directory });
  }
  throw await queryError(response);
};
