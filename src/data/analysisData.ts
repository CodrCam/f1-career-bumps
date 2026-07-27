import {
  buildCompareReadModel,
  buildDriverDirectoryReadModel,
  buildDriverProfileReadModel,
  buildPaceCatalogReadModel,
  buildPitLaneReadModel,
} from '../../server/analysisReadModels.js';
import { apiBaseUrl } from '../config/api.js';
import type {
  ApiMeta,
  PublicationState,
} from './seasonOverview';

export interface DriverRoundResult {
  round: number;
  grandPrix: string;
  date?: string;
  circuit?: string;
  team?: string;
  position: number | null;
  grid: number | null;
  gridDelta: number | null;
  points: number;
  sprintPosition: number | null;
  sprintPoints: number;
  qualifying: number | null;
  status: string;
  time: string | null;
}

export interface AnalysisDriver {
  id: string;
  name: string;
  code?: string;
  team?: string;
  rank: number;
  points: number;
  starts: number;
  wins: number;
  podiums: number;
  pointsFinishes: number;
  dnfs: number;
  averageFinish: number | null;
  averageGrid: number | null;
  averageQualifying: number | null;
  pointsPerStart: number;
  reliability: number;
  recentForm: DriverRoundResult[];
  latestFinish: DriverRoundResult | null;
  bestResult: DriverRoundResult | null;
  worstResult: DriverRoundResult | null;
  teammates: string[];
  results: DriverRoundResult[];
}

export interface DriverDirectoryData {
  year: number;
  throughRound: number;
  races: Array<{
    round: number;
    grandPrix: string;
    date?: string;
    circuit?: string;
  }>;
  drivers: AnalysisDriver[];
  teams: string[];
}

export interface DriverProfileData {
  year: number;
  throughRound: number;
  driver: AnalysisDriver;
  teammate: AnalysisDriver | null;
}

export interface CompareData {
  year: number;
  throughRound: number;
  drivers: AnalysisDriver[];
}

export interface PaceCatalogData {
  year: number;
  races: Array<{
    round: number;
    grandPrix: string;
    date?: string;
    circuit?: string;
    detailedTimingReady: boolean;
    state: PublicationState;
    circuitProfile: Record<string, unknown> | null;
  }>;
}

export interface PitStopRecord {
  id: string;
  round: number;
  grandPrix?: string;
  circuit?: string;
  driver?: string;
  driverCode?: string | null;
  team?: string;
  lap: number | null;
  serviceTime: number | null;
  pitLaneTime: number | null;
  transitTime: number | null;
  laneDelta: number | null;
  transitDelta: number | null;
  hasBreakdown: boolean;
  serviceSource?: string | null;
  pitLaneSource?: string | null;
  expectedServiceTime?: number | null;
  expectedPitLaneTime?: number | null;
  expectedTransitTime?: number | null;
  serviceAnomalyScore?: number | null;
  laneAnomalyScore?: number | null;
  transitAnomalyScore?: number | null;
  anomalyScore?: number;
  anomalyType?: string;
  anomalyLabel?: string;
  isAnomaly?: boolean;
  explanationStatus?: 'confirmed' | 'likely' | 'unexplained';
  explanation?: string;
  evidence?: Array<{
    kind: string;
    source?: string;
    eventId?: string;
    message?: string;
  }>;
}

export interface PitRanking {
  entity: string;
  team?: string;
  stops: number;
  serviceStops: number;
  pitLaneStops: number;
  matchedStops: number;
  serviceMedian: number | null;
  serviceAverage: number | null;
  serviceFastest: number | null;
  serviceConsistency: number | null;
  pitLaneMedian: number | null;
  pitLaneFastest: number | null;
  transitMedian: number | null;
  laneDeltaMedian: number | null;
  breakdownCoverage: number;
  records: PitStopRecord[];
}

export interface PitLaneData {
  year: number;
  throughRound: number;
  races: DriverDirectoryData['races'];
  coverage: {
    records: number;
    serviceStops: number;
    pitLaneStops: number;
    matchedStops: number;
    fastestService: PitStopRecord | null;
    quickestPitLane: PitStopRecord | null;
    bestTransitDelta: PitStopRecord | null;
  };
  teamRankings: PitRanking[];
  driverRankings: PitRanking[];
  records: PitStopRecord[];
}

export interface AnalysisEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export interface AnalysisEnvelopeMap {
  drivers: AnalysisEnvelope<DriverDirectoryData>;
  driver: AnalysisEnvelope<DriverProfileData>;
  compare: AnalysisEnvelope<CompareData>;
  pace: AnalysisEnvelope<PaceCatalogData>;
  'pit-lane': AnalysisEnvelope<PitLaneData>;
}

export type AnalysisResource = keyof AnalysisEnvelopeMap;

const buildTypedPitLaneReadModel = buildPitLaneReadModel as unknown as (input: {
  year: number;
  season: LegacySeason;
  summary: LegacySummary | null;
  publication: LegacyPublication | null;
  legacyDhlData: unknown[];
}) => AnalysisEnvelope<PitLaneData>;

interface LegacySeason {
  races?: Array<Record<string, unknown> & {
    round: number;
    race_results?: Array<Record<string, unknown>>;
  }>;
}

interface LegacySummary {
  source?: string;
  updatedAt?: string;
}

