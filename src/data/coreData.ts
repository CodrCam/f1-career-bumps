import { apiBaseUrl } from '../config/api.js';
import type {
  ApiMeta,
  PublicationState,
  RaceStorySummary,
  Standing,
} from './seasonOverview';

export interface ConstructorStanding extends Standing {
  drivers: Array<{
    name: string;
    code?: string;
    points: number;
  }>;
}

export interface StandingsData {
  year: number;
  throughRound: number;
  driverStandings: Standing[];
  constructorStandings: ConstructorStanding[];
}

export interface ResultCell {
  position: number | null;
  points: number;
  grid: number | null;
  gridDelta: number | null;
  status: string;
  team?: string;
}

export interface ResultsData {
  year: number;
  throughRound: number;
  races: Array<{
    round: number;
    grandPrix: string;
    date?: string;
    circuit?: string;
  }>;
  drivers: Array<{
    name: string;
    code?: string;
    team?: string;
    totalPoints: number;
    results: Record<number, ResultCell>;
  }>;
}

export interface RaceArchiveItem {
  round: number;
  grandPrix: string;
  date?: string;
  circuit?: string;
  state: PublicationState;
  storyReady: boolean;
  winner: null | {
    driver?: string;
    code?: string;
    team?: string;
    grid: number | null;
  };
  podium: Array<{
    position: number;
    driver?: string;
    code?: string;
    team?: string;
  }>;
  storySummary: RaceStorySummary | null;
  updatedAt?: string;
}

export interface RaceArchiveData {
  year: number;
  races: RaceArchiveItem[];
}

export interface ClassificationResult {
  position: number | null;
  driver?: string;
  code?: string;
  team?: string;
  points: number;
  grid: number | null;
  gridDelta: number | null;
  time: string | null;
  status: string;
}

export interface RaceAnalysis {
  summary: RaceStorySummary | null;
  definitions: Record<string, unknown> | null;
  circuitProfile: Record<string, unknown> | null;
  validationStatus: string | null;
  overtakeEvents: Array<Record<string, unknown>>;
  storyEvents: Array<Record<string, unknown>>;
  pitCycleEvents: Array<Record<string, unknown>>;
  attritionEvents: Array<Record<string, unknown>>;
  disruptionEvents: Array<Record<string, unknown>>;
  drivers: Array<Record<string, unknown>>;
}

export interface RaceDossierData {
  year: number;
  race: {
    round: number;
    grandPrix: string;
    date?: string;
    circuit?: string;
    state: PublicationState;
  };
  classification: ClassificationResult[];
  sprintClassification: Array<{
    position: number | null;
    driver?: string;
    code?: string;
    team?: string;
    points: number;
    status: string;
  }>;
  analysis: RaceAnalysis | null;
}

export interface CoreEnvelope<T> {
  data: T;
  meta: ApiMeta;
}

export type StandingsEnvelope = CoreEnvelope<StandingsData>;
export type ResultsEnvelope = CoreEnvelope<ResultsData>;
export type RaceArchiveEnvelope = CoreEnvelope<RaceArchiveData>;
export type RaceDossierEnvelope = CoreEnvelope<RaceDossierData>;

export interface CoreEnvelopeMap {
  standings: StandingsEnvelope;
  results: ResultsEnvelope;
  races: RaceArchiveEnvelope;
  race: RaceDossierEnvelope;
}

export type CoreResource = keyof CoreEnvelopeMap;

interface RawResult {
  position?: number;
  driver?: string;
  driver_code?: string;
  team?: string;
  points?: number;
  grid?: number;
  time?: string | null;
  status?: string;
}

interface RawRace {
  round: number;
  grand_prix: string;
  date?: string;
  circuit?: string;
  race_results?: RawResult[];
  sprint_results?: RawResult[];
  qualifying_results?: RawResult[];
  starting_grid?: RawResult[];
}

interface LegacySeason {
  races?: RawRace[];
  updatedAt?: string;
}

interface LegacySummary {
  results?: number;
  source?: string;
  updatedAt?: string;
}

interface LegacyAnalyticsRace {
  round: number;
  summary?: RaceStorySummary;
  updatedAt?: string;
}

interface LegacySeasonAnalytics {
  races?: LegacyAnalyticsRace[];
}

interface LegacyRaceAnalytics extends RaceAnalysis {
  updatedAt?: string;
}

