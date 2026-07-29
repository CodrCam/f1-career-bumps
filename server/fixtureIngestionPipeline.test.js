import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createFixtureTimingAdapter } from './fixtureTimingAdapter.js';
import { runRecordedTimingPipeline } from './fixtureIngestionPipeline.js';
import {
  createRawEventLogStore,
  readLocalRawEventBatch,
} from './rawEventLogStore.js';
import {
  buildRaceEvent,
  createDynamoRaceEventLedger,
  createMemoryRaceEventLedger,
} from './raceEventLedger.js';
import { assertSourceOperationPermitted } from './timingSourceAdapter.js';
import { materializePitStops } from './timingEventNormalizer.js';

const fixturePath = resolve(
  import.meta.dirname,
  'fixtures/timing/2026-round-99-race.jsonl',
);

test('fixture adapter exposes the complete source contract and explicit authorization', async () => {
  const adapter = createFixtureTimingAdapter({ fixturePath });
  const sessions = await adapter.discoverSessions();
  const health = await adapter.getConnectionHealth();

  assert.equal(adapter.contractVersion, 2);
  assert.equal(adapter.metadata.authorization.status, 'approved');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, '2026-99-R');
  assert.equal(health.status, 'healthy');
  assert.equal(health.messageCount, 45);
  assert.doesNotThrow(() => assertSourceOperationPermitted(adapter, 'historicalReplay'));

  const blockedAdapter = {
    ...adapter,
    metadata: {
      ...adapter.metadata,
      authorization: {
        ...adapter.metadata.authorization,
        operations: {
          ...adapter.metadata.authorization.operations,
          liveIngestion: false,
        },
      },
    },
  };
  assert.throws(
    () => assertSourceOperationPermitted(blockedAdapter, 'liveIngestion'),
    /not authorized/,
  );
});

test('recorded fixture flows through append-only raw storage, normalization, ledger, and pit analysis', async (context) => {
  const localRoot = await mkdtemp(join(tmpdir(), 'slipstream-raw-events-'));
  context.after(() => rm(localRoot, { recursive: true, force: true }));

  const adapter = createFixtureTimingAdapter({ fixturePath });
  const [session] = await adapter.discoverSessions();
  const rawStore = createRawEventLogStore({ localRoot, bucket: null });
  const ledger = createMemoryRaceEventLedger();
  const first = await runRecordedTimingPipeline({
    adapter,
    rawStore,
    ledger,
    session,
  });

  assert.equal(first.messages, 45);
  assert.equal(first.rawBatches.length, 1);
  assert.equal(first.rawBatches[0].status, 'stored');
  assert.equal(first.ledgerWrites.normalized.inserted, 45);
  assert.equal(first.pitStops.length, 10);
  assert.equal(first.anomalyEvents.length, 4);
  assert.deepEqual(
    first.anomalyEvents.map((event) => [
      event.observed.driver,
      event.derived.anomaly_type,
      event.interpretation.status,
    ]),
    [
      ['HAM', 'high_service_normal_transit', 'unexplained'],
      ['ANT', 'normal_service_high_transit', 'unexplained'],
      ['ALO', 'high_service_high_transit', 'unexplained'],
      ['ALB', 'neutralized_quick_stop', 'confirmed'],
    ],
  );
  assert.match(
    first.anomalyEvents.find((event) => event.observed.driver === 'HAM').interpretation.summary,
    /does not establish the cause/i,
  );
  assert.match(
    first.anomalyEvents.find((event) => event.observed.driver === 'ALB').interpretation.summary,
    /does not establish a mechanical or strategic cause/i,
  );

  const rawMessages = await readLocalRawEventBatch(rawStore, first.rawBatches[0].key);
  assert.equal(rawMessages.length, 45);
  assert.equal(rawMessages[0].id, 'fixture-session-start');
  assert.equal(rawMessages.at(-1).id, 'fixture-session-finish');

  const second = await runRecordedTimingPipeline({
    adapter,
    rawStore,
    ledger,
    session,
  });
  assert.equal(second.rawBatches[0].status, 'existing');
  assert.equal(second.ledgerWrites.normalized.duplicates, 45);
  assert.equal(second.ledgerWrites.anomalies.duplicates, 4);
  assert.deepEqual(
    second.anomalyEvents.map((event) => event.eventId),
    first.anomalyEvents.map((event) => event.eventId),
  );
  assert.equal((await ledger.list()).length, 49);
});

