const normalizeText = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\bf1 team\b/g, '')
  .replace(/[^a-z0-9]+/g, '');

const groupByDriverCode = (rows = [], key = 'driver_code') => new Map(
  rows
    .filter((row) => row?.[key])
    .map((row) => [String(row[key]).toUpperCase(), row]),
);

const difference = (left, right) => Array.from(left).filter((value) => !right.has(value));

const createCheck = (id, label, status, details, {
  blocking = false,
  capability,
} = {}) => ({
  id,
  label,
  status,
  blocking,
  capability,
  ...details,
});

const compareDriverCoverage = (officialRace, timing) => {
  const official = new Set(officialRace.race_results.map((row) => row.driver_code));
  const detailed = new Set(timing.results.map((row) => row.abbreviation));
  const missingFromTiming = difference(official, detailed);
  const missingFromOfficial = difference(detailed, official);
  const status = missingFromTiming.length === 0 && missingFromOfficial.length === 0
    ? 'pass'
    : 'fail';

  return createCheck(
    'driver_coverage',
    'Driver coverage',
    status,
    {
      official_count: official.size,
      timing_count: detailed.size,
      missing_from_timing: missingFromTiming,
      missing_from_official: missingFromOfficial,
    },
    { blocking: true, capability: 'results' },
  );
};

const compareFinishPositions = (officialRace, timing) => {
  const official = groupByDriverCode(officialRace.race_results);
  const detailed = groupByDriverCode(timing.results, 'abbreviation');
  const differences = [];

  official.forEach((row, code) => {
    const timingRow = detailed.get(code);
    if (!timingRow || Number(row.position) !== Number(timingRow.position)) {
      differences.push({
        driver: code,
        official: row.position,
        timing: timingRow?.position,
      });
    }
  });

  return createCheck(
    'finish_positions',
    'Finishing positions',
    differences.length === 0 ? 'pass' : 'fail',
    { differences },
    { blocking: true, capability: 'results' },
  );
};

const compareTeams = (officialRace, timing) => {
  const official = groupByDriverCode(officialRace.race_results);
  const detailed = groupByDriverCode(timing.results, 'abbreviation');
  const differences = [];

  official.forEach((row, code) => {
    const timingRow = detailed.get(code);
    if (timingRow && normalizeText(row.team) !== normalizeText(timingRow.team_name)) {
      differences.push({
        driver: code,
        official: row.team,
        timing: timingRow.team_name,
      });
    }
  });

  return createCheck(
    'team_names',
    'Team names',
    differences.length === 0 ? 'pass' : 'warning',
    { differences },
    { capability: 'results' },
  );
};

const compareStartingGrid = (officialRace, timing) => {
  if (!officialRace.starting_grid?.length || !timing.capabilities?.starting_grid) {
    return createCheck('starting_grid', 'Starting grid', 'unavailable', {
      reason: !officialRace.starting_grid?.length
        ? 'Formula1.com did not publish a starting grid table.'
        : 'The owned recorder has not captured starting-grid data for this session.',
    }, { capability: 'starting_grid' });
  }

  const official = groupByDriverCode(officialRace.starting_grid);
  const detailed = groupByDriverCode(timing.results, 'abbreviation');
  const differences = [];

  official.forEach((row, code) => {
    const timingPosition = detailed.get(code)?.grid_position;
    if (timingPosition !== undefined && Number(row.position) !== Number(timingPosition)) {
      differences.push({
        driver: code,
        official: row.position,
        timing: timingPosition,
      });
    }
  });

  return createCheck(
    'starting_grid',
    'Starting grid',
    differences.length === 0 ? 'pass' : 'warning',
    { differences },
    { capability: 'starting_grid' },
  );
};

const getTimingPitStops = (timing) => {
  const stops = new Map();

  timing.laps.forEach((lap) => {
    if (lap.pit_in_time == null || !lap.driver) return;
    const laps = stops.get(lap.driver) ?? [];
    laps.push(Number(lap.lap_number));
    stops.set(lap.driver, laps);
  });

  return stops;
};

