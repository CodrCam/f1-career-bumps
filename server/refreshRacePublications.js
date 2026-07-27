import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import './loadLocalEnv.js';
import { createDynamoSeasonReader } from './dynamoSeasonReader.js';
import {
  getDynamoContext,
  writeRacePublicationStatusToDynamo,
} from './dynamoSeasonWriter.js';
import { buildFormula1Season } from './formula1SeasonBuilder.js';
import { buildRacePublicationStatus } from './racePublicationStatus.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    'max-rounds': { type: 'string', default: '2' },
    retries: { type: 'string', default: '2' },
    'retry-delay': { type: 'string', default: '30000' },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const maxRounds = Math.max(1, Number(values['max-rounds']) || 2);
if (!Number.isInteger(year)) throw new Error('Year must be a whole number.');

const reader = createDynamoSeasonReader();
const context = getDynamoContext();
const officialSeason = await buildFormula1Season(year);
if (!officialSeason.races.length) {
  throw new Error(`No completed Formula1.com races were found for ${year}.`);
}

const [analytics, publication] = await Promise.all([
  reader.getSeasonAnalytics(year),
  reader.getSeasonPublicationStatus(year),
]);
const analyticsByRound = new Map(
  (analytics?.races ?? []).map((race) => [Number(race.round), race]),
);
const statusByRound = new Map(
  (publication?.races ?? []).map((status) => [Number(status.round), status]),
);

const repairedStatuses = [];
for (const race of officialSeason.races) {
  const existingAnalytics = analyticsByRound.get(Number(race.round));
  if (!existingAnalytics || statusByRound.has(Number(race.round))) continue;
  const status = buildRacePublicationStatus({
    year,
    round: race.round,
    grandPrix: race.grand_prix,
    state: 'published',
    sourceCoverage: {
      formula1Official: 'ready',
      detailedTiming: 'ready',
      legacyAnalytics: 'ready',
    },
    publishedAt: existingAnalytics.updatedAt,
    lastAttemptAt: existingAnalytics.updatedAt,
    contentVersion: `analytics-${year}-${race.round}-${existingAnalytics.updatedAt}`,
  });
  repairedStatuses.push(await writeRacePublicationStatusToDynamo(context, status));
}

const missing = officialSeason.races
  .filter((race) => !analyticsByRound.has(Number(race.round)))
  .slice(-maxRounds);

const runRound = (round) => new Promise((resolvePromise) => {
  const child = spawn(
    process.execPath,
    [
      resolve(import.meta.dirname, 'updateRacePipeline.js'),
      '--year',
      String(year),
      '--round',
      String(round),
      '--retries',
      String(values.retries),
      '--retry-delay',
      String(values['retry-delay']),
    ],
    {
      env: process.env,
      stdio: 'inherit',
    },
  );
  child.on('exit', (code) => resolvePromise(code ?? 1));
});

const attempted = [];
for (const race of missing) {
  const exitCode = await runRound(race.round);
  attempted.push({
    round: race.round,
    grandPrix: race.grand_prix,
    exitCode,
  });
}

const failed = attempted.filter((race) => race.exitCode !== 0);
console.log(JSON.stringify({
  ok: failed.length === 0,
  year,
  completedRounds: officialSeason.races.length,
  analyticsBeforeRefresh: analyticsByRound.size,
  repairedStatuses,
  attempted,
  deferredMissingRounds: officialSeason.races
    .filter((race) => (
      !analyticsByRound.has(Number(race.round))
      && !missing.some((attempt) => attempt.round === race.round)
    ))
    .map((race) => race.round),
}, null, 2));

if (failed.length) process.exitCode = 1;
