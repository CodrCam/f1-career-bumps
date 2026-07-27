import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeasonOverview } from './seasonOverview.js';

const race = (round, results, sprintResults = []) => ({
  round,
  grand_prix: `Round ${round} Grand Prix`,
  date: `2026-0${round}-01`,
  race_results: results,
  sprint_results: sprintResults,
});

test('builds a versioned season desk from published race data', () => {
  const overview = buildSeasonOverview({
    year: 2026,
    season: {
      races: [
        race(1, [
          { position: 1, driver: 'Driver A', driver_code: 'AAA', team: 'Alpha', points: 25, grid: 2 },
          { position: 2, driver: 'Driver B', driver_code: 'BBB', team: 'Beta', points: 18, grid: 1 },
        ]),
        race(2, [
          { position: 1, driver: 'Driver B', driver_code: 'BBB', team: 'Beta', points: 25, grid: 1 },
          { position: 2, driver: 'Driver A', driver_code: 'AAA', team: 'Alpha', points: 18, grid: 3 },
        ], [
          { position: 1, driver: 'Driver B', driver_code: 'BBB', team: 'Beta', points: 8 },
        ]),
      ],
    },
    summary: {
      results: 6,
      source: 'Formula1.com',
      updatedAt: '2026-02-02T12:00:00.000Z',
    },
    analytics: {
      races: [
        { round: 1, summary: { estimated_true_overtakes: 21 } },
      ],
    },
    publication: {
      races: [{
        round: 2,
        state: 'degraded',
        contentVersion: 'race-2',
        sourceCoverage: {
          formula1Official: 'ready',
        },
        missingCapabilities: ['Detailed race timing'],
        updatedAt: '2026-02-02T13:00:00.000Z',
      }],
    },
  });

  assert.equal(overview.meta.schemaVersion, '2.0');
  assert.equal(overview.meta.state, 'degraded');
  assert.equal(overview.meta.contentVersion, 'race-2');
  assert.equal(overview.data.latestRace.round, 2);
  assert.equal(overview.data.latestRace.podium[0].driver, 'Driver B');
  assert.deepEqual(
    overview.data.driverStandings.slice(0, 2).map(({ name, points, movement }) => ({
      name,
      points,
      movement,
    })),
    [
      { name: 'Driver B', points: 51, movement: 1 },
      { name: 'Driver A', points: 43, movement: -1 },
    ],
  );
  assert.equal(overview.data.constructorStandings[0].name, 'Beta');
  assert.deepEqual(overview.data.coverage.publishedRounds, [1]);
  assert.equal(overview.data.coverage.incompleteRounds[0].state, 'degraded');
  assert.deepEqual(overview.meta.warnings, ['Detailed race timing']);
});

test('returns an empty scheduled season without inventing a next race', () => {
  const overview = buildSeasonOverview({
    year: 2026,
    season: { races: [] },
    analytics: { races: [] },
    publication: { races: [] },
  });

  assert.equal(overview.meta.state, 'scheduled');
  assert.equal(overview.data.latestRace, null);
  assert.deepEqual(overview.data.driverStandings, []);
  assert.deepEqual(overview.data.constructorStandings, []);
});
