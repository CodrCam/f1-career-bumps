import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveRaceAnalytics } from './raceAnalytics.js';
import { validateRaceSources } from './sourceValidation.js';

const officialRace = {
  year: 2026,
  round: 1,
  grand_prix: 'Test Grand Prix',
  available_sessions: ['starting_grid', 'pit_stops', 'fastest_laps', 'race_results'],
  race_results: [
    { driver_code: 'AAA', team: 'Alpha', position: 1 },
    { driver_code: 'BBB', team: 'Beta', position: 2 },
  ],
  starting_grid: [
    { driver_code: 'BBB', position: 1 },
    { driver_code: 'AAA', position: 2 },
  ],
  pit_stops: [
    { driver_code: 'AAA', lap: 3 },
  ],
  fastest_laps: [
    { driver_code: 'AAA', position: 1, time_seconds: 90 },
  ],
};

const timing = {
  year: 2026,
  round: 1,
  session: { name: 'Race' },
  capabilities: {
    results: true,
    starting_grid: true,
    lap_timing: true,
    sector_timing: true,
    pit_markers: true,
    tyres_and_stints: true,
    weather: true,
    track_status: true,
    race_control: true,
  },
  results: [
    { abbreviation: 'AAA', driver_number: '1', team_name: 'Alpha', grid_position: 2, position: 1, points: 25 },
    { abbreviation: 'BBB', driver_number: '2', team_name: 'Beta', grid_position: 1, position: 2, points: 18 },
  ],
  laps: [
    { driver: 'AAA', lap_number: 1, position: 2, lap_time: 92, compound: 'MEDIUM', tyre_life: 1, track_status: '1', is_accurate: false },
    { driver: 'BBB', lap_number: 1, position: 1, lap_time: 91, compound: 'MEDIUM', tyre_life: 1, track_status: '1', is_accurate: false },
    { driver: 'AAA', lap_number: 2, position: 1, lap_time: 90, compound: 'MEDIUM', tyre_life: 2, track_status: '1', is_accurate: true },
    { driver: 'BBB', lap_number: 2, position: 2, lap_time: 91, compound: 'MEDIUM', tyre_life: 2, track_status: '1', is_accurate: true },
    { driver: 'AAA', lap_number: 3, position: 1, lap_time: 110, compound: 'MEDIUM', tyre_life: 3, track_status: '1', is_accurate: false, pit_in_time: 200 },
    { driver: 'BBB', lap_number: 3, position: 2, lap_time: 90.5, compound: 'MEDIUM', tyre_life: 3, track_status: '1', is_accurate: true },
    { driver: 'AAA', lap_number: 4, position: 1, lap_time: 90.2, compound: 'HARD', tyre_life: 1, track_status: '1', is_accurate: true },
    { driver: 'BBB', lap_number: 4, position: 2, lap_time: 90.8, compound: 'MEDIUM', tyre_life: 4, track_status: '1', is_accurate: true },
  ],
};

test('validates official classifications, grids, pits, and fastest laps against timing data', () => {
  const validation = validateRaceSources(officialRace, timing);

  assert.equal(validation.status, 'pass');
  assert.equal(validation.checks.find((check) => check.id === 'driver_coverage').status, 'pass');
  assert.equal(validation.checks.find((check) => check.id === 'pit_stops').status, 'pass');
});

test('derives transparent starter analytics from the timing snapshot', () => {
  const analytics = deriveRaceAnalytics(timing);
  const winner = analytics.drivers.find((driver) => driver.driver === 'AAA');

  assert.equal(winner.positions_gained, 1);
  assert.equal(winner.pit_stop_count, 1);
  assert.equal(winner.estimated_true_overtakes, 1);
  assert.equal(winner.retained_overtakes, 1);
  assert.equal(analytics.summary.drivers, 2);
  assert.equal(analytics.schema_version, 2);
  assert.equal(analytics.overtake_events[0].type, undefined);
  assert.equal(analytics.story_events.some((event) => event.type === 'overtake'), true);
  assert.equal(typeof analytics.circuit_profile.dimensions.passing, 'number');
});

