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
    source: { type: 'string' },
    // Accepted while old manual commands are being retired.
    retries: { type: 'string' },
    'retry-delay': { type: 'string' },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const maxRounds = Math.max(1, Number(values['max-rounds']) || 2);
const now = new Date();
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

const isRetryDue = (race) => {
  const status = statusByRound.get(Number(race.round));
  if (!status?.nextAttemptAt) return true;
  const due = Date.parse(status.nextAttemptAt);
  return !Number.isFinite(due) || due <= now.getTime();
};

const unpublished = officialSeason.races.filter(
  (race) => !analyticsByRound.has(Number(race.round)),
);
const eligible = unpublished.filter(isRetryDue).slice(-maxRounds);
const deferredByBackoff = unpublished
  .filter((race) => !isRetryDue(race))
  .map((race) => ({
    round: race.round,
    grandPrix: race.grand_prix,
    state: statusByRound.get(Number(race.round))?.state,
    nextAttemptAt: statusByRound.get(Number(race.round))?.nextAttemptAt,
  }));

const runRound = (round) => new Promise((resolvePromise) => {
  const args = [
    resolve(import.meta.dirname, 'updateRacePipeline.js'),
    '--year',
    String(year),
    '--round',
    String(round),
  ];
  if (values.source) args.push('--source', values.source);

  const child = spawn(process.execPath, args, {
    env: process.env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => resolvePromise(code ?? 1));
});

const attempted = [];
for (const race of eligible) {
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
  deferredByBackoff,
  deferredByBatchLimit: unpublished
    .filter((race) => (
      isRetryDue(race)
      && !eligible.some((attempt) => attempt.round === race.round)
    ))
    .map((race) => race.round),
}, null, 2));

if (failed.length) process.exitCode = 1;
