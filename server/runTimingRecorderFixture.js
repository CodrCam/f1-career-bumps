import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import { createLocalRaceEventLedger } from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { runTimingSessionRecorder } from './timingSessionRecorder.js';
import { createLocalTimingRecorderStateStore } from './timingRecorderStateStore.js';
import {
  assertSourceOperationPermitted,
} from './timingSourceAdapter.js';

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
    delay: {
      type: 'string',
      default: '0',
    },
    'batch-size': {
      type: 'string',
      default: '10',
    },
    'flush-interval': {
      type: 'string',
      default: '1000',
    },
    prepare: {
      type: 'boolean',
      default: false,
    },
  },
});

const outputRoot = resolve(values.output);
const adapter = createFixtureTimingAdapter({
  fixturePath: resolve(values.fixture),
  liveDelayMs: Number(values.delay),
});
assertSourceOperationPermitted(adapter, 'sessionDiscovery');
const sessions = await adapter.discoverSessions();
const session = values.session
  ? sessions.find((candidate) => candidate.id === values.session)
  : sessions[0];
if (!session) {
  throw new Error(
    values.session
      ? `Fixture session "${values.session}" was not found.`
      : 'The timing fixture contains no sessions.',
  );
}

const stateStore = createLocalTimingRecorderStateStore({ root: outputRoot });
if (values.prepare) {
  const state = await stateStore.register({
    session,
    source: adapter.metadata,
  });
  console.log(JSON.stringify({
    ok: true,
    action: 'prepared',
    outputRoot,
    state,
  }, null, 2));
  process.exit(0);
}

const result = await runTimingSessionRecorder({
  adapter,
  session,
  rawStore: createRawEventLogStore({
    bucket: null,
    localRoot: outputRoot,
  }),
  ledger: createLocalRaceEventLedger({ root: outputRoot }),
  stateStore,
  rawBatchSize: Number(values['batch-size']),
  flushIntervalMs: Number(values['flush-interval']),
});

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  status: result.status,
  session: result.state.session,
  progress: {
    messages: result.state.messageCount,
    batches: result.state.batchCount,
    cursor: result.state.cursor,
    lastSequence: result.state.lastSequence,
  },
  rawBatches: result.rawBatches,
  ledgerWrites: result.ledgerWrites,
  sequenceGaps: result.sequenceGaps,
}, null, 2));
