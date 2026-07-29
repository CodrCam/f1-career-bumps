import {
  accumulateStandings,
  withRankMovement,
} from './seasonOverview.js';

const numeric = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const sortRaces = (season) => (
  [...(season?.races ?? [])].sort((left, right) => numeric(left.round) - numeric(right.round))
);

const statusMap = (publication) => new Map(
  (publication?.races ?? []).map((status) => [numeric(status.round), status]),
);

const analyticsMap = (analytics) => new Map(
  (analytics?.races ?? []).map((race) => [numeric(race.round), race]),
);

const resultGrid = (race, result) => {
  if (Number.isFinite(Number(result?.grid))) return Number(result.grid);
  const key = result?.driver_code ?? result?.driver;
  const gridResult = (race?.starting_grid ?? race?.qualifying_results ?? [])
    .find((entry) => (entry.driver_code ?? entry.driver) === key);
  return Number.isFinite(Number(gridResult?.position)) ? Number(gridResult.position) : null;
};

const publicationState = ({ race, analytics, status }) => (
  status?.state
    ?? (analytics ? 'published' : race ? 'results_ready' : 'scheduled')
);

export const metaFor = ({
  year,
  state,
  summary,
  status,
  analytics,
  warnings = [],
  suffix,
}) => {
  const publishedAt = status?.publishedAt
    ?? status?.updatedAt
    ?? status?.lastAttemptAt
    ?? analytics?.updatedAt
    ?? summary?.updatedAt
    ?? new Date().toISOString();
  const coverage = status?.sourceCoverage ?? {};

  return {
    season: numeric(year),
    schemaVersion: '2.0',
    contentVersion: status?.contentVersion
      ?? `${suffix ?? 'season'}-${year}-${publishedAt}`,
    state,
    publishedAt,
    sources: unique([
      summary?.source,
      coverage.formula1Official === 'ready' ? 'Formula1.com' : null,
      coverage.slipstreamRecorder === 'ready' ? 'Slipstream owned recorder' : null,
    ]),
    warnings: unique([
      ...(status?.missingCapabilities ?? []),
      ...warnings,
    ]),
  };
};

const driverContributions = (races) => {
  const teams = new Map();

  races.forEach((race) => {
    [...(race.race_results ?? []), ...(race.sprint_results ?? [])].forEach((result) => {
      if (!result.team || !result.driver) return;
      const team = teams.get(result.team) ?? new Map();
      const current = team.get(result.driver) ?? {
        name: result.driver,
        code: result.driver_code,
        points: 0,
      };
      current.points += numeric(result.points);
      current.code = result.driver_code ?? current.code;
      team.set(result.driver, current);
      teams.set(result.team, team);
    });
  });

  return new Map(
    [...teams.entries()].map(([team, drivers]) => [
      team,
      [...drivers.values()].sort((left, right) => right.points - left.points),
    ]),
  );
};

export const buildStandingsReadModel = ({
  year,
  season,
  summary,
  publication,
} = {}) => {
  const races = sortRaces(season);
  const previousRaces = races.slice(0, -1);
  const current = accumulateStandings(races);
  const previous = accumulateStandings(previousRaces);
  const contributions = driverContributions(races);
  const statuses = statusMap(publication);
  const latestRace = races.at(-1);
  const latestStatus = latestRace ? statuses.get(numeric(latestRace.round)) : null;
  const state = publicationState({ race: latestRace, status: latestStatus });

  return {
    data: {
      year: numeric(year),
      throughRound: latestRace ? numeric(latestRace.round) : 0,
      driverStandings: withRankMovement(current.drivers, previous.drivers),
      constructorStandings: withRankMovement(
        current.constructors,
        previous.constructors,
      ).map((standing) => ({
        ...standing,
        drivers: contributions.get(standing.name) ?? [],
      })),
    },
    meta: metaFor({
      year,
      state,
      summary,
      status: latestStatus,
      suffix: 'standings',
    }),
  };
};

export const buildResultsReadModel = ({
  year,
  season,
  summary,
  publication,
} = {}) => {
  const races = sortRaces(season);
  const standings = accumulateStandings(races).drivers;
  const statuses = statusMap(publication);
  const latestRace = races.at(-1);
  const latestStatus = latestRace ? statuses.get(numeric(latestRace.round)) : null;
  const drivers = new Map();

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
      const position = Number.isFinite(Number(result.position))
        ? Number(result.position)
        : null;
      const grid = resultGrid(race, result);
      driver.code = result.driver_code ?? driver.code;
      driver.team = result.team ?? driver.team;
      driver.totalPoints += numeric(result.points);
      driver.results[numeric(race.round)] = {
        position,
        points: numeric(result.points),
        grid,
        gridDelta: grid !== null && position !== null ? grid - position : null,
        status: result.status ?? (position ? 'Finished' : 'Unclassified'),
        team: result.team,
      };
      drivers.set(result.driver, driver);
    });
  });

  const rankByDriver = new Map(standings.map((standing, index) => [standing.name, index + 1]));

  return {
    data: {
      year: numeric(year),
      throughRound: latestRace ? numeric(latestRace.round) : 0,
      races: races.map((race) => ({
        round: numeric(race.round),
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
      })),
      drivers: [...drivers.values()].sort((left, right) => (
        (rankByDriver.get(left.name) ?? Number.MAX_SAFE_INTEGER)
        - (rankByDriver.get(right.name) ?? Number.MAX_SAFE_INTEGER)
      )),
    },
    meta: metaFor({
      year,
      state: publicationState({ race: latestRace, status: latestStatus }),
      summary,
      status: latestStatus,
      suffix: 'results',
    }),
  };
};

