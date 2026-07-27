import { normalizeDriverTeamFields } from '../utils/dataProcessing.js';

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

interface OpenF1Session {
  session_key: number;
  session_name: string;
  meeting_name?: string;
  location?: string;
  country_name?: string;
  date_start: string;
  date_end?: string;
}

interface OpenF1Driver {
  driver_number: number;
  full_name?: string;
  broadcast_name?: string;
  name_acronym?: string;
  team_name?: string;
  team_colour?: string;
}

interface OpenF1Lap {
  driver_number: number;
  lap_duration?: number;
  duration_sector_1?: number;
  duration_sector_2?: number;
  duration_sector_3?: number;
  is_pit_out_lap?: boolean;
}

const apiBase = 'https://api.openf1.org/v1';

const wait = (duration: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timeout = window.setTimeout(resolve, duration);
  signal.addEventListener('abort', () => {
    window.clearTimeout(timeout);
    reject(new DOMException('Request aborted', 'AbortError'));
  }, { once: true });
});

const requestOpenF1 = async <T>(
  path: string,
  signal: AbortSignal,
  attempts = 3,
): Promise<T> => {
  let response: Response | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(`${apiBase}${path}`, { signal });
    if (response.status !== 429) break;
    const retryAfter = Number(response.headers.get('retry-after'));
    await wait(Number.isFinite(retryAfter) ? retryAfter * 1000 : 700 * (attempt + 1), signal);
  }
  if (!response?.ok) {
    throw new Error(`OpenF1 timing request failed with ${response?.status ?? 'no response'}`);
  }
  return response.json() as Promise<T>;
};

const finite = (value: unknown) => {
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
  const sessions = await requestOpenF1<OpenF1Session[]>(
    `/sessions?year=${year}`,
    signal,
  );
  const now = Date.now();
  return sessions
    .filter((session) => ['Race', 'Qualifying', 'Sprint'].includes(session.session_name))
    .filter((session) => {
      const end = new Date(session.date_end ?? session.date_start).valueOf();
      return Number.isFinite(end) && end <= now;
    })
    .sort((left, right) => (
      new Date(right.date_start).valueOf() - new Date(left.date_start).valueOf()
    ))
    .map((session) => ({
      sessionKey: session.session_key,
      sessionName: session.session_name,
      meetingName: session.meeting_name ?? session.location ?? 'Formula 1 session',
      location: session.location ?? 'Circuit unavailable',
      country: session.country_name ?? '',
      dateStart: session.date_start,
      dateEnd: session.date_end,
    }));
};

export const getPaceSessionData = async (
  year: number,
  sessionKey: number,
  signal: AbortSignal,
): Promise<PaceSessionData> => {
  const laps = await requestOpenF1<OpenF1Lap[]>(
    `/laps?session_key=${sessionKey}`,
    signal,
  );
  const drivers = normalizeDriverTeamFields(
    await requestOpenF1<OpenF1Driver[]>(
      `/drivers?session_key=${sessionKey}`,
      signal,
    ),
    year,
  ) as OpenF1Driver[];
  const driverByNumber = new Map(drivers.map((driver) => [Number(driver.driver_number), driver]));
  const lapsByDriver = new Map<number, OpenF1Lap[]>();

  laps.forEach((lap) => {
    const lapDuration = finite(lap.lap_duration);
    if (!lapDuration || lapDuration > 300 || lap.is_pit_out_lap) return;
    const current = lapsByDriver.get(Number(lap.driver_number)) ?? [];
    current.push(lap);
    lapsByDriver.set(Number(lap.driver_number), current);
  });

  const paceDrivers = [...lapsByDriver.entries()].map(([driverNumber, driverLaps]) => {
    const driver = driverByNumber.get(driverNumber);
    const lapTimes = driverLaps
      .map((lap) => finite(lap.lap_duration))
      .filter((value): value is number => value !== null);
    const sectors = [0, 1, 2].map((index) => {
      const values = driverLaps.map((lap) => finite([
        lap.duration_sector_1,
        lap.duration_sector_2,
        lap.duration_sector_3,
      ][index]));
      return {
        best: minimum(values),
        average: average(values),
      };
    });
    const bestSectors = sectors.map((sector) => sector.best) as PaceDriver['bestSectors'];
    const theoreticalBest = bestSectors.every(Number.isFinite)
      ? bestSectors.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
    const rawColor = driver?.team_colour?.replace('#', '');

    return {
      driverNumber,
      name: driver?.full_name ?? driver?.broadcast_name ?? driver?.name_acronym ?? String(driverNumber),
      acronym: driver?.name_acronym ?? String(driverNumber),
      team: driver?.team_name ?? 'Team unavailable',
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
    (left.bestLap ?? Number.MAX_SAFE_INTEGER) - (right.bestLap ?? Number.MAX_SAFE_INTEGER)
  ));

  return {
    sessionKey,
    drivers: paceDrivers,
    validLaps: paceDrivers.reduce((sum, driver) => sum + driver.validLaps, 0),
    fetchedAt: new Date().toISOString(),
  };
};