interface LegacyStatus {
  round?: number;
  state: PublicationState;
  contentVersion?: string;
  publishedAt?: string;
  updatedAt?: string;
  lastAttemptAt?: string;
  missingCapabilities?: string[];
}

interface LegacyPublication {
  races?: LegacyStatus[];
}

const numberValue = (value: unknown, fallback = 0) => {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
};

const requestJson = async <T>(
  path: string,
  signal: AbortSignal,
  optional = false,
): Promise<T | null> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });
  if (optional && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Publication data request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const buildMeta = (
  year: number,
  state: PublicationState,
  summary: LegacySummary | null,
  status?: LegacyStatus | null,
  warnings: string[] = [],
): ApiMeta => {
  const publishedAt = status?.publishedAt
    ?? status?.updatedAt
    ?? status?.lastAttemptAt
    ?? summary?.updatedAt
    ?? new Date().toISOString();
  return {
    season: year,
    schemaVersion: '2.0-compat',
    contentVersion: status?.contentVersion ?? `season-${year}-${publishedAt}`,
    state,
    publishedAt,
    sources: summary?.source ? [summary.source] : [],
    warnings: [...new Set([...(status?.missingCapabilities ?? []), ...warnings])],
  };
};

const getRaceGrid = (race: RawRace, result: RawResult) => {
  if (Number.isFinite(Number(result.grid))) return Number(result.grid);
  const key = result.driver_code ?? result.driver;
  const gridResult = (race.starting_grid ?? race.qualifying_results ?? [])
    .find((entry) => (entry.driver_code ?? entry.driver) === key);
  return Number.isFinite(Number(gridResult?.position))
    ? Number(gridResult?.position)
    : null;
};

const standingsFor = (races: RawRace[]) => {
  const drivers = new Map<string, Omit<Standing, 'rank' | 'movement' | 'gapToLeader' | 'gapToAhead'>>();
  const constructors = new Map<string, { name: string; points: number }>();

  races.forEach((race) => {
    [...(race.race_results ?? []), ...(race.sprint_results ?? [])].forEach((result) => {
      const points = numberValue(result.points);
      if (result.driver) {
        const driver = drivers.get(result.driver) ?? {
          name: result.driver,
          code: result.driver_code,
          team: result.team,
          points: 0,
        };
        driver.points += points;
        driver.team = result.team ?? driver.team;
        drivers.set(result.driver, driver);
      }
      if (result.team) {
        const constructor = constructors.get(result.team) ?? {
          name: result.team,
          points: 0,
        };
        constructor.points += points;
        constructors.set(result.team, constructor);
      }
    });
  });

  const sort = <T extends { name: string; points: number }>(values: T[]) => (
    values.sort((left, right) => right.points - left.points || left.name.localeCompare(right.name))
  );
  return {
    drivers: sort([...drivers.values()]),
    constructors: sort([...constructors.values()]),
  };
};

const rankWithMovement = <T extends { name: string; points: number }>(
  current: T[],
  previous: T[],
): Array<T & Pick<Standing, 'rank' | 'movement' | 'gapToLeader' | 'gapToAhead'>> => {
  const oldRanks = new Map(previous.map((entry, index) => [entry.name, index + 1]));
  return current.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    movement: oldRanks.has(entry.name)
      ? (oldRanks.get(entry.name) as number) - (index + 1)
      : null,
    gapToLeader: index ? current[0].points - entry.points : 0,
    gapToAhead: index ? current[index - 1].points - entry.points : null,
  }));
};

interface LegacyBundle {
  season: LegacySeason;
  summary: LegacySummary | null;
  seasonAnalytics: LegacySeasonAnalytics | null;
  publication: LegacyPublication | null;
}

const getLegacyBundle = async (
  year: number,
  signal: AbortSignal,
): Promise<LegacyBundle> => {
  const [season, summary, seasonAnalytics, publication] = await Promise.all([
    requestJson<LegacySeason>(`/api/seasons/${year}`, signal),
    requestJson<LegacySummary>(`/api/seasons/${year}/summary`, signal, true),
    requestJson<LegacySeasonAnalytics>(`/api/seasons/${year}/analytics`, signal, true),
    requestJson<LegacyPublication>(`/api/seasons/${year}/status`, signal, true),
  ]);
  if (!season) throw new Error(`No season data found for ${year}`);
  return { season, summary, seasonAnalytics, publication };
};

