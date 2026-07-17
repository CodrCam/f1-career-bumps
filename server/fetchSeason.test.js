import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchSeason } from '../src/utils/fetchSeason.js';

test('fetchSeason retries a transient failure and returns race data', async () => {
  let calls = 0;
  const season = { races: [{ round: 1 }] };

  const result = await fetchSeason({
    url: 'https://example.test/api/seasons/2026',
    attempts: 2,
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        json: async () => season,
      };
    },
  });

  assert.equal(calls, 2);
  assert.deepEqual(result, season);
});

test('fetchSeason rejects a successful response with no races', async () => {
  await assert.rejects(
    fetchSeason({
      url: 'https://example.test/api/seasons/2026',
      attempts: 1,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ races: [] }),
      }),
    }),
    /returned no races/,
  );
});
