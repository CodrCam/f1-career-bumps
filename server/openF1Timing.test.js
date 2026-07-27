import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOpenF1Snapshot } from './openF1Timing.js';

test('normalizes OpenF1 timing into the race analytics snapshot contract', () => {
  const snapshot = normalizeOpenF1Snapshot({
    year: 2026,
    round: 10,
    officialRace: {
      round: 10,
      grand_prix: 'Belgian Grand Prix',
      date: '2026-07-19',
      race_results: [
        { position: 1, driver_code: 'NOR', driver: 'Lando Norris', team: 'McLaren', points: 25, status: 'Finished' },
        { position: 2, driver_code: 'PIA', driver: 'Oscar Piastri', team: 'McLaren', points: 18, status: 'Finished' },
      ],
      starting_grid: [
        { position: 2, driver_code: 'NOR' },
        { position: 1, driver_code: 'PIA' },
      ],
    },
    session: {
      session_key: 100,
      session_name: 'Race',
      meeting_name: 'Belgian Grand Prix',
      country_name: 'Belgium',
      location: 'Spa-Francorchamps',
      date_start: '2026-07-19T13:00:00+00:00',
    },
    drivers: [
      { driver_number: 4, name_acronym: 'NOR', full_name: 'Lando Norris', team_name: 'McLaren' },
      { driver_number: 81, name_acronym: 'PIA', full_name: 'Oscar Piastri', team_name: 'McLaren' },
    ],
    laps: [
      {
        driver_number: 4,
        lap_number: 2,
        lap_duration: 108.2,
        duration_sector_1: 31,
        duration_sector_2: 45,
        duration_sector_3: 32.2,
        date_start: '2026-07-19T13:03:00+00:00',
        is_pit_out_lap: false,
      },
      {
        driver_number: 81,
        lap_number: 2,
        lap_duration: 108.6,
        duration_sector_1: 31.1,
        duration_sector_2: 45.1,
        duration_sector_3: 32.4,
        date_start: '2026-07-19T13:03:00+00:00',
        is_pit_out_lap: false,
      },
    ],
    positions: [
      { driver_number: 4, position: 1, date: '2026-07-19T13:04:30+00:00' },
      { driver_number: 81, position: 2, date: '2026-07-19T13:04:30+00:00' },
    ],
    stints: [
      { driver_number: 4, stint_number: 1, lap_start: 1, lap_end: 20, compound: 'MEDIUM', tyre_age_at_start: 0 },
      { driver_number: 81, stint_number: 1, lap_start: 1, lap_end: 20, compound: 'MEDIUM', tyre_age_at_start: 0 },
    ],
    pit: [],
    raceControl: [],
    weather: [{ date: '2026-07-19T13:04:00+00:00', air_temperature: 21, track_temperature: 31 }],
    sessionResults: [
      { driver_number: 4, position: 1 },
      { driver_number: 81, position: 2 },
    ],
    startingGrid: [
      { driver_number: 4, position: 2 },
      { driver_number: 81, position: 1 },
    ],
  });

  assert.equal(snapshot.source, 'OpenF1 historical timing');
  assert.equal(snapshot.results[0].abbreviation, 'NOR');
  assert.equal(snapshot.results[0].grid_position, 2);
  assert.equal(snapshot.laps[0].compound, 'MEDIUM');
  assert.equal(snapshot.laps[0].position, 1);
  assert.equal(snapshot.capabilities.lap_timing, true);
  assert.equal(snapshot.capabilities.tyres_and_stints, true);
});
