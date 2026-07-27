import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import {
  buildIngestionCheckRequest,
  processIngestionCheck,
} from './ingestionCheckDispatcher.js';
import { createLocalRaceEventLedger } from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { runTimingSessionRecorder } from './timingSessionRecorder.js';
import { createLocalTimingRecorderStateStore } from './timingRecorderStateStore.js';

const fixturePath = resolve(
  import.meta.dirname,
  'fixtures/timing/2026-round-99-race.jsonl',
);

const setup = async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'slipstream-ingestion-check-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const stateStore = createLocalTimingRecorderStateStore({ root });
  const rawStore = createRawEventLogStore({ bucket: null, localRoot: root });
  const ledger = createLocalRaceEventLedger({ root });
  const launches = [];
  const launch = async ({ streamMode, refreshCompleted }) => {
    launches.push({ streamMode, refreshCompleted });
    return runTimingSessionRecorder({
      adapter,
      session,
      stateStore,
      rawStore,
      ledger,
      streamMode,
      refreshCompleted,
      rawBatchSize: 10,
      flushIntervalMs: 100,
      leaseDurationMs: 5_000,
    });
  };
  return {
    adapter,
    session,
    stateStore,
    launches,
    launch,
  };
};

test('manual availability check launches historical capture once data is present', async (context) => {
  const testContext = await setup(context);
  const request = buildIngestionCheckRequest({
    sourceId: testContext.adapter.metadata.id,
    sessionId: testContext.session.id,
    requestedBy: 'test-operator',
    requestId: 'check-1',
    requestedAt: '2026-03-01T14:00:00Z',
  });
  const result = await processIngestionCheck({
    ...testContext,
    request,
    now: '2026-03-01T14:00:00Z',
  });

  assert.equal(result.status, 'launched');
  assert.equal(result.reason, 'new_source_records');
  assert.equal(result.streamMode, 'historical');
  assert.deepEqual(testContext.launches, [{
    streamMode: 'historical',
    refreshCompleted: false,
  }]);
  assert.equal(result.launchResult.state.messageCount, 45);
});

test('unchanged provisional data is rechecked without relaunching the recorder', async (context) => {
  const testContext = await setup(context);
  const firstRequest = buildIngestionCheckRequest({
    sourceId: testContext.adapter.metadata.id,
    sessionId: testContext.session.id,
    requestedBy: 'test-operator',
    requestId: 'check-1',
  });
  await processIngestionCheck({
    ...testContext,
    request: firstRequest,
  });

  const second = await processIngestionCheck({
    ...testContext,
    request: {
      ...firstRequest,
      requestId: 'check-2',
      attempt: 2,
    },
    now: '2026-03-01T14:00:00Z',
  });

  assert.equal(second.status, 'retry');
  assert.equal(second.reason, 'provisional_classification_unchanged');
  assert.equal(second.delaySeconds, 300);
  assert.equal(second.nextCheckAt, '2026-03-01T14:05:00.000Z');
  assert.equal(testContext.launches.length, 1);
});

test('negative probe returns a delayed retry and does not launch work', async (context) => {
  const testContext = await setup(context);
  const unavailableAdapter = {
    ...testContext.adapter,
    async probeSessionAvailability() {
      return {
        checkedAt: '2026-03-01T14:00:00Z',
        available: false,
        sessionStatus: 'scheduled',
        classificationStatus: null,
        latestCursor: null,
      };
    },
  };
  const result = await processIngestionCheck({
    ...testContext,
    adapter: unavailableAdapter,
    request: buildIngestionCheckRequest({
      sourceId: unavailableAdapter.metadata.id,
      sessionId: testContext.session.id,
      requestedBy: 'scheduler',
      requestId: 'check-unavailable',
      attempt: 1,
    }),
    now: '2026-03-01T14:00:00Z',
  });

  assert.equal(result.status, 'retry');
  assert.equal(result.reason, 'source_not_available');
  assert.equal(result.delaySeconds, 120);
  assert.equal(testContext.launches.length, 0);
});
