import { apiBaseUrl } from '../config/api.js';

export interface PaceSession {
  sessionKey: number;
  sessionName: string;
  meetingName: string;
  location: string;
  country: string;
  dateStart: string;
  dateEnd?: string;
}

export interface PaceDriver {
  driverNumber: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
  validLaps: number;
  bestLap: number | null;
  averageLap: number | null;
  consistency: number | null;
  bestSectors: [number | null, number | null, number | null];
  averageSectors: [number | null, number | null, number | null];
  theoreticalBest: number | null;
}

export interface PaceSessionData {
  sessionKey: number;
  drivers: PaceDriver[];
  validLaps: number;
  fetchedAt: string;
}

interface PaceCatalogRace {
  round: number;
  grandPrix: string;
  date?: string;
  circuit?: string;
  detailedTimingReady: boolean;
}

interface OwnedTimingResult {
  driver_number?: string | null;
  broadcast_name?: string | null;
  driver_id?: string | null;
  abbreviation: string;
  team_name?: string | null;
  team_color?: string | null;
}

interface OwnedTimingLap {
  driver: string;
  lap_time?: number | null;
  sector1_time?: number | null;
  sector2_time?: number | null;
  sector3_time?: number | null;
  pit_out_time?: number | null;
  deleted?: boolean;
}

interface OwnedTimingSnapshot {
  source?: {
    name?: string;
  };
  session?: {
    date_start?: string;
  };
  results?: OwnedTimingResult[];
  laps?: OwnedTimingLap[];
}

const requestOwnedJson = async <T>(
  path: string,
  signal: AbortSignal,
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Slipstream has not published owned timing for this session yet'
        : `Slipstream timing request failed with ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
};

const finite = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
};

const average = (values: Array<number | null>) => {
  const samples = values.filter((value): value is number => Number.isFinite(value));
  return samples.length
    ? samples.reduce((sum, value) => sum + value, 0) / samples.length
    : null;
};

const standardDeviation = (values: number[]) => {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length,
  );
};

const minimum = (values: Array<number | null>) => {
  const samples = values.filter((value): value is number => Number.isFinite(value));
  return samples.length ? Math.min(...samples) : null;
};

export const getPaceSessions = async (
  year: number,
  signal: AbortSignal,
): Promise<PaceSession[]> => {
  const catalog = await requestOwnedJson<{
    data?: { races?: PaceCatalogRace[] };
  }>(`/api/v2/seasons/${year}/pace`, signal);

  return (catalog.data?.races ?? [])
    .filter((race) => race.detailedTimingReady)
    .sort((left, right) => right.round - left.round)
    .map((race) => ({
      sessionKey: Number(race.round),
      sessionName: 'Race',
      meetingName: race.grandPrix,
      location: race.circuit ?? 'Circuit unavailable',
      country: '',
      dateStart: race.date ?? `${year}-01-01T00:00:00.000Z`,
    }));
};

export const getPaceSessionData = async (
  year: number,
  sessionKey: number,
  signal: AbortSignal,
): Promise<PaceSessionData> => {
  const timing = await requestOwnedJson<OwnedTimingSnapshot>(
    `/api/v2/seasons/${year}/races/${sessionKey}/timing`,
    signal,
  );
  const resultByCode = new Map(
    (timing.results ?? []).map((result) => [
      String(result.abbreviation).toUpperCase(),
      result,
    ]),
  );
  const lapsByDriver = new Map<string, OwnedTimingLap[]>();

  (timing.laps ?? []).forEach((lap) => {
    const driver = String(lap.driver ?? '').toUpperCase();
    const lapDuration = finite(lap.lap_time);
    if (!driver || !lapDuration || lapDuration > 300 || lap.pit_out_time != null || lap.deleted) {
      return;
    }
    const current = lapsByDriver.get(driver) ?? [];
    current.push(lap);
    lapsByDriver.set(driver, current);
  });

  const paceDrivers = [...lapsByDriver.entries()].map(([driver, driverLaps], index) => {
    const result = resultByCode.get(driver);
    const lapTimes = driverLaps
      .map((lap) => finite(lap.lap_time))
      .filter((value): value is number => value !== null);
    const sectors = [0, 1, 2].map((sectorIndex) => {
      const values = driverLaps.map((lap) => finite([
        lap.sector1_time,
        lap.sector2_time,
        lap.sector3_time,
      ][sectorIndex]));
      return {
        best: minimum(values),
        average: average(values),
      };
    });
    const bestSectors = sectors.map((sector) => sector.best) as PaceDriver['bestSectors'];
    const theoreticalBest = bestSectors.every(Number.isFinite)
      ? bestSectors.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
    const rawColor = result?.team_color?.replace('#', '');
    const providedNumber = finite(result?.driver_number);

    return {
      driverNumber: providedNumber ?? 1000 + index,
      name: result?.broadcast_name ?? result?.driver_id ?? driver,
      acronym: driver,
      team: result?.team_name ?? 'Team unavailable',
      color: rawColor ? `#${rawColor}` : '#929ba8',
      validLaps: lapTimes.length,
      bestLap: minimum(lapTimes),
      averageLap: average(lapTimes),
      consistency: standardDeviation(lapTimes),
      bestSectors,
      averageSectors: sectors.map((sector) => sector.average) as PaceDriver['averageSectors'],
      theoreticalBest,
    };
  }).sort((left, right) => (
    (left.bestLap ?? Number.MAX_SAFE_INTEGER)
    - (right.bestLap ?? Number.MAX_SAFE_INTEGER)
  ));

  return {
    sessionKey,
    drivers: paceDrivers,
    validLaps: paceDrivers.reduce((sum, driver) => sum + driver.validLaps, 0),
    fetchedAt: new Date().toISOString(),
  };
};
