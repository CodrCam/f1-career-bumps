import assert from 'node:assert/strict';
import test from 'node:test';
import { marshall } from '@aws-sdk/util-dynamodb';
import { dynamoDocumentClientOptions } from './dynamoSeasonWriter.js';

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
