import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import { createLocalRaceEventLedger } from './raceEventLedger.js';
import { createRawEventLogStore } from './rawEventLogStore.js';
import { buildTimingRecorderReadModel } from './timingRecorderReadModel.js';
import {
  RecorderLeaseUnavailableError,
  runTimingSessionRecorder,
} from './timingSessionRecorder.js';
import {
  createDynamoTimingRecorderStateStore,
  createLocalTimingRecorderStateStore,
  createMemoryTimingRecorderStateStore,
} from './timingRecorderStateStore.js';
import {
  assertProductionSourceReady,
  assertSourceOperationPermitted,
} from './timingSourceAdapter.js';

const fixturePath = resolve(
  import.meta.dirname,
  'fixtures/timing/2026-round-99-race.jsonl',
);

const createLocalRecorder = async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'slipstream-recorder-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  return {
    root,
    adapter,
    session,
    rawStore: createRawEventLogStore({ localRoot: root, bucket: null }),
    ledger: createLocalRaceEventLedger({ root }),
    stateStore: createLocalTimingRecorderStateStore({ root }),
  };
};

test('live fixture recorder persists batches, events, checkpoints, and a complete state', async (context) => {
  const recorder = await createLocalRecorder(context);
  const result = await runTimingSessionRecorder({
    ...recorder,
    ownerId: 'recorder-one',
    rawBatchSize: 8,
    flushIntervalMs: 100,
    leaseDurationMs: 5_000,
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.state.status, 'complete');
  assert.equal(result.state.messageCount, 45);
  assert.equal(result.state.batchCount, 6);
  assert.equal(result.state.cursor, 45);
  assert.equal(result.rawBatches.length, 6);
  assert.equal(result.ledgerWrites.inserted, 45);
  assert.equal(result.ledgerWrites.duplicates, 0);
  assert.deepEqual(result.sequenceGaps, []);
  assert.equal(
    (await recorder.ledger.list({
      year: 2026,
      round: 99,
      sessionId: recorder.session.id,
    })).length,
    45,
  );

  const status = buildTimingRecorderReadModel(await recorder.stateStore.list(), {
    generatedAt: '2026-07-27T12:00:00.000Z',
  });
  assert.equal(status.summary.sessions, 1);
  assert.equal(status.summary.statuses.complete, 1);
  assert.equal(status.sessions[0].recorder.messageCount, 45);
  assert.equal(status.sessions[0].recorder.lastBatch.records, 5);
  assert.equal(status.sessions[0].recorder.lastBatch.uri, undefined);

  const replay = await runTimingSessionRecorder({
    ...recorder,
    ownerId: 'recorder-two',
    rawBatchSize: 8,
    flushIntervalMs: 100,
    leaseDurationMs: 5_000,
  });
  assert.equal(replay.status, 'already_complete');
  assert.equal(replay.rawBatches.length, 0);
});

test('failed stream flushes a durable checkpoint and resumes without duplicate events', async (context) => {
  const recorder = await createLocalRecorder(context);
  let forceDisconnect = true;
  const unreliableAdapter = {
    ...recorder.adapter,
    async *streamLive(session, { cursor = 0, signal } = {}) {
      for await (const message of recorder.adapter.replaySession(session, { cursor, signal })) {
        if (forceDisconnect && Number(message.sequence) > 12) {
          throw new Error('forced test disconnect');
        }
        yield message;
      }
    },
  };

  await assert.rejects(
    runTimingSessionRecorder({
      ...recorder,
      adapter: unreliableAdapter,
      ownerId: 'failing-recorder',
      rawBatchSize: 100,
      flushIntervalMs: 100,
      leaseDurationMs: 5_000,
      reconnect: {
        maxAttempts: 1,
        initialDelayMs: 10,
        maximumDelayMs: 10,
      },
    }),
    /forced test disconnect/,
  );
  const failed = await recorder.stateStore.get(
    recorder.adapter.metadata.id,
    recorder.session.id,
  );
  assert.equal(failed.status, 'failed');
  assert.equal(failed.cursor, 12);
  assert.equal(failed.messageCount, 12);

  forceDisconnect = false;
  const resumed = await runTimingSessionRecorder({
    ...recorder,
    adapter: unreliableAdapter,
    ownerId: 'recovery-recorder',
    rawBatchSize: 100,
    flushIntervalMs: 100,
    leaseDurationMs: 5_000,
  });
  assert.equal(resumed.status, 'complete');
  assert.equal(resumed.state.cursor, 45);
  assert.equal(resumed.state.messageCount, 45);
  assert.equal(resumed.ledgerWrites.inserted, 33);
  assert.equal(
    (await recorder.ledger.list({
      year: 2026,
      round: 99,
      sessionId: recorder.session.id,
    })).length,
    45,
  );
});

test('active leases prevent a second recorder from claiming the same session', async () => {
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const stateStore = createMemoryTimingRecorderStateStore();
  await stateStore.register({ session, source: adapter.metadata });
  const first = await stateStore.claim({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId: 'owner-one',
    leaseDurationMs: 5_000,
  });
  const second = await stateStore.claim({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId: 'owner-two',
    leaseDurationMs: 5_000,
  });

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.reason, 'lease_held');
  assert.match(
    new RecorderLeaseUnavailableError(adapter.metadata.id, session.id, second.reason).message,
    /lease_held/,
  );
});