const latestState = (
  races: RawRace[],
  statuses: Map<number, LegacyStatus>,
  analyses?: Map<number, LegacyAnalyticsRace>,
) => {
  const latest = races.at(-1);
  if (!latest) return { state: 'scheduled' as PublicationState, status: null };
  const status = statuses.get(numberValue(latest.round));
  return {
    state: status?.state
      ?? (analyses?.has(numberValue(latest.round)) ? 'published' : 'results_ready'),
    status,
  };
};

const legacyStandings = (
  year: number,
  bundle: LegacyBundle,
): StandingsEnvelope => {
  const races = [...(bundle.season.races ?? [])].sort((a, b) => a.round - b.round);
  const current = standingsFor(races);
  const previous = standingsFor(races.slice(0, -1));
  const statuses = new Map(
    (bundle.publication?.races ?? []).map((status) => [numberValue(status.round), status]),
  );
  const contributions = new Map<string, Map<string, { name: string; code?: string; points: number }>>();

  races.forEach((race) => {
    [...(race.race_results ?? []), ...(race.sprint_results ?? [])].forEach((result) => {
      if (!result.team || !result.driver) return;
      const team = contributions.get(result.team) ?? new Map();
      const driver = team.get(result.driver) ?? {
        name: result.driver,
        code: result.driver_code,
        points: 0,
      };
      driver.points += numberValue(result.points);
      team.set(result.driver, driver);
      contributions.set(result.team, team);
    });
  });

  const currentState = latestState(races, statuses);
  return {
    data: {
      year,
      throughRound: races.at(-1)?.round ?? 0,
      driverStandings: rankWithMovement(current.drivers, previous.drivers),
      constructorStandings: rankWithMovement(current.constructors, previous.constructors)
        .map((standing) => ({
          ...standing,
          drivers: [...(contributions.get(standing.name)?.values() ?? [])]
            .sort((left, right) => right.points - left.points),
        })),
    },
    meta: buildMeta(year, currentState.state, bundle.summary, currentState.status),
  };
};

const legacyResults = (
  year: number,
  bundle: LegacyBundle,
): ResultsEnvelope => {
  const races = [...(bundle.season.races ?? [])].sort((a, b) => a.round - b.round);
  const statuses = new Map(
    (bundle.publication?.races ?? []).map((status) => [numberValue(status.round), status]),
  );
  const standings = standingsFor(races).drivers;
  const rank = new Map(standings.map((driver, index) => [driver.name, index]));
  const drivers = new Map<string, ResultsData['drivers'][number]>();

  races.forEach((race) => {
    (race.race_results ?? []).forEach((result) => {
      if (!result.driver) return;
      const driver = drivers.get(result.driver) ?? {
        name: result.driver,
        code: result.driver_code,
        team: result.team,
        totalPoints: 0,
        results: {},
      };
      const position = Number.isFinite(Number(result.position)) ? Number(result.position) : null;
      const grid = getRaceGrid(race, result);
      driver.totalPoints += numberValue(result.points);
      driver.results[race.round] = {
        position,
        points: numberValue(result.points),
        grid,
        gridDelta: grid !== null && position !== null ? grid - position : null,
        status: result.status ?? (position ? 'Finished' : 'Unclassified'),
        team: result.team,
      };
      drivers.set(result.driver, driver);
    });
  });

  const currentState = latestState(races, statuses);
  return {
    data: {
      year,
      throughRound: races.at(-1)?.round ?? 0,
      races: races.map((race) => ({
        round: race.round,
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
      })),
      drivers: [...drivers.values()].sort((left, right) => (
        (rank.get(left.name) ?? 999) - (rank.get(right.name) ?? 999)
      )),
    },
    meta: buildMeta(year, currentState.state, bundle.summary, currentState.status),
  };
};