interface LegacyPublication {
  races?: Array<{
    round: number;
    state: PublicationState;
    contentVersion?: string;
    publishedAt?: string;
    updatedAt?: string;
    lastAttemptAt?: string;
    missingCapabilities?: string[];
  }>;
}

interface LegacyAnalytics {
  races?: Array<{
    round: number;
    summary?: Record<string, unknown>;
    validationStatus?: string;
    circuitProfile?: Record<string, unknown>;
  }>;
}

const publicationStates = new Set<PublicationState>([
  'scheduled',
  'awaiting_results',
  'results_ready',
  'awaiting_timing',
  'timing_ready',
  'published',
  'degraded',
  'failed',
]);

const validPublication = (value: LegacyPublication | null): LegacyPublication | null => {
  const races = value?.races?.filter((candidate) => (
    candidate
    && typeof candidate.state === 'string'
    && publicationStates.has(candidate.state)
  )) ?? [];
  return races.length ? { races } : null;
};

const validAnalytics = (value: LegacyAnalytics | null): LegacyAnalytics | null => {
  const races = value?.races?.filter((candidate) => (
    candidate
    && Number.isFinite(Number(candidate.round))
    && (
      candidate.summary !== undefined
      || candidate.validationStatus !== undefined
      || candidate.circuitProfile !== undefined
    )
  )) ?? [];
  return races.length ? { races } : null;
};

const requestJson = async <T>(
  path: string,
  signal: AbortSignal,
  optional = false,
): Promise<T | null> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });
  if (optional && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Analysis data request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const mergePitFallback = (
  season: LegacySeason,
  fallback: { races?: NonNullable<LegacySeason['races']> },
): LegacySeason => {
  const racesByRound = new Map(
    (fallback.races ?? []).map(
      (race) => [Number(race.round), race as Record<string, unknown>],
    ),
  );
  (season.races ?? []).forEach((race) => {
    const current = racesByRound.get(Number(race.round));
    racesByRound.set(Number(race.round), {
      ...current,
      ...race,
      pit_stops: Array.isArray(race.pit_stops) && race.pit_stops.length
        ? race.pit_stops
        : current?.pit_stops ?? [],
      dhl_pit_stops: Array.isArray(race.dhl_pit_stops) && race.dhl_pit_stops.length
        ? race.dhl_pit_stops
        : current?.dhl_pit_stops ?? [],
    });
  });
  return {
    ...season,
    races: [...racesByRound.values()].sort(
      (left, right) => Number(left.round) - Number(right.round),
    ) as NonNullable<LegacySeason['races']>,
  };
};

const getLegacySource = async (year: number, signal: AbortSignal) => {
  const [season, summary, publication, analytics] = await Promise.all([
    requestJson<LegacySeason>(`/api/seasons/${year}`, signal),
    requestJson<LegacySummary>(`/api/seasons/${year}/summary`, signal, true),
    requestJson<LegacyPublication>(`/api/seasons/${year}/status`, signal, true),
    requestJson<LegacyAnalytics>(`/api/seasons/${year}/analytics`, signal, true),
  ]);
  if (!season) throw new Error(`No season data found for ${year}`);
  return {
    season,
    summary,
    publication: validPublication(publication),
    analytics: validAnalytics(analytics),
  };
};

export const getAnalysisData = async <R extends AnalysisResource>(
  year: number,
  resource: R,
  signal: AbortSignal,
  driverId?: string,
): Promise<AnalysisEnvelopeMap[R]> => {
  const suffix = resource === 'driver' ? `drivers/${driverId}` : resource;
  const response = await fetch(
    `${apiBaseUrl}/api/v2/seasons/${year}/${suffix}`,
    { signal },
  );
  if (response.ok) {
    const candidate = await response.json() as Partial<AnalysisEnvelopeMap[R]>;
    if (candidate.data && candidate.meta?.schemaVersion) {
      return candidate as AnalysisEnvelopeMap[R];
    }
  } else if (response.status !== 404) {
    throw new Error(`Analysis data request failed with ${response.status}`);
  }

  const source = await getLegacySource(year, signal);
  if (resource === 'drivers') {
    return buildDriverDirectoryReadModel({ year, ...source }) as AnalysisEnvelopeMap[R];
  }
  if (resource === 'driver') {
    const profile = buildDriverProfileReadModel({ year, driverId, ...source });
    if (!profile) throw new Error(`No driver found for ${year}: ${driverId}`);
    return profile as AnalysisEnvelopeMap[R];
  }
  if (resource === 'compare') {
    return buildCompareReadModel({ year, ...source }) as AnalysisEnvelopeMap[R];
  }
  if (resource === 'pace') {
    return buildPaceCatalogReadModel({ year, ...source }) as AnalysisEnvelopeMap[R];
  }

  const [pitFallbackModule, legacyDhlModule] = await Promise.all([
    Number(year) === 2025
      ? import('./pitStopTiming2025.json')
      : import('./pitStopTiming2026.json'),
    Number(year) === 2025
      ? import('./Driver_Pitstop.json')
      : Promise.resolve({ default: [] }),
  ]);
  const season = mergePitFallback(
    source.season,
    pitFallbackModule.default as unknown as {
      races: NonNullable<LegacySeason['races']>;
    },
  );
  return buildTypedPitLaneReadModel({
    year,
    ...source,
    season,
    legacyDhlData: legacyDhlModule.default,
  }) as AnalysisEnvelopeMap[R];
};
