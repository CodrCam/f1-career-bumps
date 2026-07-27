import { buildPitStopRecords, aggregatePitStops, summarizePitStopCoverage } from '../src/utils/pitStopAnalysis.js';
import { metaFor } from './coreReadModels.js';

const numberValue = (value, fallback = 0) => {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : fallback;
};

const average = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length
    ? finite.reduce((total, value) => total + value, 0) / finite.length
    : null;
};

const slugify = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const latestStatus = (races, publication) => {
  const latest = races.at(-1);
  const status = (publication?.races ?? []).find(
    (candidate) => numberValue(candidate.round) === numberValue(latest?.round),
  );
  return {
    status,
    state: status?.state ?? (latest ? 'results_ready' : 'scheduled'),
  };
};

const buildDrivers = (races) => {
  const entries = new Map();

  races.forEach((race) => {
    const qualifyingByDriver = new Map(
      (race.qualifying_results ?? []).map((result) => [result.driver, result]),
    );
    const sprintByDriver = new Map(
      (race.sprint_results ?? []).map((result) => [result.driver, result]),
    );

    (race.race_results ?? []).forEach((result) => {
      if (!result.driver) return;
      const qualifying = qualifyingByDriver.get(result.driver);
      const sprint = sprintByDriver.get(result.driver);
      const current = entries.get(result.driver) ?? {
        id: slugify(result.driver),
        name: result.driver,
        code: result.driver_code,
        team: result.team,
        points: 0,
        starts: 0,
        wins: 0,
        podiums: 0,
        pointsFinishes: 0,
        dnfs: 0,
        results: [],
      };
      const position = Number.isFinite(Number(result.position))
        ? Number(result.position)
        : null;
      const grid = Number.isFinite(Number(result.grid))
        ? Number(result.grid)
        : Number.isFinite(Number(qualifying?.position))
          ? Number(qualifying.position)
          : null;
      const sprintPoints = numberValue(sprint?.points);
      const points = numberValue(result.points) + sprintPoints;
      const status = result.status ?? (position ? 'Finished' : 'Unclassified');

      current.code = result.driver_code ?? current.code;
      current.team = result.team ?? current.team;
      current.points += points;
      current.starts += 1;
      current.wins += position === 1 ? 1 : 0;
      current.podiums += position && position <= 3 ? 1 : 0;
      current.pointsFinishes += numberValue(result.points) > 0 ? 1 : 0;
      current.dnfs += /dnf|dns|dsq|retired|not classified/i.test(status) ? 1 : 0;
      current.results.push({
        round: numberValue(race.round),
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
        team: result.team,
        position,
        grid,
        gridDelta: grid !== null && position !== null ? grid - position : null,
        points: numberValue(result.points),
        sprintPosition: Number.isFinite(Number(sprint?.position))
          ? Number(sprint.position)
          : null,
        sprintPoints,
        qualifying: Number.isFinite(Number(qualifying?.position))
          ? Number(qualifying.position)
          : null,
        status,
        time: result.time ?? null,
      });
      entries.set(result.driver, current);
    });
  });

  const drivers = [...entries.values()]
    .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name));
  const driversByTeam = new Map();

  drivers.forEach((driver) => {
    driver.results.forEach((result) => {
      if (!result.team) return;
      const teamDrivers = driversByTeam.get(result.team) ?? new Set();
      teamDrivers.add(driver.name);
      driversByTeam.set(result.team, teamDrivers);
    });
  });

  return drivers.map((driver, index) => {
    const finishes = driver.results.map((result) => result.position).filter(Number.isFinite);
    const grids = driver.results.map((result) => result.grid).filter(Number.isFinite);
    const qualifying = driver.results.map((result) => result.qualifying).filter(Number.isFinite);
    const teammates = [...(driversByTeam.get(driver.team) ?? [])].filter(
      (name) => name !== driver.name,
    );
    const bestResult = [...driver.results]
      .filter((result) => Number.isFinite(result.position))
      .sort((left, right) => left.position - right.position || right.points - left.points)[0] ?? null;
    const worstResult = [...driver.results]
      .filter((result) => Number.isFinite(result.position))
      .sort((left, right) => right.position - left.position)[0] ?? null;

    return {
      ...driver,
      rank: index + 1,
      averageFinish: average(finishes),
      averageGrid: average(grids),
      averageQualifying: average(qualifying),
      pointsPerStart: driver.starts ? driver.points / driver.starts : 0,
      reliability: driver.starts ? (driver.starts - driver.dnfs) / driver.starts : 0,
      recentForm: driver.results.slice(-5),
      latestFinish: driver.results.at(-1) ?? null,
      bestResult,
      worstResult,
      teammates,
    };
  });
};

