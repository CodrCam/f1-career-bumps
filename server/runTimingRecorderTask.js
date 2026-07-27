import { resolve } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import {
  createDynamoRaceEventLedger,
} from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { runTimingSessionRecorder } from './timingSessionRecorder.js';
import {
  createDynamoTimingRecorderStateStore,
} from './timingRecorderStateStore.js';
import {
  assertSourceOperationPermitted,
} from './timingSourceAdapter.js';

const sourceId = process.env.TIMING_SOURCE_ID;
const deploymentScope = process.env.TIMING_DEPLOYMENT_SCOPE ?? 'production';
const jobMode = process.env.TIMING_JOB_MODE ?? 'live';
const tableName = process.env.DYNAMODB_TABLE;
const bucket = process.env.F1_RAW_DATA_BUCKET;
const region = process.env.AWS_REGION ?? 'us-west-2';

if (!sourceId) throw new Error('TIMING_SOURCE_ID is required.');
if (!tableName) throw new Error('DYNAMODB_TABLE is required.');
if (!bucket) throw new Error('F1_RAW_DATA_BUCKET is required.');

const createAdapter = () => {
  if (sourceId === 'slipstream-fixture') {
    return createFixtureTimingAdapter({
      fixturePath: resolve(
        process.env.TIMING_FIXTURE_PATH
          ?? resolve(import.meta.dirname, 'fixtures/timing/2026-round-99-race.jsonl'),
      ),
      liveDelayMs: Number(process.env.TIMING_FIXTURE_DELAY_MS ?? 0),
    });
  }
  throw new Error(
    `Timing source "${sourceId}" is not installed in this task image. Add its authorized adapter before scheduling the task.`,
  );
};

const adapter = createAdapter();
assertSourceOperationPermitted(adapter, 'sessionDiscovery', { deploymentScope });
const sessions = await adapter.discoverSessions();
const session = process.env.TIMING_SESSION_ID
  ? sessions.find((candidate) => candidate.id === process.env.TIMING_SESSION_ID)
  : sessions[0];
if (!session) {
  throw new Error(
    process.env.TIMING_SESSION_ID
      ? `Timing session "${process.env.TIMING_SESSION_ID}" was not discovered.`
      : `Timing source "${sourceId}" discovered no sessions.`,
  );
}

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const configuredOwnerId = process.env.TIMING_RECORDER_OWNER_ID;
const result = await runTimingSessionRecorder({
  adapter,
  session,
  deploymentScope,
  streamMode: jobMode === 'historical' ? 'historical' : 'live',
  refreshCompleted: jobMode === 'historical',
  rawStore: createRawEventLogStore({
    bucket,
    region,
  }),
  ledger: createDynamoRaceEventLedger({
    documentClient: dynamo,
    tableName,
  }),
  stateStore: createDynamoTimingRecorderStateStore({
    documentClient: dynamo,
    tableName,
  }),
  ...(configuredOwnerId ? { ownerId: configuredOwnerId } : {}),
  rawBatchSize: Number(process.env.TIMING_RAW_BATCH_SIZE ?? 100),
  flushIntervalMs: Number(process.env.TIMING_FLUSH_INTERVAL_MS ?? 5_000),
  leaseDurationMs: Number(process.env.TIMING_LEASE_DURATION_MS ?? 60_000),
});

console.log(JSON.stringify({
  ok: true,
  source: adapter.metadata.id,
  deploymentScope,
  jobMode,
  session: session.id,
  status: result.status,
  messages: result.state.messageCount,
  batches: result.state.batchCount,
  cursor: result.state.cursor,
  sequenceGaps: result.sequenceGaps,
}, null, 2));
