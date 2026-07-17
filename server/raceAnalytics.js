const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const standardDeviation = (values) => {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const round = (value, places = 3) => {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
};

const isPitLap = (lap) => lap?.pit_in_time != null || lap?.pit_out_time != null;
const isClassifiedFinisher = (result) => {
  const status = String(result?.status ?? '');
  return /^finished$/i.test(status)
    || /^lapped$/i.test(status)
    || /^\+\d+\s+laps?$/i.test(status);
};
const didStartRace = (result) => !/did not start|withdrawn|did not qualify/i.test(
  String(result?.status ?? ''),
);

const isGreenAccurateLap = (lap) => (
  Number(lap?.lap_number) > 1
  && Number.isFinite(lap?.lap_time)
  && lap?.is_accurate === true
  && String(lap?.track_status) === '1'
  && !isPitLap(lap)
);

const groupLapsByDriver = (laps) => {
  const grouped = new Map();

  laps.forEach((lap) => {
    if (!lap.driver) return;
    const rows = grouped.get(lap.driver) ?? [];
    rows.push(lap);
    grouped.set(lap.driver, rows);
  });

  grouped.forEach((rows) => rows.sort((a, b) => a.lap_number - b.lap_number));
  return grouped;
};

const buildLapIndex = (laps) => {
  const index = new Map();

  laps.forEach((lap) => {
    const lapNumber = Number(lap.lap_number);
    if (!Number.isFinite(lapNumber) || !lap.driver || !Number.isFinite(lap.position)) return;
    const field = index.get(lapNumber) ?? new Map();
    field.set(lap.driver, lap);
    index.set(lapNumber, field);
  });

  return index;
};

const wasRetained = (lapIndex, driver, opponent, lapNumber) => {
  const laterField = lapIndex.get(lapNumber + 2);
  if (!laterField) return true;
  const driverLap = laterField.get(driver);
  const opponentLap = laterField.get(opponent);
  if (!driverLap || !opponentLap) return true;
  return driverLap.position < opponentLap.position;
};

const estimateTrueOvertakes = (laps) => {
  const lapIndex = buildLapIndex(laps);
  const lapNumbers = Array.from(lapIndex.keys()).sort((a, b) => a - b);
  const events = [];

  lapNumbers.forEach((lapNumber) => {
    if (lapNumber <= 1) return;
    const previous = lapIndex.get(lapNumber - 1);
    const current = lapIndex.get(lapNumber);
    if (!previous || !current) return;

    current.forEach((currentLap, driver) => {
      const previousLap = previous.get(driver);
      if (!previousLap || currentLap.position >= previousLap.position || isPitLap(currentLap) || isPitLap(previousLap)) {
        return;
      }

      previous.forEach((opponentPrevious, opponent) => {
        if (opponent === driver) return;
        const opponentCurrent = current.get(opponent);
        if (!opponentCurrent || isPitLap(opponentPrevious) || isPitLap(opponentCurrent)) return;

        const wasBehind = previousLap.position > opponentPrevious.position;
        const isAhead = currentLap.position < opponentCurrent.position;
        if (!wasBehind || !isAhead) return;

        events.push({
          id: `${lapNumber}-${driver}-${opponent}`,
          lap: lapNumber,
          driver,
          opponent,
          from_position: previousLap.position,
          to_position: currentLap.position,
          positions_gained: previousLap.position - currentLap.position,
          retained_two_laps: wasRetained(lapIndex, driver, opponent, lapNumber),
        });
      });
    });
  });

  return events;
};

const buildCumulativeTimes = (lapsByDriver) => {
  const cumulative = new Map();

  lapsByDriver.forEach((laps, driver) => {
    let elapsed = 0;
    const driverTimes = new Map();

    laps.forEach((lap) => {
      if (Number.isFinite(lap.lap_time)) elapsed += lap.lap_time;
      driverTimes.set(Number(lap.lap_number), elapsed);
    });

    cumulative.set(driver, driverTimes);
  });

  return cumulative;
};

const findTrafficExposure = (laps, lapsByDriver) => {
  const lapIndex = buildLapIndex(laps);
  const cumulative = buildCumulativeTimes(lapsByDriver);
  const exposure = new Map();

  lapIndex.forEach((field, lapNumber) => {
    const ordered = Array.from(field.values()).sort((a, b) => a.position - b.position);

    ordered.forEach((lap, index) => {
      if (index === 0 || !isGreenAccurateLap(lap)) return;
      const ahead = ordered[index - 1];
      const driverElapsed = cumulative.get(lap.driver)?.get(lapNumber);
      const aheadElapsed = cumulative.get(ahead.driver)?.get(lapNumber);
      const gap = driverElapsed - aheadElapsed;

      if (!Number.isFinite(gap) || gap <= 0 || gap > 2) return;
      const rows = exposure.get(lap.driver) ?? [];
      rows.push({
        ...lap,
        opponent: ahead.driver,
        gap_to_ahead: gap,
      });
      exposure.set(lap.driver, rows);
    });
  });

  return exposure;
};

const tyreAgeBucket = (lap) => Math.floor(Math.max(0, Number(lap.tyre_life ?? 1) - 1) / 5);

const estimateTrafficLapLosses = (driverLaps, trafficLaps) => {
  const trafficNumbers = new Set(trafficLaps.map((lap) => lap.lap_number));
  const cleanLaps = driverLaps.filter((lap) => isGreenAccurateLap(lap) && !trafficNumbers.has(lap.lap_number));
  const compoundBaselines = new Map();

  cleanLaps.forEach((lap) => {
    const key = `${lap.compound ?? 'UNKNOWN'}:${tyreAgeBucket(lap)}`;
    const values = compoundBaselines.get(key) ?? [];
    values.push(lap.lap_time);
    compoundBaselines.set(key, values);
  });

  const compoundFallbacks = new Map();
  cleanLaps.forEach((lap) => {
    const key = lap.compound ?? 'UNKNOWN';
    const values = compoundFallbacks.get(key) ?? [];
    values.push(lap.lap_time);
    compoundFallbacks.set(key, values);
  });

  return trafficLaps.map((lap) => {
    const bucket = compoundBaselines.get(`${lap.compound ?? 'UNKNOWN'}:${tyreAgeBucket(lap)}`) ?? [];
    const fallback = compoundFallbacks.get(lap.compound ?? 'UNKNOWN') ?? [];
    const baseline = median(bucket.length >= 2 ? bucket : fallback);
    const loss = Number.isFinite(baseline)
      ? Math.min(5, Math.max(0, lap.lap_time - baseline))
      : 0;

    return {
      ...lap,
      estimated_loss_seconds: loss,
    };
  });
};

const buildTrafficSegments = (trafficLaps, overtakes) => {
  const sorted = [...trafficLaps].sort((a, b) => a.lap_number - b.lap_number);
  const segments = [];

  sorted.forEach((lap) => {
    const previous = segments.at(-1);
    const continuesPrevious = previous
      && previous.opponent === lap.opponent
      && lap.lap_number === previous.end_lap + 1;

    if (!continuesPrevious) {
      segments.push({
        driver: lap.driver,
        opponent: lap.opponent,
        start_lap: lap.lap_number,
        end_lap: lap.lap_number,
        laps: 1,
        gaps: [lap.gap_to_ahead],
        estimated_loss_seconds: lap.estimated_loss_seconds,
      });
      return;
    }

    previous.end_lap = lap.lap_number;
    previous.laps += 1;
    previous.gaps.push(lap.gap_to_ahead);
    previous.estimated_loss_seconds += lap.estimated_loss_seconds;
  });

  return segments.map((segment, index) => {
    const convertedEvent = overtakes.find((event) => (
      event.driver === segment.driver
      && event.opponent === segment.opponent
      && event.lap >= segment.start_lap
      && event.lap <= segment.end_lap + 2
      && event.retained_two_laps
    ));
    const averageGap = segment.gaps.reduce((sum, gap) => sum + gap, 0) / segment.gaps.length;
    const tag = convertedEvent
      ? 'converted'
      : segment.laps >= 5
        ? 'boxed_in'
        : averageGap <= 1
          ? 'attack_window'
          : 'traffic';

    return {
      id: `${segment.driver}-${segment.opponent}-${segment.start_lap}-${index}`,
      driver: segment.driver,
      opponent: segment.opponent,
      start_lap: segment.start_lap,
      end_lap: segment.end_lap,
      laps: segment.laps,
      average_gap_seconds: round(averageGap),
      minimum_gap_seconds: round(Math.min(...segment.gaps)),
      estimated_loss_seconds: round(segment.estimated_loss_seconds),
      converted: Boolean(convertedEvent),
      converted_on_lap: convertedEvent?.lap ?? null,
      tag,
    };
  });
};

const buildPitCycleEvents = (driverLaps) => {
  const byLap = new Map(driverLaps.map((lap) => [Number(lap.lap_number), lap]));

  return driverLaps
    .filter((lap) => lap.pit_in_time != null)
    .map((lap, index) => {
      const lapNumber = Number(lap.lap_number);
      const before = byLap.get(lapNumber - 1) ?? lap;
      const after = byLap.get(lapNumber + 3) ?? driverLaps.at(-1);
      const pitOutLap = byLap.get(lapNumber + 1);
      const positionDelta = Number.isFinite(before?.position) && Number.isFinite(after?.position)
        ? before.position - after.position
        : null;
      const measuredPitLaneTime = Number.isFinite(lap.pit_in_time) && Number.isFinite(pitOutLap?.pit_out_time)
        ? pitOutLap.pit_out_time - lap.pit_in_time
        : null;
      const pitLaneTime = measuredPitLaneTime > 0 && measuredPitLaneTime <= 120
        ? measuredPitLaneTime
        : null;

      return {
        stop: index + 1,
        pit_lap: lapNumber,
        position_before: before?.position ?? null,
        position_after_three_laps: after?.position ?? null,
        position_delta: positionDelta,
        compound_before: before?.compound ?? null,
        compound_after: pitOutLap?.compound ?? null,
        pit_lane_time_seconds: round(pitLaneTime),
        outcome: positionDelta > 0 ? 'gained' : positionDelta < 0 ? 'lost' : 'held',
      };
    });
};

const buildAttritionEvents = (timing, lapsByDriver) => {
  const maxLap = Math.max(0, ...(timing.laps ?? []).map((lap) => Number(lap.lap_number) || 0));
  const results = timing.results ?? [];

  return results
    .filter((result) => didStartRace(result) && !isClassifiedFinisher(result))
    .map((result) => {
      const driverLaps = lapsByDriver.get(result.abbreviation) ?? [];
      const lastLap = driverLaps.at(-1);

      return {
        id: `attrition-${result.abbreviation}`,
        driver: result.abbreviation,
        team: result.team_name ?? lastLap?.team ?? null,
        status: result.status ?? 'Not classified',
        lap: Number(lastLap?.lap_number ?? 0),
        last_position: Number(lastLap?.position) || null,
        completed_race_distance: maxLap > 0
          ? round((Number(lastLap?.lap_number ?? 0) / maxLap) * 100, 1)
          : null,
      };
    })
    .filter((event) => event.lap > 0 && event.lap < maxLap)
    .sort((a, b) => a.lap - b.lap);
};

const countAttritionPlacesGained = (driver, attritionEvents, lapIndex) => (
  attritionEvents.filter((event) => {
    if (event.driver === driver || !Number.isFinite(event.last_position)) return false;
    const field = lapIndex.get(event.lap);
    const driverLap = field?.get(driver);
    const nextDriverLap = lapIndex.get(event.lap + 1)?.get(driver);
    return driverLap
      && nextDriverLap
      && driverLap.position > event.last_position;
  }).length
);

const buildDisruptionEvents = (messages = []) => {
  const events = [];
  const seen = new Set();

  messages.forEach((message) => {
    const text = `${message.category ?? ''} ${message.message ?? ''} ${message.status ?? ''} ${message.flag ?? ''}`;
    let type;

    if (/red flag/i.test(text) || String(message.flag).toUpperCase() === 'RED') type = 'red_flag';
    else if (/virtual safety car|vsc/i.test(text)) type = 'virtual_safety_car';
    else if (/safety car/i.test(text)) type = 'safety_car';
    else return;

    const key = `${type}-${message.lap ?? message.time}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push({
      id: key,
      type,
      lap: Number(message.lap) || null,
      message: message.message ?? null,
    });
  });

  return events;
};

const normalizeProfileValue = (value) => round(Math.max(0, Math.min(100, value)), 1);

const buildCircuitProfile = ({
  timing,
  drivers,
  overtakes,
  attritionEvents,
  disruptionEvents,
}) => {
  const analyzedLaps = timing.laps?.length ?? 0;
  const pitCycles = drivers.flatMap((driver) => driver.pit_cycles);
  const averagePitSwing = pitCycles.length > 0
    ? pitCycles.reduce((sum, cycle) => sum + Math.abs(cycle.position_delta ?? 0), 0) / pitCycles.length
    : 0;
  const trafficLaps = drivers.reduce((sum, driver) => sum + driver.traffic_exposure_laps, 0);

  return {
    event_name: timing.session?.event_name ?? timing.session?.official_event_name ?? null,
    location: timing.session?.location ?? null,
    country: timing.session?.country ?? null,
    dimensions: {
      passing: normalizeProfileValue((overtakes.length / Math.max(1, drivers.length)) * 35),
      traffic: normalizeProfileValue((trafficLaps / Math.max(1, analyzedLaps)) * 220),
      strategy: normalizeProfileValue(averagePitSwing * 32),
      attrition: normalizeProfileValue((attritionEvents.length / Math.max(1, drivers.length)) * 180),
      disruption: normalizeProfileValue(disruptionEvents.length * 22),
    },
  };
};

export const deriveRaceAnalytics = (timing) => {
  const lapsByDriver = groupLapsByDriver(timing.laps ?? []);
  const lapIndex = buildLapIndex(timing.laps ?? []);
  const overtakes = estimateTrueOvertakes(timing.laps ?? []);
  const trafficExposure = findTrafficExposure(timing.laps ?? [], lapsByDriver);
  const resultByDriver = new Map((timing.results ?? []).map((result) => [result.abbreviation, result]));
  const attritionEvents = buildAttritionEvents(timing, lapsByDriver);
  const disruptionEvents = buildDisruptionEvents(timing.race_control_messages);

  const drivers = Array.from(lapsByDriver.entries()).map(([driver, laps]) => {
    const result = resultByDriver.get(driver) ?? {};
    const validLaps = laps.filter(isGreenAccurateLap);
    const lapTimes = validLaps.map((lap) => lap.lap_time);
    const driverOvertakes = overtakes.filter((event) => event.driver === driver);
    const trafficLaps = estimateTrafficLapLosses(laps, trafficExposure.get(driver) ?? []);
    const trafficSegments = buildTrafficSegments(trafficLaps, overtakes);
    const pitCycles = buildPitCycleEvents(laps);
    const gridPosition = Number(result.grid_position);
    const finishPosition = Number(result.position);

    return {
      driver,
      driver_number: result.driver_number ?? laps[0]?.driver_number,
      team: result.team_name ?? laps[0]?.team,
      grid_position: Number.isFinite(gridPosition) ? gridPosition : null,
      finish_position: Number.isFinite(finishPosition) ? finishPosition : null,
      positions_gained: Number.isFinite(gridPosition) && Number.isFinite(finishPosition)
        ? gridPosition - finishPosition
        : null,
      points: Number(result.points ?? 0),
      valid_green_laps: validLaps.length,
      best_lap_seconds: round(Math.min(...lapTimes)),
      median_green_lap_seconds: round(median(lapTimes)),
      green_lap_consistency_seconds: round(standardDeviation(lapTimes)),
      pit_stop_count: pitCycles.length,
      pit_cycles: pitCycles,
      pit_cycle_position_delta: pitCycles.reduce((sum, cycle) => sum + (cycle.position_delta ?? 0), 0),
      estimated_true_overtakes: driverOvertakes.length,
      retained_overtakes: driverOvertakes.filter((event) => event.retained_two_laps).length,
      traffic_exposure_laps: trafficLaps.length,
      estimated_traffic_loss_seconds: round(trafficLaps.reduce(
        (sum, lap) => sum + lap.estimated_loss_seconds,
        0,
      )),
      traffic_segments: trafficSegments,
      attack_windows: trafficSegments.length,
      converted_attack_windows: trafficSegments.filter((segment) => segment.converted).length,
      opportunity_conversion_pct: trafficSegments.length > 0
        ? round((trafficSegments.filter((segment) => segment.converted).length / trafficSegments.length) * 100, 1)
        : null,
      attrition_places_gained: countAttritionPlacesGained(driver, attritionEvents, lapIndex),
    };
  }).sort((a, b) => (a.finish_position ?? 99) - (b.finish_position ?? 99));

  const driverByCode = new Map(drivers.map((driver) => [driver.driver, driver]));
  const enrichedOvertakes = overtakes.map((event) => ({
    ...event,
    driver_team: driverByCode.get(event.driver)?.team ?? null,
    opponent_team: driverByCode.get(event.opponent)?.team ?? null,
  }));
  const trafficSegments = drivers.flatMap((driver) => driver.traffic_segments);
  const pitCycleEvents = drivers.flatMap((driver) => driver.pit_cycles.map((cycle) => ({
    id: `pit-${driver.driver}-${cycle.stop}`,
    type: 'pit_cycle',
    lap: cycle.pit_lap,
    driver: driver.driver,
    team: driver.team,
    ...cycle,
  })));
  const storyEvents = [
    ...enrichedOvertakes.map((event) => ({ ...event, type: 'overtake' })),
    ...pitCycleEvents,
    ...attritionEvents.map((event) => ({ ...event, type: 'attrition' })),
    ...disruptionEvents.map((event) => ({
      ...event,
      disruption_type: event.type,
      type: 'disruption',
    })),
  ].sort((a, b) => (a.lap ?? Number.MAX_SAFE_INTEGER) - (b.lap ?? Number.MAX_SAFE_INTEGER));
  const totalAttackWindows = trafficSegments.length;
  const convertedAttackWindows = trafficSegments.filter((segment) => segment.converted).length;
  const circuitProfile = buildCircuitProfile({
    timing,
    drivers,
    overtakes: enrichedOvertakes,
    attritionEvents,
    disruptionEvents,
  });

  return {
    schema_version: 2,
    calculation_version: '2026.2',
    calculated_at: new Date().toISOString(),
    year: timing.year,
    round: timing.round,
    session: timing.session,
    summary: {
      drivers: drivers.length,
      analyzed_laps: timing.laps?.length ?? 0,
      estimated_true_overtakes: overtakes.length,
      retained_overtakes: overtakes.filter((event) => event.retained_two_laps).length,
      traffic_exposure_laps: drivers.reduce((sum, driver) => sum + driver.traffic_exposure_laps, 0),
      traffic_encounters: trafficSegments.length,
      opportunity_conversion_pct: totalAttackWindows > 0
        ? round((convertedAttackWindows / totalAttackWindows) * 100, 1)
        : null,
      pit_cycles: pitCycleEvents.length,
      pit_cycles_gained: pitCycleEvents.filter((event) => event.position_delta > 0).length,
      pit_cycles_lost: pitCycleEvents.filter((event) => event.position_delta < 0).length,
      attrition_events: attritionEvents.length,
      disruptions: disruptionEvents.length,
    },
    drivers,
    overtake_events: enrichedOvertakes,
    traffic_segments: trafficSegments,
    pit_cycle_events: pitCycleEvents,
    attrition_events: attritionEvents,
    disruption_events: disruptionEvents,
    story_events: storyEvents,
    circuit_profile: circuitProfile,
    definitions: {
      estimated_true_overtakes: 'Lap-to-lap position swaps excluding pit activity and Lap 1; retained status is checked two laps later.',
      estimated_traffic_loss_seconds: 'Positive lap-time delta on green, accurate laps completed within two seconds of the car ahead, compared with the driver own compound and tyre-age baseline.',
      pit_cycles: 'Position before a stop compared with position three laps after the stop; this is an observed cycle result, not a counterfactual prediction.',
      opportunity_conversion_pct: 'Share of sustained traffic encounters that became a retained pass before two laps after the encounter ended.',
      attrition_places_gained: 'Retirements of cars running ahead while the driver continued in the race.',
      circuit_profile: 'Normalized race-shape signals for passing, traffic, strategy volatility, attrition, and race-control disruption.',
    },
  };
};