export const buildRaceArchiveReadModel = ({
  year,
  season,
  summary,
  analytics,
  publication,
} = {}) => {
  const races = sortRaces(season);
  const statuses = statusMap(publication);
  const raceAnalytics = analyticsMap(analytics);
  const latestRace = races.at(-1);
  const latestStatus = latestRace ? statuses.get(numeric(latestRace.round)) : null;
  const latestAnalytics = latestRace ? raceAnalytics.get(numeric(latestRace.round)) : null;

  return {
    data: {
      year: numeric(year),
      races: races.map((race) => {
        const round = numeric(race.round);
        const status = statuses.get(round);
        const analysis = raceAnalytics.get(round);
        const winner = (race.race_results ?? [])[0];
        return {
          round,
          grandPrix: race.grand_prix,
          date: race.date,
          circuit: race.circuit,
          state: publicationState({ race, analytics: analysis, status }),
          storyReady: Boolean(analysis),
          winner: winner
            ? {
              driver: winner.driver,
              code: winner.driver_code,
              team: winner.team,
              grid: resultGrid(race, winner),
            }
            : null,
          podium: (race.race_results ?? []).slice(0, 3).map((result) => ({
            position: numeric(result.position),
            driver: result.driver,
            code: result.driver_code,
            team: result.team,
          })),
          storySummary: analysis?.summary ?? null,
          updatedAt: status?.updatedAt
            ?? status?.lastAttemptAt
            ?? analysis?.updatedAt
            ?? summary?.updatedAt,
        };
      }),
    },
    meta: metaFor({
      year,
      state: publicationState({
        race: latestRace,
        analytics: latestAnalytics,
        status: latestStatus,
      }),
      summary,
      status: latestStatus,
      analytics: latestAnalytics,
      suffix: 'races',
    }),
  };
};

export const buildRaceDossierReadModel = ({
  year,
  round,
  season,
  summary,
  analytics,
  publication,
} = {}) => {
  const races = sortRaces(season);
  const race = races.find((entry) => numeric(entry.round) === numeric(round));
  if (!race) return null;

  const state = publicationState({ race, analytics, status: publication });
  const startingGrid = new Map(
    (race.starting_grid ?? race.qualifying_results ?? []).map((result) => [
      result.driver_code ?? result.driver,
      numeric(result.position, null),
    ]),
  );
  const classification = (race.race_results ?? []).map((result) => {
    const key = result.driver_code ?? result.driver;
    const grid = Number.isFinite(Number(result.grid))
      ? Number(result.grid)
      : startingGrid.get(key) ?? null;
    const position = Number.isFinite(Number(result.position))
      ? Number(result.position)
      : null;
    return {
      position,
      driver: result.driver,
      code: result.driver_code,
      team: result.team,
      points: numeric(result.points),
      grid,
      gridDelta: grid !== null && position !== null ? grid - position : null,
      time: result.time ?? null,
      status: result.status ?? (position ? 'Finished' : 'Unclassified'),
    };
  });

  return {
    data: {
      year: numeric(year),
      race: {
        round: numeric(race.round),
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
        state,
      },
      classification,
      sprintClassification: (race.sprint_results ?? []).map((result) => ({
        position: numeric(result.position, null),
        driver: result.driver,
        code: result.driver_code,
        team: result.team,
        points: numeric(result.points),
        status: result.status ?? 'Finished',
      })),
      analysis: analytics
        ? {
          summary: analytics.summary ?? null,
          definitions: analytics.definitions ?? null,
          circuitProfile: analytics.circuitProfile ?? null,
          validationStatus: analytics.validationStatus ?? null,
          overtakeEvents: analytics.overtakeEvents ?? [],
          storyEvents: analytics.storyEvents ?? [],
          pitCycleEvents: analytics.pitCycleEvents ?? [],
          attritionEvents: analytics.attritionEvents ?? [],
          disruptionEvents: analytics.disruptionEvents ?? [],
          drivers: analytics.drivers ?? [],
        }
        : null,
    },
    meta: metaFor({
      year,
      state,
      summary,
      status: publication,
      analytics,
      warnings: analytics ? [] : ['Detailed timing analysis is not yet published.'],
      suffix: `race-${round}`,
    }),
  };
};