export const buildDriverDirectoryReadModel = ({
  year,
  season,
  summary,
  publication,
} = {}) => {
  const races = [...(season?.races ?? [])].sort((left, right) => left.round - right.round);
  const current = latestStatus(races, publication);
  const drivers = buildDrivers(races);

  return {
    data: {
      year: numberValue(year),
      throughRound: numberValue(races.at(-1)?.round),
      races: races.map((race) => ({
        round: numberValue(race.round),
        grandPrix: race.grand_prix,
        date: race.date,
        circuit: race.circuit,
      })),
      drivers,
      teams: [...new Set(drivers.map((driver) => driver.team).filter(Boolean))].sort(),
    },
    meta: metaFor({
      year,
      state: current.state,
      summary,
      status: current.status,
      suffix: 'drivers',
    }),
  };
};

export const buildDriverProfileReadModel = ({
  year,
  driverId,
  season,
  summary,
  publication,
} = {}) => {
  const directory = buildDriverDirectoryReadModel({
    year,
    season,
    summary,
    publication,
  });
  const driver = directory.data.drivers.find((candidate) => (
    candidate.id === driverId || slugify(candidate.name) === slugify(driverId)
  ));
  if (!driver) return null;

  const teammate = directory.data.drivers
    .filter((candidate) => driver.teammates.includes(candidate.name))
    .sort((left, right) => {
      const leftShared = left.results.filter((result) => (
        driver.results.some((driverResult) => (
          driverResult.round === result.round && driverResult.team === result.team
        ))
      )).length;
      const rightShared = right.results.filter((result) => (
        driver.results.some((driverResult) => (
          driverResult.round === result.round && driverResult.team === result.team
        ))
      )).length;
      return rightShared - leftShared;
    })[0] ?? null;

  return {
    data: {
      year: numberValue(year),
      throughRound: directory.data.throughRound,
      driver,
      teammate,
    },
    meta: {
      ...directory.meta,
      contentVersion: `${directory.meta.contentVersion}-${driver.id}`,
    },
  };
};

export const buildCompareReadModel = ({
  year,
  season,
  summary,
  publication,
} = {}) => {
  const directory = buildDriverDirectoryReadModel({
    year,
    season,
    summary,
    publication,
  });
  return {
    data: {
      year: directory.data.year,
      throughRound: directory.data.throughRound,
      drivers: directory.data.drivers,
    },
    meta: {
      ...directory.meta,
      contentVersion: directory.meta.contentVersion.replace('drivers', 'compare'),
    },
  };
};

export const buildPaceCatalogReadModel = ({
  year,
  season,
  summary,
  analytics,
  publication,
} = {}) => {
  const races = [...(season?.races ?? [])].sort((left, right) => left.round - right.round);
  const analyticsByRound = new Map(
    (analytics?.races ?? []).map((race) => [numberValue(race.round), race]),
  );
  const statusByRound = new Map(
    (publication?.races ?? []).map((status) => [numberValue(status.round), status]),
  );
  const current = latestStatus(races, publication);

  return {
    data: {
      year: numberValue(year),
      races: races.map((race) => {
        const raceAnalytics = analyticsByRound.get(numberValue(race.round));
        return {
          round: numberValue(race.round),
          grandPrix: race.grand_prix,
          date: race.date,
          circuit: race.circuit,
          detailedTimingReady: Boolean(raceAnalytics),
          state: statusByRound.get(numberValue(race.round))?.state
            ?? (raceAnalytics ? 'published' : 'results_ready'),
          circuitProfile: raceAnalytics?.circuitProfile ?? null,
        };
      }),
    },
    meta: metaFor({
      year,
      state: current.state,
      summary,
      status: current.status,
      suffix: 'pace',
    }),
  };
};

export const buildPitLaneReadModel = ({
  year,
  season,
  summary,
  publication,
  legacyDhlData = [],
} = {}) => {
  const races = [...(season?.races ?? [])].sort((left, right) => left.round - right.round);
  const records = buildPitStopRecords(races, {
    seasonYear: year,
    legacyDhlData,
  });
  const current = latestStatus(races, publication);
  const coverage = summarizePitStopCoverage(records);

  return {
    data: {
      year: numberValue(year),
      throughRound: numberValue(races.at(-1)?.round),
      races: races
        .filter((race) => records.some((record) => record.round === numberValue(race.round)))
        .map((race) => ({
          round: numberValue(race.round),
          grandPrix: race.grand_prix,
          date: race.date,
          circuit: race.circuit,
        })),
      coverage,
      teamRankings: aggregatePitStops(records, 'team'),
      driverRankings: aggregatePitStops(records, 'driver'),
      records,
    },
    meta: metaFor({
      year,
      state: current.state,
      summary,
      status: current.status,
      warnings: records.length ? [] : ['Pit-lane timing is not available for this season.'],
      suffix: 'pit-lane',
    }),
  };
};

export { slugify as driverSlug };
