import assert from 'node:assert/strict';
import test from 'node:test';
import { getCircuitLengthMeters } from '../src/data/circuitLengths.js';
import {
  formatEquivalentGapMeters,
  getEquivalentGapMeters,
  getPaceGapFormation,
} from '../src/utils/paceGapFormation.js';

const rows = (gaps) => gaps.map((gap, index) => ({
  acronym: `D${index + 1}`,
  gap,
}));

test('gap formation always includes the available top three', () => {
  assert.deepEqual(
    getPaceGapFormation(rows([0, 0.8, 2.1]), {
      metric: 'lap',
      treatment: 'best',
    }).map((driver) => driver.acronym),
    ['D1', 'D2', 'D3'],
  );
});

test('gap formation grows to five while adjacent contenders remain close', () => {
  assert.deepEqual(
    getPaceGapFormation(rows([0, 0.31, 0.325, 0.341, 0.62, 0.7]), {
      metric: 'lap',
      treatment: 'best',
    }).map((driver) => driver.acronym),
    ['D1', 'D2', 'D3', 'D4', 'D5'],
  );
});

test('gap formation stops when the next contender is visually detached', () => {
  assert.deepEqual(
    getPaceGapFormation(rows([0, 0.08, 0.1, 0.55, 0.57]), {
      metric: 'lap',
      treatment: 'best',
    }).map((driver) => driver.acronym),
    ['D1', 'D2', 'D3'],
  );
});

test('sector formations use a tighter adjacent-gap cutoff', () => {
  assert.equal(
    getPaceGapFormation(rows([0, 0.04, 0.08, 0.205]), {
      metric: 'sector1',
      treatment: 'best',
    }).length,
    3,
  );
});

test('converts an Austin qualifying gap into a lap-time-equivalent distance', () => {
  const distance = getEquivalentGapMeters({
    gapSeconds: 0.291,
    lapTimeSeconds: 92.510,
    circuitLengthMeters: getCircuitLengthMeters('Austin'),
  });

  assert.ok(distance !== null);
  assert.equal(formatEquivalentGapMeters(distance), '17.3 m');
});

test('circuit lengths normalize accents and known venue aliases', () => {
  assert.equal(getCircuitLengthMeters('São Paulo'), 4309);
  assert.equal(getCircuitLengthMeters('Montréal'), 4361);
  assert.equal(getCircuitLengthMeters('Monte Carlo'), 3337);
});

test('unknown layouts and invalid timing inputs do not invent a distance', () => {
  assert.equal(getCircuitLengthMeters('Circuit unavailable'), null);
  assert.equal(getEquivalentGapMeters({
    gapSeconds: 0.3,
    lapTimeSeconds: 0,
    circuitLengthMeters: 5513,
  }), null);
  assert.equal(getEquivalentGapMeters({
    gapSeconds: -0.1,
    lapTimeSeconds: 92.5,
    circuitLengthMeters: 5513,
  }), null);
});
