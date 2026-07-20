import assert from 'node:assert/strict';
import test from 'node:test';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  dynamoDocumentClientOptions,
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
