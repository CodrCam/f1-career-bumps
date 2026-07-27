const DEFAULT_OPENF1_BASE_URL = 'https://api.openf1.org/v1';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const fetchRows = async (baseUrl, endpoint, query, fetchImpl, { optional = false } = {}) => {
  const url = new URL(`${baseUrl}/${endpoint}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
  });
  if (optional && response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`OpenF1 ${endpoint} request failed with ${response.status}.`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error(`OpenF1 ${endpoint} returned an invalid response.`);
  }
  return rows;
};

const nearestRaceSession = (sessions, officialRace, round) => {
  const sorted = [...sessions].sort(
    (left, right) => Date.parse(left.date_start) - Date.parse(right.date_start),
  );
  const officialTime = Date.parse(officialRace.date);
  if (Number.isFinite(officialTime)) {
    const closest = sorted
      .map((session) => ({
        session,
        distance: Math.abs(Date.parse(session.date_start) - officialTime),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (closest && closest.distance <= 3 * 24 * 60 * 60 * 1000) return closest.session;
  }
  return sorted[round - 1] ?? null;
};

const rowsByDriver = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const number = Number(row.driver_number);
    const values = grouped.get(number) ?? [];
    values.push(row);
    grouped.set(number, values);
  });
  return grouped;
};

const latestPosition = (positions, driverNumber, timestamp) => {
  const rows = positions.get(driverNumber) ?? [];
  let position = null;
  for (const row of rows) {
    if (Date.parse(row.date) > timestamp) break;
    position = finiteNumber(row.position);
  }
  return position;
};

const stintForLap = (stints, driverNumber, lapNumber) => (
  (stints.get(driverNumber) ?? []).find((stint) => (
    Number(stint.lap_start) <= lapNumber
    && Number(stint.lap_end ?? Number.POSITIVE_INFINITY) >= lapNumber
  ))
);

const trackStatusForLap = (raceControl, lapNumber) => {
  const messages = raceControl.filter((row) => Number(row.lap_number) === lapNumber);
  if (messages.some((row) => /red/i.test(row.flag ?? '') || /red flag/i.test(row.message ?? ''))) {
    return '5';
  }
  if (messages.some((row) => /safety car|virtual safety car/i.test(row.message ?? ''))) {
    return '4';
  }
  if (messages.some((row) => /yellow/i.test(row.flag ?? '') || /yellow/i.test(row.message ?? ''))) {
    return '2';
  }
  return '1';
};

export const normalizeOpenF1Snapshot = ({
  year,
  round,
  officialRace,
  session,
  drivers,
  laps,
  positions,
  stints,
  pit,
  raceControl,
  weather,
  sessionResults,
  startingGrid,
}) => {
  const driverByNumber = new Map(
    drivers.map((driver) => [Number(driver.driver_number), driver]),
  );
  const numberByCode = new Map(
    drivers
      .filter((driver) => driver.name_acronym)
      .map((driver) => [String(driver.name_acronym).toUpperCase(), Number(driver.driver_number)]),
  );
  const positionRows = rowsByDriver(positions);
  positionRows.forEach((rows) => rows.sort((left, right) => Date.parse(left.date) - Date.parse(right.date)));
  const stintRows = rowsByDriver(stints);
  const pitRows = rowsByDriver(pit);
  const sessionResultByNumber = new Map(
    sessionResults.map((result) => [Number(result.driver_number), result]),
  );
  const gridByNumber = new Map(
    startingGrid.map((grid) => [Number(grid.driver_number), finiteNumber(grid.position)]),
  );
  const officialResultByCode = new Map(
    (officialRace.race_results ?? []).map((result) => [
      String(result.driver_code ?? '').toUpperCase(),
      result,
    ]),
  );
  const officialGridByCode = new Map(
    (officialRace.starting_grid ?? []).map((result) => [
      String(result.driver_code ?? '').toUpperCase(),
      finiteNumber(result.position),
    ]),
  );

  const normalizedResults = [...driverByNumber.values()]
    .map((driver) => {
      const code = String(driver.name_acronym ?? '').toUpperCase();
      const official = officialResultByCode.get(code);
      const sessionResult = sessionResultByNumber.get(Number(driver.driver_number));
      if (!official && !sessionResult) return null;
      const position = finiteNumber(official?.position ?? sessionResult?.position);
      const gridPosition = officialGridByCode.get(code)
        ?? gridByNumber.get(Number(driver.driver_number))
        ?? 0;
      return {
        driver_number: String(driver.driver_number),
        broadcast_name: driver.broadcast_name ?? driver.full_name,
        abbreviation: code,
        driver_id: driver.full_name,
        team_name: official?.team ?? driver.team_name,
        team_color: driver.team_colour,
        position,
        classified_position: position ? String(position) : null,
        grid_position: gridPosition,
        status: official?.status
          ?? (sessionResult?.dns ? 'Did not start'
            : sessionResult?.dsq ? 'Disqualified'
              : sessionResult?.dnf ? 'Retired' : 'Finished'),
        points: finiteNumber(official?.points) ?? 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.position ?? 999) - (right.position ?? 999));

  const normalizedLaps = laps.flatMap((lap) => {
    const driverNumber = Number(lap.driver_number);
    const driver = driverByNumber.get(driverNumber);
    if (!driver?.name_acronym) return [];
    const lapNumber = Number(lap.lap_number);
    const lapTime = finiteNumber(lap.lap_duration);
    const startedAt = Date.parse(lap.date_start);
    const position = latestPosition(
      positionRows,
      driverNumber,
      Number.isFinite(startedAt) ? startedAt + ((lapTime ?? 0) * 1000) : Number.POSITIVE_INFINITY,
    );
    const stint = stintForLap(stintRows, driverNumber, lapNumber);
    const pitStop = (pitRows.get(driverNumber) ?? [])
      .find((stop) => Number(stop.lap_number) === lapNumber);
    return [{
      driver: String(driver.name_acronym).toUpperCase(),
      driver_number: String(driverNumber),
      lap_number: lapNumber,
      stint: finiteNumber(stint?.stint_number),
      lap_time: lapTime,
      sector1_time: finiteNumber(lap.duration_sector_1),
      sector2_time: finiteNumber(lap.duration_sector_2),
      sector3_time: finiteNumber(lap.duration_sector_3),
      speed_i1: finiteNumber(lap.i1_speed),
      speed_i2: finiteNumber(lap.i2_speed),
      speed_st: finiteNumber(lap.st_speed),
      compound: stint?.compound ?? null,
      tyre_life: stint
        ? Math.max(1, lapNumber - Number(stint.lap_start) + Number(stint.tyre_age_at_start ?? 0) + 1)
        : null,
      team: driver.team_name,
      lap_start_date: lap.date_start,
      track_status: trackStatusForLap(raceControl, lapNumber),
      position,
      deleted: false,
      fast_f1_generated: false,
      is_accurate: lapTime !== null && lapTime >= 40 && lapTime <= 300,
      pit_out_time: lap.is_pit_out_lap ? lap.date_start : null,
      pit_in_time: pitStop?.date ?? null,
    }];
  });

  const raceControlMessages = raceControl.map((message) => {
    const driver = driverByNumber.get(Number(message.driver_number));
    return {
      time: message.date,
      category: message.category,
      message: message.message,
      status: message.status,
      flag: message.flag,
      scope: message.scope,
      sector: message.sector,
      racing_number: driver?.name_acronym ?? message.driver_number,
      lap: finiteNumber(message.lap_number),
    };
  });

  return {
    schema_version: 1,
    source: 'OpenF1 historical timing',
    collected_at: new Date().toISOString(),
    year,
    round,
    session: {
      name: session.session_name,
      event_name: session.meeting_name ?? officialRace.grand_prix,
      official_event_name: officialRace.grand_prix,
      country: session.country_name,
      location: session.location,
      date: session.date_start,
      session_key: session.session_key,
    },
    results: normalizedResults,
    laps: normalizedLaps,
    weather: weather.map((row) => ({
      time: row.date,
      air_temp: finiteNumber(row.air_temperature),
      humidity: finiteNumber(row.humidity),
      pressure: finiteNumber(row.pressure),
      rainfall: finiteNumber(row.rainfall),
      track_temp: finiteNumber(row.track_temperature),
      wind_direction: finiteNumber(row.wind_direction),
      wind_speed: finiteNumber(row.wind_speed),
    })),
    track_status: raceControlMessages
      .filter((row) => row.flag || /safety car/i.test(row.message ?? '')),
    race_control_messages: raceControlMessages,
    fastest_lap_telemetry: {},
    capabilities: {
      results: normalizedResults.length > 0,
      lap_timing: normalizedLaps.some((lap) => lap.lap_time !== null),
      sector_timing: normalizedLaps.some((lap) => lap.sector1_time !== null),
      pit_markers: normalizedLaps.some((lap) => lap.pit_in_time || lap.pit_out_time),
      tyres_and_stints: normalizedLaps.some((lap) => lap.compound),
      speed_traps: normalizedLaps.some((lap) => lap.speed_st !== null),
      weather: weather.length > 0,
      track_status: raceControlMessages.length > 0,
      race_control: raceControlMessages.length > 0,
      fastest_lap_telemetry: false,
    },
  };
};

export const collectOpenF1Snapshot = async ({
  year,
  round,
  officialRace,
  fetchImpl = fetch,
  baseUrl = process.env.OPENF1_API_BASE_URL ?? DEFAULT_OPENF1_BASE_URL,
}) => {
  const sessions = await fetchRows(
    baseUrl,
    'sessions',
    { year, session_name: 'Race' },
    fetchImpl,
  );
  const session = nearestRaceSession(sessions, officialRace, round);
  if (!session) throw new Error(`OpenF1 has no race session for ${year} round ${round}.`);
  const query = { session_key: session.session_key };
  const endpoints = [
    ['drivers', true],
    ['laps', true],
    ['position', false],
    ['stints', false],
    ['pit', false],
    ['race_control', false],
    ['weather', false],
    ['session_result', false],
    ['starting_grid', false],
  ];
  const data = {};
  for (const [endpoint, required] of endpoints) {
    await wait(360);
    data[endpoint] = await fetchRows(
      baseUrl,
      endpoint,
      query,
      fetchImpl,
      { optional: !required },
    );
  }
  if (!data.laps.length || !data.drivers.length) {
    throw new Error(`OpenF1 timing is not complete for ${officialRace.grand_prix}.`);
  }

  return normalizeOpenF1Snapshot({
    year,
    round,
    officialRace,
    session,
    drivers: data.drivers,
    laps: data.laps,
    positions: data.position,
    stints: data.stints,
    pit: data.pit,
    raceControl: data.race_control,
    weather: data.weather,
    sessionResults: data.session_result,
    startingGrid: data.starting_grid,
  });
};