test('orders pit cycles by lap and separates temporary loss from strategy context', () => {
  const positionsByLap = [
    { AAA: 2, BBB: 1, CCC: 3 },
    { AAA: 2, BBB: 1, CCC: 3 },
    { AAA: 2, BBB: 1, CCC: 3 },
    { AAA: 3, BBB: 1, CCC: 2 },
    { AAA: 1, BBB: 3, CCC: 2 },
    { AAA: 1, BBB: 2, CCC: 3 },
    { AAA: 1, BBB: 2, CCC: 3 },
    { AAA: 1, BBB: 2, CCC: 3 },
  ];
  const pitLaps = new Map([
    ['AAA', 3],
    ['BBB', 4],
    ['CCC', 6],
  ]);
  const laps = positionsByLap.flatMap((positions, index) => (
    Object.entries(positions).map(([driver, position]) => {
      const lapNumber = index + 1;
      const pitLap = pitLaps.get(driver);

      return {
        driver,
        driver_number: driver === 'AAA' ? '1' : driver === 'BBB' ? '2' : '3',
        lap_number: lapNumber,
        position,
        lap_time: 90 + position,
        compound: lapNumber <= pitLap ? 'MEDIUM' : 'HARD',
        tyre_life: lapNumber,
        track_status: driver === 'CCC' && lapNumber === 6 ? '6' : '1',
        is_accurate: lapNumber > 1 && lapNumber !== pitLap && lapNumber !== pitLap + 1,
        pit_in_time: lapNumber === pitLap ? 100 + lapNumber : null,
        pit_out_time: lapNumber === pitLap + 1 ? 120 + lapNumber : null,
      };
    })
  ));
  const pitStoryTiming = {
    year: 2026,
    round: 2,
    session: { name: 'Race' },
    results: [
      { abbreviation: 'AAA', team_name: 'Alpha', grid_position: 2, position: 1, status: 'Finished' },
      { abbreviation: 'BBB', team_name: 'Beta', grid_position: 1, position: 2, status: 'Finished' },
      { abbreviation: 'CCC', team_name: 'Gamma', grid_position: 3, position: 3, status: 'Finished' },
    ],
    race_control_messages: [
      { category: 'SafetyCar', message: 'VSC DEPLOYED', status: 'DEPLOYED', lap: 6 },
      { category: 'Flag', message: 'CHEQUERED FLAG', flag: 'CHEQUERED', lap: 8 },
    ],
    laps,
  };

  const analytics = deriveRaceAnalytics(pitStoryTiming);
  const undercut = analytics.pit_cycle_events.find((event) => event.driver === 'AAA');
  const neutralizedStop = analytics.pit_cycle_events.find((event) => event.driver === 'CCC');

  assert.deepEqual(analytics.pit_cycle_events.map((event) => event.pit_lap), [3, 4, 6]);
  assert.equal(undercut.position_on_exit, 3);
  assert.equal(undercut.positions_lost_on_exit, 1);
  assert.equal(undercut.positions_recovered_after_exit, 2);
  assert.equal(undercut.strategy_context, 'undercut_success');
  assert.equal(undercut.strategy_rival, 'BBB');
  assert.equal(neutralizedStop.strategy_context, 'virtual_safety_car_window');
  assert.equal(analytics.disruption_events.some((event) => event.type === 'red_flag'), false);
});

test('treats additional detailed timing pit markers as a warning, not a failed race', () => {
  const timingWithExtraStop = {
    ...timing,
    laps: timing.laps.map((lap) => (
      lap.driver === 'BBB' && lap.lap_number === 3
        ? { ...lap, pit_in_time: 205 }
        : lap
    )),
  };
  const validation = validateRaceSources(officialRace, timingWithExtraStop);
  const pitCheck = validation.checks.find((check) => check.id === 'pit_stops');

  assert.equal(pitCheck.status, 'warning');
  assert.equal(validation.status, 'warning');
});