test('dispatch reservations collapse duplicate queue messages before ECS starts', async () => {
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const stateStore = createMemoryTimingRecorderStateStore();
  await stateStore.register({ session, source: adapter.metadata });
  const first = await stateStore.reserveDispatch({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    requestId: 'public-check-1',
    now: '2026-07-27T12:00:00Z',
  });
  const duplicate = await stateStore.reserveDispatch({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    requestId: 'public-check-2',
    now: '2026-07-27T12:00:01Z',
  });

  assert.equal(first.reserved, true);
  assert.equal(first.state.status, 'dispatching');
  assert.equal(duplicate.reserved, false);
  assert.equal(duplicate.reason, 'dispatch_in_progress');

  const claim = await stateStore.claim({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId: 'ecs-recorder',
    leaseDurationMs: 5_000,
    now: '2026-07-27T12:00:02Z',
  });
  assert.equal(claim.acquired, true);
  assert.equal(claim.state.status, 'recording');
  assert.equal(claim.state.dispatchRequestId, undefined);
});

test('authorization status and deployment scope are executable gates', () => {
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const unapproved = {
    ...adapter,
    metadata: {
      ...adapter.metadata,
      authorization: {
        ...adapter.metadata.authorization,
        status: 'pending',
      },
    },
  };

  assert.throws(
    () => assertSourceOperationPermitted(unapproved, 'liveIngestion'),
    /has not been approved/,
  );
  assert.throws(
    () => assertSourceOperationPermitted(adapter, 'liveIngestion', {
      deploymentScope: 'production',
    }),
    /production deployment scope/,
  );
  assert.throws(
    () => assertProductionSourceReady(adapter),
    /production deployment scope/,
  );
});

test('Dynamo recorder state uses conditional registration, leases, and checkpoints', async () => {
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command.input);
      if (command.constructor.name === 'UpdateCommand') {
        return {
          Attributes: {
            status: 'recording',
          },
        };
      }
      return {};
    },
  };
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const stateStore = createDynamoTimingRecorderStateStore({
    documentClient,
    tableName: 'test-table',
  });

  await stateStore.register({ session, source: adapter.metadata });
  await stateStore.claim({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId: 'ecs-task-1',
    leaseDurationMs: 60_000,
    now: '2026-07-27T12:00:00Z',
  });
  await stateStore.checkpoint({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId: 'ecs-task-1',
    leaseDurationMs: 60_000,
    cursor: 10,
    lastSequence: 10,
    messageCount: 10,
    batchCount: 1,
    lastMessageAt: '2026-07-27T12:00:10Z',
    lastBatch: { key: 'raw-events/test.jsonl.gz' },
    health: { status: 'healthy' },
    now: '2026-07-27T12:00:10Z',
  });

  assert.equal(commands[0].ConditionExpression, 'attribute_not_exists(pk) AND attribute_not_exists(sk)');
  assert.match(commands[1].ConditionExpression, /leaseExpiresAt < :now/);
  assert.match(commands[2].ConditionExpression, /leaseOwner = :owner/);
  assert.equal(commands[2].ExpressionAttributeValues[':cursor'], 10);
});
