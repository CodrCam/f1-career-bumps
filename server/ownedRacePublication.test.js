import assert from 'node:assert/strict';
import test from 'node:test';
import { publishOwnedRaceTiming } from './ownedRacePublication.js';

const officialRace = {
  year: 2026,
  round: 1,
  grand_prix: 'Test Grand Prix',
  available_sessions: ['race_results'],
  race_results: [
    {
      driver_code: 'AAA',
      team: 'Alpha',
      position: 1,
      status: 'Finished',
      points: 25,
    },
  ],
};

const recorderState = {
  source: {
    id: 'slipstream-owned',
    displayName: 'Slipstream owned recorder',
  },
  session: {
    id: '2026-01-R',
    year: 2026,
    round: 1,
    type: 'race',
    name: 'Test Grand Prix',
    startsAt: '2026-03-08T04:00:00.000Z',
  },
  status: 'complete',
  updatedAt: '2026-03-08T06:00:00.000Z',
};

const event = (eventType, timestamp, observed) => ({
  eventId: `${eventType}-${timestamp}`,
  year: 2026,
  round: 1,
  sessionId: recorderState.session.id,
  eventType,
  timestamp,
  source: 'slipstream-owned',
  observed,
});

const events = [
  event('driver_registered', '2026-03-08T04:00:01.000Z', {
    driver: 'AAA',
    driver_name: 'Ada Apex',
    team: 'Alpha',
  }),
  event('lap_timing', '2026-03-08T04:02:00.000Z', {
    driver: 'AAA',
    lap: 1,
    lap_time_seconds: 90,
    position: 1,
  }),
  event('classification', '2026-03-08T05:35:00.000Z', {
    status: 'final',
    entries: [{
      driver: 'AAA',
      position: 1,
      status: 'Finished',
      points: 25,
    }],
  }),
  event('race_finish', '2026-03-08T05:36:00.000Z', {}),
];

const snapshot = async (_data, options) => ({
  mode: 'memory',
  source: options.source,
  sha256: `${options.source}-hash`,
});

test('missing owned recorder registration is an expected deferred publication', async () => {
  const statuses = [];
  const result = await publishOwnedRaceTiming({
    officialRace,
    officialSnapshot: { sha256: 'official-hash' },
    stateStore: { list: async () => [] },
    ledger: { list: async () => [] },
    persistStatus: async (status) => statuses.push(status),
    persistAnalytics: async () => assert.fail('analytics should not be written'),
    storeSnapshot: snapshot,
    now: '2026-03-08T06:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'source_not_connected');
  assert.equal(result.status.state, 'awaiting_timing');
  assert.equal(result.status.nextAttemptAt, '2026-03-09T06:00:00.000Z');
  assert.equal(statuses.length, 1);
});

test('complete owned events publish analytics without a third-party fallback', async () => {
  const analyticsWrites = [];
  const result = await publishOwnedRaceTiming({
    officialRace,
    officialSnapshot: { sha256: 'official-hash' },
    stateStore: { list: async () => [recorderState] },
    ledger: { list: async () => events },
    persistStatus: async () => undefined,
    persistAnalytics: async (publication) => analyticsWrites.push(publication),
    storeSnapshot: snapshot,
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'published');
  assert.equal(result.status.sourceCoverage.slipstreamRecorder, 'ready');
  assert.equal(result.timing.source.id, 'slipstream-owned');
  assert.equal(analyticsWrites.length, 1);
  assert.equal(
    analyticsWrites[0].rawSnapshots.recorderEvidence.sessionId,
    recorderState.session.id,
  );
});
