import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import {
  buildIngestionCheckRequest,
  processIngestionCheck,
} from './ingestionCheckDispatcher.js';
import { createLocalRaceEventLedger } from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { runTimingSessionRecorder } from './timingSessionRecorder.js';
import { createLocalTimingRecorderStateStore } from './timingRecorderStateStore.js';

const { values } = parseArgs({
  options: {
    fixture: {
      type: 'string',
      short: 'f',
      default: resolve(import.meta.dirname, 'fixtures/timing/2026-round-99-race.jsonl'),
    },
    output: {
      type: 'string',
      short: 'o',
      default: resolve(import.meta.dirname, '../.data/timing-recorder'),
    },
    session: {
      type: 'string',
      short: 's',
    },
    requester: {
      type: 'string',
      default: 'local-operator',
    },
    attempt: {
      type: 'string',
      default: '1',
    },
  },
});

const outputRoot = resolve(values.output);
const adapter = createFixtureTimingAdapter({
  fixturePath: resolve(values.fixture),
});
const sessions = await adapter.discoverSessions();
const session = values.session
  ? sessions.find((candidate) => candidate.id === values.session)
  : sessions[0];
if (!session) throw new Error('The requested fixture session was not discovered.');

const stateStore = createLocalTimingRecorderStateStore({ root: outputRoot });
const rawStore = createRawEventLogStore({
  bucket: null,
  localRoot: outputRoot,
});
const ledger = createLocalRaceEventLedger({ root: outputRoot });
const decision = await processIngestionCheck({
  request: buildIngestionCheckRequest({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    requestedBy: values.requester,
    reason: 'manual_fixture_check',
    attempt: Number(values.attempt),
  }),
  adapter,
  stateStore,
  launch: async ({
    session: discoveredSession,
    streamMode,
    refreshCompleted,
  }) => {
    const result = await runTimingSessionRecorder({
      adapter,
      session: discoveredSession,
      rawStore,
      ledger,
      stateStore,
      streamMode,
      refreshCompleted,
      rawBatchSize: 10,
      flushIntervalMs: 1_000,
      leaseDurationMs: 60_000,
    });
    return {
      status: result.status,
      messages: result.state.messageCount,
      batches: result.state.batchCount,
      cursor: result.state.cursor,
    };
  },
});

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  decision,
}, null, 2));
