const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeText = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const TEAM_ALIASES = new Map([
  ['haas', 'Haas F1 Team'],
  ['red bull', 'Red Bull Racing'],
]);

const normalizeTeam = (team) => TEAM_ALIASES.get(normalizeText(team)) ?? team;

const getDriverKey = (driver = '', driverCode = '') => {
  const normalizedDriver = normalizeText(driver);
  const tokens = normalizedDriver.split(' ').filter(Boolean);
  return tokens.at(-1) || normalizeText(driverCode) || normalizedDriver;
};

const average = (values) => {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
};

export const median = (values) => {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finiteValues.length === 0) return null;

  const middle = Math.floor(finiteValues.length / 2);
  return finiteValues.length % 2 === 1
    ? finiteValues[middle]
    : (finiteValues[middle - 1] + finiteValues[middle]) / 2;
};

const standardDeviation = (values) => {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return null;

  const mean = average(finiteValues);
  const variance = average(finiteValues.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const getRacePitLaneStops = (race) => {
  if (Array.isArray(race?.pit_stops)) return race.pit_stops;
  if (Array.isArray(race?.sessions?.pit_stops?.rows)) {
    return race.sessions.pit_stops.rows;
  }
  return [];
};

const flattenLegacyDhlRace = (legacyRace) => (
  (legacyRace?.pit_stops ?? []).flatMap((driverEntry) => (
    (driverEntry.stops ?? []).map((stop, index) => ({
      position: stop.position ?? null,
      points: stop.points ?? 0,
      driver: driverEntry.driver,
      driver_full_name: driverEntry.driver,
      team: driverEntry.team,
      lap: stop.lap,
      stop_number: index + 1,
      service_time_seconds: stop.time,
      source: 'DHL Fastest Pit Stop Award',
    }))
  ))
);

const getServiceStops = (race, legacyDhlByRound) => {
  if (Array.isArray(race?.dhl_pit_stops)) return race.dhl_pit_stops;
  return flattenLegacyDhlRace(legacyDhlByRound.get(Number(race?.round)));
};

const makeStopKey = ({ driver, driver_code: driverCode, lap }) => (
  `${getDriverKey(driver, driverCode)}|${Number(lap)}`
);

const normalizePitLaneStop = (stop, race, seasonYear) => ({
  seasonYear: Number(seasonYear),
  round: Number(race.round),
  grandPrix: race.grand_prix,
  circuit: race.circuit,
  stopNumber: toFiniteNumber(stop.stop_number),
  driver: stop.driver,
  driverCode: stop.driver_code ?? null,
  team: stop.team,
  lap: toFiniteNumber(stop.lap),
  pitLaneTime: toFiniteNumber(stop.time_seconds ?? stop.duration ?? stop.time),
  serviceTime: null,
  points: 0,
  servicePosition: null,
  serviceSource: null,
  pitLaneSource: 'Formula1.com Pit Stop Summary',
});

const normalizeServiceStop = (stop, race, seasonYear) => ({
  seasonYear: Number(seasonYear),
  round: Number(race.round),
  grandPrix: race.grand_prix,
  circuit: race.circuit,
  stopNumber: toFiniteNumber(stop.stop_number),
  driver: stop.driver_full_name ?? stop.driver,
  driverCode: stop.driver_code ?? null,
  team: normalizeTeam(stop.team),
  lap: toFiniteNumber(stop.lap),
  pitLaneTime: null,
  serviceTime: toFiniteNumber(stop.service_time_seconds ?? stop.time),
  points: toFiniteNumber(stop.points) ?? 0,
  servicePosition: toFiniteNumber(stop.position),
  serviceSource: stop.source ?? 'DHL Fastest Pit Stop Award',
  pitLaneSource: null,
});

const mergeStops = (pitLaneStop, serviceStop) => ({
  ...pitLaneStop,
  driver: pitLaneStop.driver || serviceStop.driver,
  driverCode: pitLaneStop.driverCode || serviceStop.driverCode,
  team: pitLaneStop.team || serviceStop.team,
  serviceTime: serviceStop.serviceTime,
  points: serviceStop.points,
  servicePosition: serviceStop.servicePosition,
  serviceSource: serviceStop.serviceSource,
});

export const buildPitStopRecords = (
  races,
  {
    legacyDhlData = [],
    seasonYear,
  } = {},
) => {
  const legacyDhlByRound = new Map(
    legacyDhlData.map((race) => [Number(race.round), race]),
  );
  const allRecords = [];

  (races ?? []).forEach((race) => {
    const serviceQueues = new Map();
    getServiceStops(race, legacyDhlByRound)
      .map((stop) => normalizeServiceStop(stop, race, seasonYear))
      .filter((stop) => Number.isFinite(stop.serviceTime))
      .forEach((stop) => {
        const key = makeStopKey({
          driver: stop.driver,
          driver_code: stop.driverCode,
          lap: stop.lap,
        });
        const queue = serviceQueues.get(key) ?? [];
        queue.push(stop);
        serviceQueues.set(key, queue);
      });

    const raceRecords = getRacePitLaneStops(race)
      .map((stop) => normalizePitLaneStop(stop, race, seasonYear))
      .filter((stop) => Number.isFinite(stop.pitLaneTime))
      .map((stop) => {
        const key = makeStopKey({
          driver: stop.driver,
          driver_code: stop.driverCode,
          lap: stop.lap,
        });
        const serviceStop = serviceQueues.get(key)?.shift();
        return serviceStop ? mergeStops(stop, serviceStop) : stop;
      });

    serviceQueues.forEach((queue) => raceRecords.push(...queue));

    const laneMedian = median(raceRecords.map((stop) => stop.pitLaneTime));
    const matchedStops = raceRecords.filter((stop) => (
      Number.isFinite(stop.pitLaneTime)
      && Number.isFinite(stop.serviceTime)
      && stop.pitLaneTime >= stop.serviceTime
    ));
    const transitMedian = median(
      matchedStops.map((stop) => stop.pitLaneTime - stop.serviceTime),
    );

    raceRecords.forEach((stop, index) => {
      const hasBreakdown = (
        Number.isFinite(stop.pitLaneTime)
        && Number.isFinite(stop.serviceTime)
        && stop.pitLaneTime >= stop.serviceTime
      );
      const transitTime = hasBreakdown
        ? stop.pitLaneTime - stop.serviceTime
        : null;

      allRecords.push({
        ...stop,
        id: [
          seasonYear,
          race.round,
          getDriverKey(stop.driver, stop.driverCode),
          stop.lap,
          stop.stopNumber ?? index + 1,
        ].join('-'),
        transitTime,
        laneDelta: Number.isFinite(stop.pitLaneTime) && Number.isFinite(laneMedian)
          ? stop.pitLaneTime - laneMedian
          : null,
        transitDelta: Number.isFinite(transitTime) && Number.isFinite(transitMedian)
          ? transitTime - transitMedian
          : null,
        hasBreakdown,
      });
    });
  });

  return allRecords.sort((a, b) => (
    a.round - b.round
    || (a.lap ?? Number.MAX_SAFE_INTEGER) - (b.lap ?? Number.MAX_SAFE_INTEGER)
  ));
};

const getEntityName = (record, analysisType) => (
  analysisType === 'driver' ? record.driver : record.team
);

export const aggregatePitStops = (records, analysisType = 'team') => {
  const grouped = new Map();

  records.forEach((record) => {
    const entity = getEntityName(record, analysisType);
    if (!entity) return;
    const entityRecords = grouped.get(entity) ?? [];
    entityRecords.push(record);
    grouped.set(entity, entityRecords);
  });

  return Array.from(grouped.entries()).map(([entity, entityRecords]) => {
    const serviceTimes = entityRecords.map((record) => record.serviceTime);
    const pitLaneTimes = entityRecords.map((record) => record.pitLaneTime);
    const transitTimes = entityRecords.map((record) => record.transitTime);
    const laneDeltas = entityRecords.map((record) => record.laneDelta);
    const matchedStops = entityRecords.filter((record) => record.hasBreakdown);

    return {
      entity,
      team: analysisType === 'team' ? entity : entityRecords.find((record) => record.team)?.team,
      stops: entityRecords.length,
      serviceStops: serviceTimes.filter(Number.isFinite).length,
      pitLaneStops: pitLaneTimes.filter(Number.isFinite).length,
      matchedStops: matchedStops.length,
      serviceMedian: median(serviceTimes),
      serviceAverage: average(serviceTimes),
      serviceFastest: serviceTimes.filter(Number.isFinite).length
        ? Math.min(...serviceTimes.filter(Number.isFinite))
        : null,
      serviceConsistency: standardDeviation(serviceTimes),
      pitLaneMedian: median(pitLaneTimes),
      pitLaneFastest: pitLaneTimes.filter(Number.isFinite).length
        ? Math.min(...pitLaneTimes.filter(Number.isFinite))
        : null,
      transitMedian: median(transitTimes),
      laneDeltaMedian: median(laneDeltas),
      breakdownCoverage: entityRecords.length > 0
        ? matchedStops.length / entityRecords.length
        : 0,
      records: entityRecords,
    };
  }).sort((a, b) => (
    (a.pitLaneMedian ?? Number.MAX_SAFE_INTEGER)
    - (b.pitLaneMedian ?? Number.MAX_SAFE_INTEGER)
  ));
};

export const summarizePitStopCoverage = (records) => {
  const serviceStops = records.filter((record) => Number.isFinite(record.serviceTime));
  const pitLaneStops = records.filter((record) => Number.isFinite(record.pitLaneTime));
  const matchedStops = records.filter((record) => record.hasBreakdown);

  return {
    records: records.length,
    serviceStops: serviceStops.length,
    pitLaneStops: pitLaneStops.length,
    matchedStops: matchedStops.length,
    fastestService: serviceStops.length
      ? serviceStops.reduce((fastest, record) => (
        record.serviceTime < fastest.serviceTime ? record : fastest
      ))
      : null,
    quickestPitLane: pitLaneStops.length
      ? pitLaneStops.reduce((fastest, record) => (
        record.pitLaneTime < fastest.pitLaneTime ? record : fastest
      ))
      : null,
    bestTransitDelta: matchedStops.length
      ? matchedStops.reduce((best, record) => (
        record.transitDelta < best.transitDelta ? record : best
      ))
      : null,
  };
};
