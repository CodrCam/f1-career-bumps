import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import {
  getDriverMarkConfig,
  getSeasonDriverMarks,
} from '../src/data/driverIdentities.js';
import { getDriverBrandLogo } from '../src/data/driverBrandLogos.js';

test('provides a complete 22-driver identity set for 2026', () => {
  const drivers = getSeasonDriverMarks(2026);

  assert.equal(drivers.length, 22);
  assert.equal(
    drivers.filter(({ path }) => !/\.(png|webp)$/.test(path)).length,
    0,
  );
  assert.equal(getDriverMarkConfig('Max Verstappen', 2026).file, 'max-verstappen.png');
  assert.equal(getDriverMarkConfig('Isack Hadjar', 2026).file, 'isack-hadjar.png');
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

test('ships personal brand marks for the 2026 grid with one intentional fallback', () => {
  const drivers = getSeasonDriverMarks(2026);
  const brandLogos = drivers
    .map(({ label }) => ({ label, path: getDriverBrandLogo(label) }))
    .filter(({ path }) => path);

  assert.equal(brandLogos.length, 21);
  assert.equal(getDriverBrandLogo('Arvid Lindblad'), null);
  assert.equal(
    getDriverBrandLogo('Charles Leclerc'),
    'driver-logos/charles-leclerc-mark.png',
  );
  assert.deepEqual(
    brandLogos.filter(({ path }) => !existsSync(new URL(`../public/${path}`, import.meta.url))),
    [],
  );
});
