import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  getDriverMarkConfig,
  getSeasonDriverMarks,
} from '../src/data/driverIdentities.js';

test('provides a complete 22-driver identity set for 2026', () => {
  const drivers = getSeasonDriverMarks(2026);

  assert.equal(drivers.length, 22);
  assert.equal(drivers.filter(({ path }) => !path.endsWith('.webp')).length, 0);
});

test('keeps championship numbers season-specific', () => {
  assert.equal(getDriverMarkConfig('Lando Norris', 2025).number, 4);
  assert.equal(getDriverMarkConfig('Lando Norris', 2026).number, 1);
  assert.equal(getDriverMarkConfig('Max Verstappen', 2025).number, 1);
  assert.equal(getDriverMarkConfig('Max Verstappen', 2026).number, 3);
});

test('resolves common driver name variants', () => {
  assert.equal(getDriverMarkConfig('Alex Albon', 2026).label, 'Alexander Albon');
  assert.equal(getDriverMarkConfig('Nico Hülkenberg', 2026).label, 'Nico Hulkenberg');
  assert.equal(getDriverMarkConfig('Sergio Pérez', 2026).label, 'Sergio Perez');
});

test('ships every configured driver mark with the site', () => {
  const marks = [
    ...getSeasonDriverMarks(2025),
    ...getSeasonDriverMarks(2026),
  ];

  assert.deepEqual(
    marks.filter(({ path }) => !existsSync(new URL(`../public/${path}`, import.meta.url))),
    [],
  );
});
