export const OWNED_TIMING_MATERIALIZER_VERSION = 'owned-timing-materializer-1.0.0';

const numeric = (value, { positive = false } = {}) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || (positive && number <= 0)) return null;
  return number;
};

const text = (value) => (
  value === null || value === undefined || value === '' ? null : String(value)
);

const codeFor = (observed = {}) => text(
  observed.driver
  ?? observed.driver_code
  ?? observed.abbreviation
  ?? observed.name_acronym,
)?.toUpperCase() ?? null;

const lapFor = (observed = {}) => numeric(
  observed.lap
  ?? observed.lap_number,
  { positive: true },
);

const latestByTimestamp = (events) => [...events].sort((left, right) => (
  right.timestamp.localeCompare(left.timestamp)
  || right.eventId.localeCompare(left.eventId)
))[0];

export const activeRaceEvents = (events = []) => {
  const superseded = new Set(
    events.map((event) => event.supersedesEventId).filter(Boolean),
  );
  return events
    .filter((event) => !superseded.has(event.eventId))
    .sort((left, right) => (
      left.timestamp.localeCompare(right.timestamp)
      || numeric(left.observed?.sequence) - numeric(right.observed?.sequence)
      || left.eventId.localeCompare(right.eventId)
    ));
};

const elapsedSeconds = (timestamp, sessionStartedAt) => {
  if (!timestamp || !sessionStartedAt) return null;
  const seconds = (Date.parse(timestamp) - Date.parse(sessionStartedAt)) / 1_000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

const lapKey = (driver, lap) => `${driver}:${lap}`;

const baseLap = (driver, lap, registered = {}) => ({
  driver,
  driver_number: text(registered.driver_number ?? registered.racing_number),
  lap_number: lap,
  stint: null,
  lap_time: null,
  sector1_time: null,
  sector2_time: null,
  sector3_time: null,
  speed_i1: null,
  speed_i2: null,
  speed_st: null,
  compound: null,
  tyre_life: null,
  team: text(registered.team ?? registered.team_name),
  lap_start_date: null,
  track_status: '1',
  position: null,
  deleted: false,
  fast_f1_generated: false,
  is_accurate: false,
  pit_out_time: null,
  pit_in_time: null,
});

const applyLapObservation = (lap, observed) => {
  const lapTime = numeric(
    observed.lap_time_seconds
    ?? observed.lap_time
    ?? observed.lap_duration,
    { positive: true },
  );
  const sector1 = numeric(
    observed.sector1_time_seconds
    ?? observed.sector1_time
    ?? observed.duration_sector_1,
    { positive: true },
  );
  const sector2 = numeric(
    observed.sector2_time_seconds
    ?? observed.sector2_time
    ?? observed.duration_sector_2,
    { positive: true },
  );
  const sector3 = numeric(
    observed.sector3_time_seconds
    ?? observed.sector3_time
    ?? observed.duration_sector_3,
    { positive: true },
  );

  return {
    ...lap,
    driver_number: text(observed.driver_number ?? observed.racing_number)
      ?? lap.driver_number,
    stint: numeric(observed.stint ?? observed.stint_number, { positive: true })
      ?? lap.stint,
    lap_time: lapTime ?? lap.lap_time,
    sector1_time: sector1 ?? lap.sector1_time,
    sector2_time: sector2 ?? lap.sector2_time,
    sector3_time: sector3 ?? lap.sector3_time,
    speed_i1: numeric(observed.speed_i1, { positive: true }) ?? lap.speed_i1,
    speed_i2: numeric(observed.speed_i2, { positive: true }) ?? lap.speed_i2,
    speed_st: numeric(observed.speed_st, { positive: true }) ?? lap.speed_st,
    compound: text(observed.compound)?.toUpperCase() ?? lap.compound,
    tyre_life: numeric(observed.tyre_life, { positive: true }) ?? lap.tyre_life,
    team: text(observed.team ?? observed.team_name) ?? lap.team,
    lap_start_date: text(
      observed.lap_start_date
      ?? observed.started_at
      ?? observed.start_time,
    ) ?? lap.lap_start_date,
    track_status: text(observed.track_status) ?? lap.track_status,
    position: numeric(observed.position, { positive: true }) ?? lap.position,
    deleted: Boolean(observed.deleted ?? lap.deleted),
    is_accurate: observed.is_accurate !== undefined
      ? Boolean(observed.is_accurate)
      : lapTime !== null
        ? lapTime >= 40 && lapTime <= 300
        : lap.is_accurate,
  };
};

const materializeDrivers = (events) => {
  const drivers = new Map();
  events
    .filter((event) => event.eventType === 'driver_registered')
    .forEach((event) => {
      const driver = codeFor(event.observed);
      if (driver) drivers.set(driver, { ...drivers.get(driver), ...event.observed });
    });
  return drivers;
};

const materializeLaps = (events, drivers, sessionStartedAt) => {
  const laps = new Map();
  const ensureLap = (driver, lapNumber) => {
    const key = lapKey(driver, lapNumber);
    const current = laps.get(key) ?? baseLap(driver, lapNumber, drivers.get(driver));
    laps.set(key, current);
    return current;
  };

  events.forEach((event) => {
    const observed = event.observed ?? {};
    const driver = codeFor(observed);
    const lapNumber = lapFor(observed);
    if (!driver || !lapNumber) return;

    if (['lap_timing', 'sector_timing', 'position_update'].includes(event.eventType)) {
      laps.set(
        lapKey(driver, lapNumber),
        applyLapObservation(ensureLap(driver, lapNumber), observed),
      );
      return;
    }

    if (event.eventType === 'pit_entry') {
      laps.set(lapKey(driver, lapNumber), {
        ...ensureLap(driver, lapNumber),
        pit_in_time: elapsedSeconds(event.timestamp, sessionStartedAt),
      });
      return;
    }

    if (event.eventType === 'pit_exit') {
      const exitLap = numeric(observed.exit_lap ?? lapNumber + 1, { positive: true });
      laps.set(lapKey(driver, exitLap), {
        ...ensureLap(driver, exitLap),
        pit_out_time: elapsedSeconds(event.timestamp, sessionStartedAt),
      });
    }
  });

  const stints = events.filter((event) => event.eventType === 'stint_update');
  laps.forEach((lap, key) => {
    const matching = stints.find((event) => {
      const observed = event.observed ?? {};
      const start = numeric(observed.lap_start ?? observed.start_lap, { positive: true });
      const end = numeric(observed.lap_end ?? observed.end_lap, { positive: true })
        ?? Number.POSITIVE_INFINITY;
      return codeFor(observed) === lap.driver
        && start <= lap.lap_number
        && end >= lap.lap_number;
    });
    if (!matching) return;
    const observed = matching.observed;
    const start = numeric(observed.lap_start ?? observed.start_lap, { positive: true });
    const startingAge = numeric(observed.tyre_age_at_start) ?? 0;
    laps.set(key, {
      ...lap,
      stint: numeric(observed.stint ?? observed.stint_number, { positive: true }),
      compound: text(observed.compound)?.toUpperCase(),
      tyre_life: start
        ? Math.max(1, lap.lap_number - start + startingAge + 1)
        : lap.tyre_life,
    });
  });

  return [...laps.values()].sort((left, right) => (
    left.lap_number - right.lap_number
    || left.driver.localeCompare(right.driver)
  ));
};

const materializeResults = (events, drivers) => {
  const classification = latestByTimestamp(
    events.filter((event) => event.eventType === 'classification'),
  );
  const entries = Array.isArray(classification?.observed?.entries)
    ? classification.observed.entries
    : [];

  return entries
    .map((entry) => {
      const driver = codeFor(entry);
      if (!driver) return null;
      const registered = drivers.get(driver) ?? {};
      const position = numeric(
        entry.position
        ?? entry.classified_position,
        { positive: true },
      );
      return {
        driver_number: text(entry.driver_number ?? registered.driver_number),
        broadcast_name: text(
          entry.broadcast_name
          ?? entry.driver_name
          ?? registered.broadcast_name
          ?? registered.driver_name,
        ),
        abbreviation: driver,
        driver_id: text(entry.driver_id ?? entry.driver_name ?? registered.driver_name),
        team_name: text(entry.team ?? entry.team_name ?? registered.team ?? registered.team_name),
        team_color: text(entry.team_color ?? registered.team_color),
        position,
        classified_position: text(entry.classified_position ?? position),
        grid_position: numeric(
          entry.grid_position
          ?? entry.starting_position,
          { positive: true },
        ),
        status: text(entry.status) ?? 'Finished',
        points: numeric(entry.points) ?? 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.position ?? Number.MAX_SAFE_INTEGER)
      - (right.position ?? Number.MAX_SAFE_INTEGER));
};

const materializeRaceControl = (events) => events
  .filter((event) => event.eventType === 'race_control_notice')
  .map((event) => ({
    time: event.timestamp,
    category: text(event.observed.category),
    message: text(event.observed.message),
    status: text(event.observed.status),
    flag: text(event.observed.flag),
    scope: text(event.observed.scope),
    sector: numeric(event.observed.sector, { positive: true }),
    racing_number: codeFor(event.observed)
      ?? text(event.observed.racing_number),
    lap: lapFor(event.observed),
    phase: text(event.observed.phase),
  }));

const materializeWeather = (events) => events
  .filter((event) => event.eventType === 'weather_sample')
  .map((event) => ({
    time: event.timestamp,
    air_temperature: numeric(event.observed.air_temperature),
    humidity: numeric(event.observed.humidity),
    pressure: numeric(event.observed.pressure),
    rainfall: numeric(event.observed.rainfall),
    track_temperature: numeric(event.observed.track_temperature),
    wind_direction: numeric(event.observed.wind_direction),
    wind_speed: numeric(event.observed.wind_speed),
  }));

export const evaluateOwnedTimingReadiness = ({
  recorderState,
  events = [],
  now = new Date().toISOString(),
  retryMs,
} = {}) => {
  const activeEvents = activeRaceEvents(events).filter(
    (event) => !recorderState?.session?.id
      || event.sessionId === recorderState.session.id,
  );
  const hasFinish = activeEvents.some((event) => event.eventType === 'race_finish');
  const classification = latestByTimestamp(
    activeEvents.filter((event) => event.eventType === 'classification'),
  );
  const hasClassification = Array.isArray(classification?.observed?.entries)
    && classification.observed.entries.length > 0;
  const hasLaps = activeEvents.some((event) => event.eventType === 'lap_timing');

  let status = 'waiting_for_recorder';
  let reason = 'The owned recorder has not completed this session.';
  if (!recorderState) {
    status = 'source_not_connected';
    reason = 'No owned recorder session is registered for this race.';
  } else if (['failed', 'interrupted'].includes(recorderState.status)) {
    status = 'recorder_incomplete';
    reason = `The owned recorder ended in ${recorderState.status} state.`;
  } else if (recorderState.status === 'complete' && !hasFinish) {
    status = 'waiting_for_session_finish';
    reason = 'The recorder completed without a session-finish event.';
  } else if (recorderState.status === 'complete' && !hasClassification) {
    status = 'waiting_for_classification';
    reason = 'The session ended before the recorder received a classification.';
  } else if (recorderState.status === 'complete' && !hasLaps) {
    status = 'results_ready';
    reason = 'Classification is available, but owned lap timing has not arrived yet.';
  } else if (recorderState.status === 'complete') {
    status = 'ready';
    reason = 'Owned classification and lap timing are ready to publish.';
  }

  const nextRetryMs = retryMs
    ?? (status === 'source_not_connected'
      ? 24 * 60 * 60 * 1_000
      : 15 * 60 * 1_000);

  return {
    status,
    reason,
    ready: status === 'ready',
    expected: status !== 'recorder_incomplete',
    checkedAt: new Date(now).toISOString(),
    nextCheckAt: status === 'ready'
      ? null
      : new Date(Date.parse(now) + nextRetryMs).toISOString(),
  };
};

export const materializeOwnedTimingSnapshot = ({
  recorderState,
  events = [],
} = {}) => {
  if (!recorderState?.session?.id) {
    throw new Error('Owned timing materialization requires recorder session state.');
  }
  const activeEvents = activeRaceEvents(events).filter(
    (event) => event.sessionId === recorderState.session.id,
  );
  const drivers = materializeDrivers(activeEvents);
  const laps = materializeLaps(
    activeEvents,
    drivers,
    recorderState.session.startsAt,
  );
  const results = materializeResults(activeEvents, drivers);
  const raceControlMessages = materializeRaceControl(activeEvents);
  const weather = materializeWeather(activeEvents);
  const eventTypes = new Set(activeEvents.map((event) => event.eventType));

  return {
    schema_version: 2,
    materializer_version: OWNED_TIMING_MATERIALIZER_VERSION,
    source: {
      id: recorderState.source?.id ?? 'slipstream-owned',
      name: recorderState.source?.displayName ?? 'Slipstream owned recorder',
      attribution: recorderState.source?.attribution ?? 'Slipstream owned timing infrastructure',
      session_id: recorderState.session.id,
      event_count: activeEvents.length,
    },
    year: Number(recorderState.session.year),
    round: Number(recorderState.session.round),
    session: {
      session_id: recorderState.session.id,
      session_type: recorderState.session.type,
      event_name: recorderState.session.name,
      official_event_name: recorderState.session.name,
      date_start: recorderState.session.startsAt,
      date_end: recorderState.session.endsAt,
    },
    capabilities: {
      results: results.length > 0,
      starting_grid: results.some((result) => result.grid_position !== null),
      lap_timing: laps.some((lap) => lap.lap_time !== null),
      sector_timing: laps.some((lap) => (
        lap.sector1_time !== null
        || lap.sector2_time !== null
        || lap.sector3_time !== null
      )),
      pit_markers: eventTypes.has('pit_entry') || eventTypes.has('pit_exit'),
      tyres_and_stints: eventTypes.has('stint_update'),
      weather: weather.length > 0,
      track_status: laps.some((lap) => lap.track_status !== '1'),
      race_control: raceControlMessages.length > 0,
      fastest_lap_telemetry: eventTypes.has('telemetry_sample'),
    },
    results,
    laps,
    weather,
    race_control_messages: raceControlMessages,
    telemetry: activeEvents
      .filter((event) => event.eventType === 'telemetry_sample')
      .map((event) => ({
        time: event.timestamp,
        driver: codeFor(event.observed),
        ...event.observed,
      })),
  };
};
