import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getLatestConstructorStandings,
  getLatestDriverStandings,
} from '../src/utils/constructorRace.js';

test('orders the latest constructor positions for the finishing grid', () => {
  const standings = getLatestConstructorStandings({
    datasets: [
      { label: 'Cadillac', data: [10, 11, 11], points: [0, 1, 2] },
      { label: 'Mercedes', data: [2, 1, 1], points: [18, 51, 77] },
      { label: 'Ferrari', data: [1, 2, 2], points: [25, 43, 68] },
    ],
  });

  assert.deepEqual(
    standings.map(({ teamKey, position }) => ({ teamKey, position })),
    [
      { teamKey: 'mercedes', position: 1 },
      { teamKey: 'ferrari', position: 2 },
      { teamKey: 'cadillac', position: 11 },
    ],
  );
  assert.equal(standings[0].leadOverNext, 9);
  assert.equal(standings[1].gapToLeader, 9);
});

test('orders driver markers by points and keeps their team liveries', () => {
  const standings = getLatestDriverStandings({
    datasets: [
      { label: 'Lewis Hamilton', team: 'Ferrari', data: [25, 43] },
      { label: 'George Russell', team: 'Mercedes', data: [18, 51] },
      { label: 'Sergio Perez', team: 'Cadillac', data: [0, 2] },
    ],
  });

  assert.deepEqual(
    standings.map(({ code, points, teamKey }) => ({ code, points, teamKey })),
    [
      { code: 'RUS', points: 51, teamKey: 'mercedes' },
      { code: 'HAM', points: 43, teamKey: 'ferrari' },
      { code: 'PER', points: 2, teamKey: 'cadillac' },
    ],
  );
  assert.equal(standings[0].championshipPosition, 1);
  assert.equal(standings[1].gapToLeader, 8);
  assert.equal(standings[2].gapToAhead, 41);
});
