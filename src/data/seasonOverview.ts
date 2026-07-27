import { apiBaseUrl } from '../config/api.js';

export type PublicationState =
  | 'scheduled'
  | 'awaiting_results'
  | 'results_ready'
  | 'awaiting_timing'
  | 'timing_ready'
  | 'published'
  | 'degraded'
  | 'failed';

export interface Standing {
  name: string;
  code?: string;
  team?: string;
  points: number;
  rank: number;
  movement: number | null;
  gapToLeader: number;
  gapToAhead: number | null;
}

export interface PodiumResult {
  position: number;
  driver?: string;
  code?: string;
  team?: string;
  points: number;
  grid: number | null;
}

export interface RaceStorySummary {
  estimated_true_overtakes?: number;
  retained_overtakes?: number;
  traffic_exposure_laps?: number;
  pit_cycles?: number;
  attrition_events?: number;
}

export interface SeasonOverview {
  year: number;
  completedRounds: number;
  resultsCount?: number;
  latestRace: null | {
    round: number;
    grandPrix: string;
    date?: string;
    circuit?: string;
    state: PublicationState;
    podium: PodiumResult[];
    storySummary: RaceStorySummary | null;
    updatedAt?: string;
  };
  driverStandings: Standing[];
  constructorStandings: Standing[];
  coverage: {
    completedRounds: number;
    storyReadyRounds: number;
    publishedRounds: number[];
    incompleteRounds: Array<{
      round: number;
      grandPrix: string;
      state: PublicationState;
    }>;
  };
}

export interface ApiMeta {
  season: number;
  schemaVersion: string;
  contentVersion: string;
  state: PublicationState;
  publishedAt: string;
  sources: string[];
  warnings: string[];
}

export interface SeasonOverviewEnvelope {
  data: SeasonOverview;
  meta: ApiMeta;
}

const requestJson = async <T>(
  path: string,
  signal: AbortSignal,
  optional = false,
): Promise<T | null> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });

  if (optional && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Season desk request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
};

interface LegacyResult {
  position?: number;
  driver?: string;
  driver_code?: string;
  team?: string;
  points?: number;
  grid?: number;
}

interface LegacyRace {
  round: number;
  grand_prix: string;
  date?: string;
  circuit?: string;
  race_results?: LegacyResult[];
  sprint_results?: LegacyResult[];
  starting_grid?: LegacyResult[];
}

interface LegacySeason {
  races?: LegacyRace[];
  updatedAt?: string;
}

interface LegacyAnalytics {
  races?: Array<{
    round: number;
    summary?: RaceStorySummary;
    updatedAt?: string;
  }>;
}

interface LegacyPublication {
  races?: Array<{
    round: number;
    state: PublicationState;
    contentVersion?: string;
    updatedAt?: string;
    lastAttemptAt?: string;
    missingCapabilities?: string[];
  }>;
}