test('DynamoDB ledger uses an isolated append-only partition and conditional writes', async () => {
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command.input);
      return {};
    },
  };
  const ledger = createDynamoRaceEventLedger({
    documentClient,
    tableName: 'test-table',
  });
  const event = buildRaceEvent({
    year: 2026,
    round: 1,
    sessionId: '2026-01-R',
    eventType: 'race_start',
    timestamp: '2026-03-01T12:00:00Z',
    source: 'test-fixture',
    sourceSchemaVersion: 1,
    sourceEventId: 'start',
    processingVersion: 'test-1',
  });

  const result = await ledger.put(event);

  assert.equal(result.status, 'inserted');
  assert.equal(commands[0].TableName, 'test-table');
  assert.equal(commands[0].Item.pk, 'RACE_EVENTS#2026#01');
  assert.match(commands[0].Item.sk, /race_start/);
  assert.equal(
    commands[0].ConditionExpression,
    'attribute_not_exists(pk) AND attribute_not_exists(sk)',
  );
});

test('DynamoDB ledger reads one owned session across paginated event pages', async () => {
  const commands = [];
  const pages = [
    {
      Items: [{
        pk: 'RACE_EVENTS#2026#01',
        sk: '2026-03-01T12:00:00.000Z#race_start#one',
        itemType: 'race_event',
        eventId: 'one',
        sessionId: '2026-01-R',
        timestamp: '2026-03-01T12:00:00.000Z',
      }],
      LastEvaluatedKey: { pk: 'cursor', sk: 'cursor' },
    },
    {
      Items: [{
        pk: 'RACE_EVENTS#2026#01',
        sk: '2026-03-01T13:30:00.000Z#race_finish#two',
        itemType: 'race_event',
        eventId: 'two',
        sessionId: '2026-01-R',
        timestamp: '2026-03-01T13:30:00.000Z',
      }],
    },
  ];
  const ledger = createDynamoRaceEventLedger({
    documentClient: {
      async send(command) {
        commands.push(command.input);
        return pages.shift();
      },
    },
    tableName: 'test-table',
  });

  const events = await ledger.list({
    year: 2026,
    round: 1,
    sessionId: '2026-01-R',
  });

  assert.deepEqual(events.map(({ eventId }) => eventId), ['one', 'two']);
  assert.equal(commands.length, 2);
  assert.equal(commands[0].ExpressionAttributeValues[':pk'], 'RACE_EVENTS#2026#01');
  assert.equal(commands[0].ExpressionAttributeValues[':sessionId'], '2026-01-R');
  assert.deepEqual(commands[1].ExclusiveStartKey, { pk: 'cursor', sk: 'cursor' });
  assert.equal('pk' in events[0], false);
});

test('partial pit evidence remains replayable without inventing a complete stop', () => {
  const serviceOnly = buildRaceEvent({
    year: 2026,
    round: 1,
    sessionId: '2026-01-R',
    eventType: 'pit_service',
    timestamp: '2026-03-01T12:10:10Z',
    source: 'test-fixture',
    sourceSchemaVersion: 1,
    sourceEventId: 'partial-service',
    observed: {
      sequence: 1,
      driver: 'NOR',
      driver_name: 'Lando Norris',
      team: 'McLaren',
      lap: 20,
      stop_number: 1,
      service_seconds: 2.4,
    },
    processingVersion: 'test-1',
  });

  const [stop] = materializePitStops([serviceOnly]);

  assert.equal(stop.serviceTime, 2.4);
  assert.equal(stop.pitLaneTime, null);
  assert.equal(stop.transitTime, null);
  assert.equal(stop.hasBreakdown, false);
});
