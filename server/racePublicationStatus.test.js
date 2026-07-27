import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditRacePublication,
  buildRacePublicationStatus,
  missingDetailedTimingCapabilities,
  publicRacePublicationStatus,
  RACE_PUBLICATION_SCHEMA_VERSION,
} from './racePublicationStatus.js';

test('builds a stable public race publication status', () => {
  const status = buildRacePublicationStatus({
    year: 2026,
    round: 10,
    grandPrix: 'Belgian Grand Prix',
    state: 'degraded',
    sourceCoverage: {
      formula1Official: 'ready',
      detailedTiming: 'unavailable',
    },
    missingCapabilities: ['Every lap and sector', 'Every lap and sector', 'Weather'],
    lastAttemptAt: '2026-07-26T16:00:00.000Z',
    nextAttemptAt: '2026-07-26T22:00:00.000Z',
    contentVersion: 'abc123',
    lastErrorCode: 'DETAILED_TIMING_UNAVAILABLE',
  });

  assert.equal(status.schemaVersion, RACE_PUBLICATION_SCHEMA_VERSION);
  assert.equal(status.year, 2026);
  assert.equal(status.round, 10);
  assert.equal(status.state, 'degraded');
  assert.deepEqual(status.missingCapabilities, ['Every lap and sector', 'Weather']);
});

test('rejects unknown publication states', () => {
  assert.throws(
    () => buildRacePublicationStatus({
      year: 2026,
      round: 10,
      state: 'sort-of-ready',
    }),
    /Unknown race publication state/,
  );
});

test('reports detailed timing capabilities that are not covered', () => {
  assert.deepEqual(
    missingDetailedTimingCapabilities([
      { capability: 'Starting grid', detailed_timing: true },
      { capability: 'Weather', detailed_timing: false },
      { capability: 'Race-control messages', detailed_timing: false },
    ]),
    ['Weather', 'Race-control messages'],
  );
});

test('strips internal DynamoDB fields from public status records', () => {
  assert.deepEqual(
    publicRacePublicationStatus({
      pk: 'SEASON#2026',
      sk: 'STATUS#ROUND#10',
      itemType: 'race_publication_status',
      year: 2026,
      round: 10,
      state: 'published',
    }),
    {
      year: 2026,
      round: 10,
      state: 'published',
    },
  );
});

test('audits every completed race and honors legacy analytics', () => {
  const audit = auditRacePublication({
    completedRaces: [
      { round: 8, grand_prix: 'Austrian Grand Prix' },
      { round: 9, grand_prix: 'British Grand Prix' },
      { round: 10, grand_prix: 'Belgian Grand Prix' },
    ],
    analyticsRaces: [
      { round: 8 },
      { round: 9 },
    ],
    publicationStatuses: [
      { round: 9, state: 'published' },
      { round: 10, state: 'degraded' },
    ],
  });

  assert.equal(audit.completed, 3);
  assert.deepEqual(audit.published, [8, 9]);
  assert.deepEqual(audit.incomplete, [{
    round: 10,
    grandPrix: 'Belgian Grand Prix',
    state: 'degraded',
  }]);
  assert.equal(audit.races[0].state, 'published_legacy');
});