const comparePitStops = (officialRace, timing) => {
  if (!officialRace.pit_stops?.length || !timing.capabilities?.pit_markers) {
    return createCheck('pit_stops', 'Pit-stop laps', 'unavailable', {
      reason: !officialRace.pit_stops?.length
        ? 'Formula1.com did not publish a pit-stop summary.'
        : 'The owned recorder has not captured pit markers for this session.',
    }, { capability: 'pit_markers' });
  }

  const officialStops = new Map();
  officialRace.pit_stops.forEach((stop) => {
    const code = stop.driver_code;
    const laps = officialStops.get(code) ?? [];
    laps.push(Number(stop.lap));
    officialStops.set(code, laps);
  });

  const timingStops = getTimingPitStops(timing);
  const differences = [];
  const driverCodes = new Set([...officialStops.keys(), ...timingStops.keys()]);

  driverCodes.forEach((code) => {
    const laps = officialStops.get(code) ?? [];
    const timingLaps = timingStops.get(code) ?? [];
    const officialSet = new Set(laps);
    const timingSet = new Set(timingLaps);
    const missingFromTiming = laps.filter((lap) => !timingSet.has(lap));
    const missingFromOfficial = timingLaps.filter((lap) => !officialSet.has(lap));

    if (missingFromTiming.length > 0 || missingFromOfficial.length > 0) {
      differences.push({
        driver: code,
        official: laps,
        timing: timingLaps,
        missing_from_timing: missingFromTiming,
        missing_from_official: missingFromOfficial,
      });
    }
  });
  return createCheck(
    'pit_stops',
    'Pit-stop laps',
    differences.length === 0 ? 'pass' : 'warning',
    {
      official_count: officialRace.pit_stops.length,
      timing_count: Array.from(timingStops.values()).reduce((sum, laps) => sum + laps.length, 0),
      differences,
    },
    { capability: 'pit_markers' },
  );
};

const compareFastestLap = (officialRace, timing) => {
  const official = officialRace.fastest_laps?.find((row) => row.position === 1);
  const timingFastest = timing.laps
    .filter((lap) => Number.isFinite(lap.lap_time) && lap.lap_time > 0)
    .sort((a, b) => a.lap_time - b.lap_time)[0];

  if (!official || !timingFastest) {
    return createCheck('fastest_lap', 'Fastest lap', 'unavailable', {
      reason: 'One source did not provide a fastest lap.',
    }, { capability: 'lap_timing' });
  }

  const timeDifference = Math.abs(Number(official.time_seconds) - Number(timingFastest.lap_time));
  const driverMatches = official.driver_code === timingFastest.driver;
  const status = driverMatches && timeDifference <= 0.05 ? 'pass' : 'warning';

  return createCheck('fastest_lap', 'Fastest lap', status, {
    official: {
      driver: official.driver_code,
      time_seconds: official.time_seconds,
    },
    timing: {
      driver: timingFastest.driver,
      time_seconds: timingFastest.lap_time,
    },
    time_difference_seconds: Number(timeDifference.toFixed(3)),
  }, { capability: 'lap_timing' });
};

export const buildSourceCapabilityMatrix = (officialRace, timing) => {
  const officialSessions = new Set(officialRace.available_sessions ?? []);
  const timingCapabilities = timing.capabilities ?? {};

  return [
    {
      capability: 'Session classifications',
      formula1_com: officialSessions.size > 0,
      owned_recorder: Boolean(timingCapabilities.results),
    },
    {
      capability: 'Starting grid',
      formula1_com: Boolean(officialRace.starting_grid?.length),
      owned_recorder: Boolean(timingCapabilities.starting_grid),
    },
    {
      capability: 'Pit-stop laps',
      formula1_com: Boolean(officialRace.pit_stops?.length),
      owned_recorder: Boolean(timingCapabilities.pit_markers),
    },
    {
      capability: 'Fastest laps',
      formula1_com: Boolean(officialRace.fastest_laps?.length),
      owned_recorder: Boolean(timingCapabilities.lap_timing),
    },
    {
      capability: 'Every lap and sector',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.lap_timing || timingCapabilities.sector_timing),
    },
    {
      capability: 'Tyres and stints',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.tyres_and_stints),
    },
    {
      capability: 'Weather',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.weather),
    },
    {
      capability: 'Flags and safety cars',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.track_status),
    },
    {
      capability: 'Race-control messages',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.race_control),
    },
    {
      capability: 'Speed, RPM, gear, throttle, brake, DRS',
      formula1_com: false,
      owned_recorder: Boolean(timingCapabilities.fastest_lap_telemetry),
    },
  ];
};

export const validateRaceSources = (officialRace, timing) => {
  const checks = [
    compareDriverCoverage(officialRace, timing),
    compareFinishPositions(officialRace, timing),
    compareTeams(officialRace, timing),
    compareStartingGrid(officialRace, timing),
    comparePitStops(officialRace, timing),
    compareFastestLap(officialRace, timing),
  ];
  const hasBlockingFailure = checks.some((check) => check.blocking && check.status === 'fail');
  const hasAdvisory = checks.some((check) => ['fail', 'warning', 'unavailable'].includes(check.status));
  const status = hasBlockingFailure ? 'fail' : hasAdvisory ? 'warning' : 'pass';

  return {
    schema_version: 2,
    compared_at: new Date().toISOString(),
    year: officialRace.year ?? timing.year,
    round: officialRace.round,
    grand_prix: officialRace.grand_prix,
    status,
    checks,
    capability_matrix: buildSourceCapabilityMatrix(officialRace, timing),
  };
};
