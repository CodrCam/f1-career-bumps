import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { storeJsonSnapshot } from './rawDataStore.js';
import { deriveRaceAnalytics } from './raceAnalytics.js';
import { validateRaceSources } from './sourceValidation.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    from: { type: 'string', default: '1' },
    to: { type: 'string', default: '30' },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const fromRound = Number(values.from);
const toRound = Number(values.to);
const projectRoot = resolve(import.meta.dirname, '..');
const roots = [
  resolve(projectRoot, '.data/raw'),
  resolve(projectRoot, '.data/raw/raw'),
];

const readSnapshot = async (round, source) => {
  for (const root of roots) {
    try {
      const path = resolve(
        root,
        String(year),
        `round-${String(round).padStart(2, '0')}`,
        source,
        'latest.json.gz',
      );
      const compressed = await readFile(path);
      return JSON.parse(gunzipSync(compressed).toString('utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
};

const rebuilt = [];

for (let round = fromRound; round <= toRound; round += 1) {
  const [official, timing] = await Promise.all([
    readSnapshot(round, 'formula1-com'),
    readSnapshot(round, 'fastf1-timing'),
  ]);
  if (!official || !timing) continue;

  const validation = validateRaceSources({ ...official, year }, timing);
  const analytics = deriveRaceAnalytics(timing);

  await storeJsonSnapshot(validation, {
    year,
    round,
    source: 'source-validation',
  });
  await storeJsonSnapshot(analytics, {
    year,
    round,
    source: 'derived-analytics',
  });

  rebuilt.push({ round, validation: validation.status });
}

console.log(JSON.stringify({
  ok: true,
  year,
  rebuilt,
}, null, 2));