const legacyArchive = (
  year: number,
  bundle: LegacyBundle,
): RaceArchiveEnvelope => {
  const races = [...(bundle.season.races ?? [])].sort((a, b) => a.round - b.round);
  const statuses = new Map(
    (bundle.publication?.races ?? []).map((status) => [numberValue(status.round), status]),
  );
  const analyses = new Map(
    (bundle.seasonAnalytics?.races ?? []).map((analysis) => [numberValue(analysis.round), analysis]),
  );
  const currentState = latestState(races, statuses, analyses);

  return {
    data: {
      year,
      races: races.map((race) => {
        const status = statuses.get(race.round);
        const analysis = analyses.get(race.round);
        const winner = race.race_results?.[0];
        return {
          round: race.round,
          grandPrix: race.grand_prix,
          date: race.date,
          circuit: race.circuit,
          state: status?.state ?? (analysis ? 'published' : 'results_ready'),
          storyReady: Boolean(analysis),
          winner: winner
            ? {
              driver: winner.driver,
              code: winner.driver_code,
              team: winner.team,
              grid: getRaceGrid(race, winner),
            }
            : null,
          podium: (race.race_results ?? []).slice(0, 3).map((result) => ({
            position: numberValue(result.position),
            driver: result.driver,
            code: result.driver_code,
            team: result.team,
          })),
          storySummary: analysis?.summary ?? null,
          updatedAt: status?.updatedAt
            ?? status?.lastAttemptAt
            ?? analysis?.updatedAt
            ?? bundle.summary?.updatedAt,
        };
      }),
    },
    meta: buildMeta(year, currentState.state, bundle.summary, currentState.status),
  };
};

const legacyDossier = async (
  year: number,
  round: number,
  bundle: LegacyBundle,
  signal: AbortSignal,
): Promise<RaceDossierEnvelope> => {
  const race = bundle.season.races?.find((entry) => entry.round === round);
  if (!race) throw new Error(`No race found for ${year} round ${round}`);
  const [analysis, status] = await Promise.all([
    requestJson<LegacyRaceAnalytics>(
      `/api/seasons/${year}/races/${round}/analytics`,
      signal,
      true,
    ),
    requestJson<LegacyStatus>(
      `/api/seasons/${year}/races/${round}/status`,
      signal,
      true,
    ),
  ]);
  const state = status?.state ?? (analysis ? 'published' : 'results_ready');

  return {
    data: {
      year,
      race: {
        round,
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
        state,
      },
      classification: (race.race_results ?? []).map((result) => {
        const position = Number.isFinite(Number(result.position)) ? Number(result.position) : null;
        const grid = getRaceGrid(race, result);
        return {
          position,
          driver: result.driver,
          code: result.driver_code,
          team: result.team,
          points: numberValue(result.points),
          grid,
          gridDelta: grid !== null && position !== null ? grid - position : null,
          time: result.time ?? null,
          status: result.status ?? (position ? 'Finished' : 'Unclassified'),
        };
      }),
      sprintClassification: (race.sprint_results ?? []).map((result) => ({
        position: Number.isFinite(Number(result.position)) ? Number(result.position) : null,
        driver: result.driver,
        code: result.driver_code,
        team: result.team,
        points: numberValue(result.points),
        status: result.status ?? 'Finished',
      })),
      analysis,
    },
    meta: buildMeta(
      year,
      state,
      bundle.summary,
      status,
      analysis ? [] : ['Detailed timing analysis is not yet published.'],
    ),
  };
};

export const getCoreData = async <R extends CoreResource>(
  year: number,
  resource: R,
  signal: AbortSignal,
  round?: number,
): Promise<CoreEnvelopeMap[R]> => {
  const suffix = resource === 'race' ? `races/${round}` : resource;
  const response = await fetch(
    `${apiBaseUrl}/api/v2/seasons/${year}/${suffix}`,
    { signal },
  );
  if (response.ok) {
    const candidate = await response.json() as Partial<CoreEnvelopeMap[R]>;
    if (candidate.data && candidate.meta?.schemaVersion) {
      return candidate as CoreEnvelopeMap[R];
    }
  }
  if (response.status !== 404) {
    if (!response.ok) {
      throw new Error(`Publication data request failed with ${response.status}`);
    }
  }

  const bundle = await getLegacyBundle(year, signal);
  if (resource === 'standings') {
    return legacyStandings(year, bundle) as CoreEnvelopeMap[R];
  }
  if (resource === 'results') {
    return legacyResults(year, bundle) as CoreEnvelopeMap[R];
  }
  if (resource === 'races') {
    return legacyArchive(year, bundle) as CoreEnvelopeMap[R];
  }
  if (!Number.isInteger(round)) throw new Error('A valid race round is required.');
  return legacyDossier(year, round as number, bundle, signal) as Promise<CoreEnvelopeMap[R]>;
};
