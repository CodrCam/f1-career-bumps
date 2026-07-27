import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import { createMemoryRaceEventLedger } from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { runRecordedTimingPipeline } from './fixtureIngestionPipeline.js';
import { evaluateSessionPublication } from './sessionPublicationGate.js';

const fixturePath = resolve(
  import.meta.dirname,
  'fixtures/timing/2026-round-99-race.jsonl',
);

test('completed session with a provisional classification is immediately materializable and rechecked', async (context) => {
  const localRoot = await mkdtemp(join(tmpdir(), 'slipstream-publication-gate-'));
  context.after(() => rm(localRoot, { recursive: true, force: true }));
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const ledger = createMemoryRaceEventLedger();
  await runRecordedTimingPipeline({
    adapter,
    session,
    ledger,
    rawStore: createRawEventLogStore({
      localRoot,
      bucket: null,
    }),
  });
  const recorderState = {
    status: 'complete',
    session,
  };
  const decision = evaluateSessionPublication({
    recorderState,
    events: await ledger.list(),
    now: '2026-03-01T13:36:00.000Z',
  });

  assert.equal(decision.status, 'ready_provisional');
  assert.equal(decision.publishable, true);
  assert.equal(decision.authority, 'provisional');
  assert.equal(decision.action, 'materialize_race_provisional');
  assert.equal(decision.classification.entries, 3);
  assert.equal(decision.nextCheckAt, '2026-03-01T13:46:00.000Z');
});

test('final classification ends polling while missing classification remains gated', () => {
  const recorderState = {
    status: 'complete',
    session: {
      id: '2026-01-Q',
      type: 'qualifying',
    },
  };
  const finish = {
    eventId: 'finish',
    sessionId: '2026-01-Q',
    eventType: 'race_finish',
    timestamp: '2026-03-01T12:00:00.000Z',
  };
  const waiting = evaluateSessionPublication({
    recorderState,
    events: [finish],
    now: '2026-03-01T12:00:00.000Z',
  });
  assert.equal(waiting.status, 'waiting_for_classification');
  assert.equal(waiting.publishable, false);

  const final = evaluateSessionPublication({
    recorderState,
    events: [
      finish,
      {
        eventId: 'classification-final',
        sessionId: '2026-01-Q',
        eventType: 'classification',
        timestamp: '2026-03-01T12:05:00.000Z',
        observed: {
          status: 'final',
          entries: [{ position: 1, driver: 'NOR' }],
        },
      },
    ],
    now: '2026-03-01T12:05:00.000Z',
  });
  assert.equal(final.status, 'ready_final');
  assert.equal(final.action, 'materialize_qualifying_final');
  assert.equal(final.nextCheckAt, null);
});
