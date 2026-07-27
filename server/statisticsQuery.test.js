import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDriverDirectoryReadModel } from './analysisReadModels.js';
import {
  parseStatisticsQuestion,
  runStatisticsQuery,
  StatisticsQueryError,
  validateStatisticsQuery,
} from './statisticsQuery.js';

const directory = buildDriverDirectoryReadModel({
  year: 2026,
  season: {
    races: [
      {
        round: 1,
        grand_prix: 'Opening Grand Prix',
        qualifying_results: [
          { position: 1, driver: 'Alex Apex', team: 'Velocity' },
          { position: 3, driver: 'Jamie Jet', team: 'Velocity' },
          { position: 2, driver: 'Robin Rapid', team: 'Momentum' },
        ],
        race_results: [
          {
            position: 1,
            driver: 'Alex Apex',
            driver_code: 'APX',
            team: 'Velocity',
            points: 25,
            grid: 1,
            status: 'Finished',
          },
          {
            position: 2,
            driver: 'Robin Rapid',
            driver_code: 'RAP',
            team: 'Momentum',
            points: 18,
            grid: 2,
            status: 'Finished',
          },
          {
            position: 5,
            driver: 'Jamie Jet',
            driver_code: 'JET',
            team: 'Velocity',
            points: 10,
            grid: 3,
            status: 'Finished',
          },
        ],
      },
      {
        round: 2,
        grand_prix: 'Second Grand Prix',
        qualifying_results: [
          { position: 2, driver: 'Alex Apex', team: 'Velocity' },
          { position: 1, driver: 'Jamie Jet', team: 'Velocity' },
          { position: 3, driver: 'Robin Rapid', team: 'Momentum' },
        ],
        sprint_results: [
          { position: 1, driver: 'Jamie Jet', team: 'Velocity', points: 8 },
        ],
        race_results: [
          {
            position: 4,
            driver: 'Alex Apex',
            driver_code: 'APX',
            team: 'Velocity',
            points: 12,
            grid: 2,
            status: 'Finished',
          },
          {
            position: 1,
            driver: 'Jamie Jet',
            driver_code: 'JET',
            team: 'Velocity',
            points: 25,
            grid: 1,
            status: 'Finished',
          },
          {
            driver: 'Robin Rapid',
            driver_code: 'RAP',
            team: 'Momentum',
            points: 0,
            grid: 3,
            status: 'Retired',
          },
        ],
      },
    ],
  },
  summary: {
    source: 'Formula1.com',
    updatedAt: '2026-03-08T18:00:00Z',
  },
  publication: {
    races: [
      { round: 1, state: 'published' },
      { round: 2, state: 'published' },
    ],
  },
});

test('parses a natural-language metric, round range, team, and result limit', () => {
  const parsed = parseStatisticsQuestion(
    'Who has the best average finish for Velocity from round 1 through round 2?',
    directory,
    2026,
  );

  assert.equal(parsed.query.metrics[0], 'average_finish');
  assert.equal(parsed.query.filters.team, 'Velocity');
  assert.equal(parsed.query.filters.roundFrom, 1);
  assert.equal(parsed.query.filters.roundTo, 2);
  assert.equal(parsed.query.sort[0].direction, 'asc');
  assert.equal(parsed.query.limit, 1);
  assert.ok(parsed.interpretation.confidence > 0.8);
});

test('calculates, ranks, explains, and links every deterministic answer', () => {
  const result = runStatisticsQuery({
    input: {
      query: {
        season: 2026,
        subject: 'drivers',
        metrics: ['points', 'average_finish'],
        filters: {
          roundFrom: 1,
          roundTo: 2,
          team: 'Velocity',
          driverIds: [],
        },
        groupBy: ['driver'],
        sort: [{ metric: 'points', direction: 'desc' }],
        limit: 2,
      },
    },
    directory,
  });

  assert.equal(result.data.rows[0].entity, 'Jamie Jet');
  assert.equal(result.data.rows[0].values.points.value, 43);
  assert.equal(result.data.rows[1].values.points.value, 37);
  assert.equal(result.data.sample.resultCount, 4);
  assert.equal(result.data.evidence.length, 4);
  assert.match(result.data.calculation.definition, /race and sprint points/i);
  assert.equal(result.data.relatedRoutes[0].path, '/2026/drivers/jamie-jet');
  assert.equal(result.meta.schemaVersion, '2.0');
});

test('uses only the selected driver and published round sample', () => {
  const result = runStatisticsQuery({
    input: {
      question: 'How reliable is Robin Rapid through round 2?',
      season: 2026,
    },
    directory,
  });

  assert.equal(result.data.query.filters.driverIds[0], 'robin-rapid');
  assert.equal(result.data.rows[0].values.reliability.value, 50);
  assert.equal(result.data.rows[0].values.reliability.sampleSize, 2);
  assert.match(result.data.answer.summary, /50%/);
});

test('rejects arbitrary fields, metrics, and entities before execution', () => {
  assert.throws(() => validateStatisticsQuery({
    season: 2026,
    subject: 'drivers',
    metrics: ['drop_database'],
    filters: {
      roundFrom: 1,
      roundTo: 2,
      team: 'Imaginary Team',
      driverIds: ['nobody'],
      rawSql: 'select *',
    },
    groupBy: ['driver'],
    sort: [{ metric: 'drop_database', direction: 'sideways' }],
    limit: 1000,
    code: 'arbitrary()',
  }, directory), (error) => (
    error instanceof StatisticsQueryError
      && error.issues.length >= 6
  ));
});

test('rejects object-prototype names as unsupported metrics', () => {
  assert.throws(() => validateStatisticsQuery({
    season: 2026,
    subject: 'drivers',
    metrics: ['constructor'],
    filters: {
      roundFrom: 1,
      roundTo: 2,
      team: null,
      driverIds: [],
    },
    groupBy: ['driver'],
    sort: [{ metric: 'constructor', direction: 'desc' }],
    limit: 10,
  }, directory), (error) => (
    error instanceof StatisticsQueryError
      && error.issues.some((issue) => /unsupported metric: constructor/i.test(issue))
  ));
});

test('interprets most DNFs as a descending ranking', () => {
  const parsed = parseStatisticsQuestion(
    'Who has the most DNFs?',
    directory,
    2026,
  );

  assert.equal(parsed.query.metrics[0], 'dnfs');
  assert.equal(parsed.query.sort[0].direction, 'desc');
  assert.equal(parsed.query.limit, 1);
});
