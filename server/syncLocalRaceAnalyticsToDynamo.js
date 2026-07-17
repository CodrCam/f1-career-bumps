import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import './loadLocalEnv.js';
import { hasLocalAwsCredentials, printLocalCredentialHelp } from './awsLocalCredentials.js';
import {
  getDynamoContext,
  writeRaceAnalyticsToDynamo,
} from './dynamoSeasonWriter.js';

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

if (
  !Number.isInteger(year)
  || !Number.isInteger(fromRound)
  || !Number.isInteger(toRound)
  || fromRound < 1
  || toRound < fromRound
) {
  throw new Error('Year, from, and to values must be valid whole numbers.');
}

if (!hasLocalAwsCredentials()) {
  printLocalCredentialHelp();
  process.exit(1);
}

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

const context = getDynamoContext();
const synced = [];
const skipped = [];

for (let round = fromRound; round <= toRound; round += 1) {
  const [analytics, validation] = await Promise.all([
    readSnapshot(round, 'derived-analytics'),
    readSnapshot(round, 'source-validation'),
  ]);

  if (!analytics || !validation) {
    skipped.push({ round, reason: 'missing_local_snapshots' });
    continue;
  }

  if (validation.status === 'fail') {
    skipped.push({ round, reason: 'source_validation_failed' });
    continue;
  }

  const result = await writeRaceAnalyticsToDynamo(context, {
    year,
    round,
    analytics,
    validation,
  });

  synced.push({
    round,
    validation: validation.status,
    drivers: result.drivers,
    items: result.items,
  });
}

console.log(JSON.stringify({
  ok: skipped.every((item) => item.reason === 'missing_local_snapshots'),
  table: context.tableName,
  region: context.region,
  year,
  synced,
  skipped,
}, null, 2));
