import assert from 'node:assert/strict';
import test from 'node:test';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  dynamoDocumentClientOptions,
  writeRaceAnalyticsToDynamo,
  writeRacePublicationStatusToDynamo,
  writeSeasonToDynamo,
} from './dynamoSeasonWriter.js';

test('dynamo writer drops undefined values from nested race records', () => {
  const item = {
    pk: 'SEASON#2026',
    sk: 'RACE#01',
    race: {
      race_results: [
        { driver_code: 'AAA', time: undefined, points: 25 },
      ],
    },
  };

  assert.doesNotThrow(() => marshall(item, dynamoDocumentClientOptions.marshallOptions));

  const marshalled = marshall(item, dynamoDocumentClientOptions.marshallOptions);
  assert.equal(marshalled.race.M.race_results.L[0].M.time, undefined);
  assert.equal(marshalled.race.M.race_results.L[0].M.driver_code.S, 'AAA');
});

test('dynamo writer chunks owned laps and stores a public timing materialization', async () => {
  const documentInputs = [];
  const context = {
    tableName: 'f1-test',
    region: 'test-region',
    client: {
      send: async () => ({}),
    },
    documentClient: {
      send: async (command) => {
        documentInputs.push(command.input);
        if (command.input?.KeyConditionExpression) return { Items: [] };
        return {};
      },
    },
  };
  const laps = Array.from({ length: 101 }, (_, index) => ({
    driver: 'AAA',
    lap_number: index + 1,
    lap_time: 90,
  }));

  await writeRaceAnalyticsToDynamo(context, {
    year: 2026,
    round: 1,
    analytics: {
      schema_version: 2,
      calculation_version: 'test',
      session: { event_name: 'Test Grand Prix' },
      summary: {},
      definitions: {},
      circuit_profile: {},
      overtake_events: [],
      story_events: [],
      traffic_segments: [],
      pit_cycle_events: [],
      attrition_events: [],
      disruption_events: [],
      drivers: [],
    },
    validation: { status: 'pass' },
    timing: {
      schema_version: 2,
      materializer_version: 'test',
      source: { id: 'slipstream-owned' },
      session: { session_id: '2026-01-R' },
      capabilities: { lap_timing: true },
      results: [],
      weather: [],
      race_control_messages: [],
      laps,
    },
  });

  const putItems = documentInputs
    .filter((input) => input.RequestItems)
    .flatMap((input) => input.RequestItems['f1-test'])
    .flatMap((request) => request.PutRequest?.Item ?? []);
  const timingMeta = putItems.find((item) => item.sk === 'TIMING#META');
  const timingChunks = putItems.filter((item) => item.sk.startsWith('TIMING#LAPS#'));

  assert.equal(timingMeta.source.id, 'slipstream-owned');
  assert.equal(timingMeta.lapChunks, 2);
  assert.deepEqual(timingChunks.map((item) => item.laps.length), [100, 1]);
});

test('dynamo writer prunes stale season rows after replacement rows are written', async () => {
  const documentInputs = [];
  const context = {
    tableName: 'f1-test',
    region: 'test-region',
    client: {
      send: async () => ({}),
    },
    documentClient: {
      send: async (command) => {
        documentInputs.push(command.input);

        if (command.input?.KeyConditionExpression) {
          return {
            Items: [
              { pk: 'SEASON#2026', sk: 'META' },
              { pk: 'SEASON#2026', sk: 'RACE#01' },
              { pk: 'SEASON#2026', sk: 'RACE#02' },
              { pk: 'SEASON#2026', sk: 'ANALYTICS#ROUND#01' },
            ],
          };
        }

        return {};
      },
    },
  };

  await writeSeasonToDynamo(context, 2026, [
    {
      round: 1,
      grand_prix: 'Test Grand Prix',
      race_results: [{ driver_code: 'AAA', points: 25 }],
    },
  ]);

  const batchWrites = documentInputs.filter((input) => input.RequestItems);
  const firstRequests = batchWrites[0].RequestItems['f1-test'];
  const lastRequests = batchWrites.at(-1).RequestItems['f1-test'];

  assert.equal(firstRequests.every((request) => request.PutRequest), true);
  assert.deepEqual(
    firstRequests.map((request) => request.PutRequest.Item.sk),
    ['META', 'RACE#01'],
  );
  assert.deepEqual(
    lastRequests.map((request) => request.DeleteRequest.Key.sk),
    ['RACE#02'],
  );
});

test('dynamo writer stores publication status outside the replaceable race rows', async () => {
  const documentInputs = [];
  const context = {
    tableName: 'f1-test',
    region: 'test-region',
    client: {
      send: async () => ({}),
    },
    documentClient: {
      send: async (command) => {
        documentInputs.push(command.input);
        return {};
      },
    },
  };

  const result = await writeRacePublicationStatusToDynamo(context, {
    schemaVersion: 1,
    year: 2026,
    round: 10,
    grandPrix: 'Belgian Grand Prix',
    state: 'degraded',
    sourceCoverage: {
      formula1Official: 'ready',
      detailedTiming: 'unavailable',
    },
    missingCapabilities: ['Detailed race timing and derived race story'],
    lastAttemptAt: '2026-07-26T16:00:00.000Z',
  });

  const batchWrite = documentInputs.find((input) => input.RequestItems);
  const item = batchWrite.RequestItems['f1-test'][0].PutRequest.Item;

  assert.equal(item.pk, 'SEASON#2026');
  assert.equal(item.sk, 'STATUS#ROUND#10');
  assert.equal(item.itemType, 'race_publication_status');
  assert.equal(item.state, 'degraded');
  assert.equal(result.state, 'degraded');
});