interface LegacySummary {
  results?: number;
  source?: string;
  updatedAt?: string;
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

const validAnalytics = (value: LegacyAnalytics | null): LegacyAnalytics | null => {
  const races = value?.races?.filter((candidate) => (
    candidate
    && Number.isFinite(Number(candidate.round))
    && (
      candidate.summary !== undefined
      || candidate.updatedAt !== undefined
    )
    && !('grand_prix' in candidate)
  )) ?? [];
  return races.length ? { races } : null;
};

const validPublication = (value: LegacyPublication | null): LegacyPublication | null => {
  const races = value?.races?.filter((candidate) => (
    candidate
    && typeof candidate.state === 'string'
    && publicationStates.has(candidate.state)
  )) ?? [];
  return races.length ? { races } : null;
};

const buildLegacyStandings = (races: LegacyRace[], field: 'driver' | 'team') => {
  const totals = new Map<string, { name: string; code?: string; team?: string; points: number }>();

  races.forEach((race) => {
    [...(race.race_results ?? []), ...(race.sprint_results ?? [])].forEach((result) => {
      const name = field === 'driver' ? result.driver : result.team;
      if (!name) return;
      const current = totals.get(name) ?? {
        name,
        code: field === 'driver' ? result.driver_code : undefined,
        team: field === 'driver' ? result.team : undefined,
        points: 0,
      };
      current.points += Number(result.points) || 0;
      totals.set(name, current);
    });
  });

  return [...totals.values()].sort((left, right) => (
    right.points - left.points || left.name.localeCompare(right.name)
  ));
};

const withLegacyMovement = (
  current: ReturnType<typeof buildLegacyStandings>,
  previous: ReturnType<typeof buildLegacyStandings>,
): Standing[] => {
  const previousRanks = new Map(previous.map((entry, index) => [entry.name, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    movement: previousRanks.has(entry.name)
      ? (previousRanks.get(entry.name) as number) - (index + 1)
      : null,
    gapToLeader: index === 0 ? 0 : current[0].points - entry.points,
    gapToAhead: index === 0 ? null : current[index - 1].points - entry.points,
  }));
};

const buildLegacyEnvelope = (
  year: number,
  season: LegacySeason,
  summary: LegacySummary | null,
  analytics: LegacyAnalytics | null,
  publication: LegacyPublication | null,
): SeasonOverviewEnvelope => {
  const races = [...(season.races ?? [])].sort((left, right) => left.round - right.round);
  const latestRace = races.at(-1);
  const priorRaces = latestRace ? races.slice(0, -1) : [];
  const analyticsByRound = new Map(
    (analytics?.races ?? []).map((race) => [Number(race.round), race]),
  );
  const statusByRound = new Map(
    (publication?.races ?? []).map((status) => [Number(status.round), status]),
  );
  const latestStatus = latestRace ? statusByRound.get(Number(latestRace.round)) : undefined;
  const latestAnalytics = latestRace ? analyticsByRound.get(Number(latestRace.round)) : undefined;
  const latestGridByDriver = new Map(
    (latestRace?.starting_grid ?? []).map((result) => [
      result.driver_code ?? result.driver,
      Number(result.position),
    ]),
  );
  const state = latestStatus?.state
    ?? (latestAnalytics ? 'published' : latestRace ? 'results_ready' : 'scheduled');
  const publishedAt = latestStatus?.updatedAt
    ?? latestStatus?.lastAttemptAt
    ?? latestAnalytics?.updatedAt
    ?? summary?.updatedAt
    ?? new Date().toISOString();
  const publishedRounds = [...analyticsByRound.keys()];

  return {
    data: {
      year,
      completedRounds: races.length,
      resultsCount: summary?.results,
      latestRace: latestRace
        ? {
          round: Number(latestRace.round),
          grandPrix: latestRace.grand_prix,
          date: latestRace.date,
          circuit: latestRace.circuit,
          state,
          podium: (latestRace.race_results ?? []).slice(0, 3).map((result) => ({
            position: Number(result.position),
            driver: result.driver,
            code: result.driver_code,
            team: result.team,
            points: Number(result.points) || 0,
            grid: Number.isFinite(Number(result.grid))
              ? Number(result.grid)
              : latestGridByDriver.get(result.driver_code ?? result.driver) ?? null,
          })),
          storySummary: latestAnalytics?.summary ?? null,
          updatedAt: latestAnalytics?.updatedAt ?? summary?.updatedAt,
        }
        : null,
      driverStandings: withLegacyMovement(
        buildLegacyStandings(races, 'driver'),
        buildLegacyStandings(priorRaces, 'driver'),
      ),
      constructorStandings: withLegacyMovement(
        buildLegacyStandings(races, 'team'),
        buildLegacyStandings(priorRaces, 'team'),
      ),
      coverage: {
        completedRounds: races.length,
        storyReadyRounds: publishedRounds.length,
        publishedRounds,
        incompleteRounds: races
          .filter((race) => !analyticsByRound.has(Number(race.round)))
          .map((race) => ({
            round: Number(race.round),
            grandPrix: race.grand_prix,
            state: statusByRound.get(Number(race.round))?.state ?? 'results_ready',
          })),
      },
    },
    meta: {
      season: year,
      schemaVersion: '2.0-compat',
      contentVersion: latestStatus?.contentVersion
        ?? `season-${year}-${summary?.updatedAt ?? races.length}`,
      state,
      publishedAt,
      sources: summary?.source ? [summary.source] : [],
      warnings: latestStatus?.missingCapabilities ?? [],
    },
  };
};

export const getSeasonOverview = async (
  year: number,
  signal: AbortSignal,
): Promise<SeasonOverviewEnvelope> => {
  const v2Response = await fetch(
    `${apiBaseUrl}/api/v2/seasons/${year}/overview`,
    { signal },
  );

  if (v2Response.ok) {
    const candidate = await v2Response.json() as Partial<SeasonOverviewEnvelope>;
    if (candidate.data?.year && candidate.meta?.schemaVersion) {
      return candidate as SeasonOverviewEnvelope;
    }
  }
  if (!v2Response.ok && v2Response.status !== 404) {
    throw new Error(`Season desk request failed with ${v2Response.status}`);
  }

  const [season, summary, analytics, publication] = await Promise.all([
    requestJson<LegacySeason>(`/api/seasons/${year}`, signal),
    requestJson<LegacySummary>(`/api/seasons/${year}/summary`, signal, true),
    requestJson<LegacyAnalytics>(`/api/seasons/${year}/analytics`, signal, true),
    requestJson<LegacyPublication>(`/api/seasons/${year}/status`, signal, true),
  ]);

  if (!season) throw new Error(`No season data found for ${year}`);
  return buildLegacyEnvelope(
    year,
    season,
    summary,
    validAnalytics(analytics),
    validPublication(publication),
  );
};
