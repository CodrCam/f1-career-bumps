import { parseArgs } from 'node:util';
import './loadLocalEnv.js';
import { hasLocalAwsCredentials } from './awsLocalCredentials.js';
import {
  getDynamoContext,
  writeRaceAnalyticsToDynamo,
  writeSeasonToDynamo,
} from './dynamoSeasonWriter.js';
import { collectFastF1Snapshot } from './fastF1Timing.js';
import {
  buildFormula1Race,
  buildFormula1Season,
} from './formula1SeasonBuilder.js';
import { storeJsonSnapshot } from './rawDataStore.js';
import { deriveRaceAnalytics } from './raceAnalytics.js';
import { validateRaceSources } from './sourceValidation.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    round: { type: 'string', short: 'r' },
    session: { type: 'string', short: 's', default: 'R' },
    retries: { type: 'string', default: '3' },
    'retry-delay': { type: 'string', default: '30000' },
    'official-only': { type: 'boolean', default: false },
    telemetry: { type: 'boolean', default: false },
    'no-dynamo': { type: 'boolean', default: false },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const requestedRound = values.round ? Number(values.round) : null;
const retryCount = Math.max(1, Number(values.retries) || 1);
const retryDelayMs = Math.max(0, Number(values['retry-delay']) || 0);
const canWriteDynamo = !values['no-dynamo'] && hasLocalAwsCredentials();

if (!Number.isInteger(year) || (requestedRound !== null && !Number.isInteger(requestedRound))) {
  throw new Error('Year and round must be whole numbers.');
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const withRetries = async (task, { attempts, delayMs }) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts && delayMs > 0) await wait(delayMs);
    }
  }

  throw lastError;
};

let season;
let officialRace;

if (requestedRound !== null && !canWriteDynamo) {
  officialRace = await buildFormula1Race(year, requestedRound);
} else {
  season = await buildFormula1Season(year);
  if (season.races.length === 0) {
    throw new Error(`No completed Formula1.com races were found for ${year}.`);
  }

  officialRace = requestedRound === null
    ? season.races.at(-1)
    : season.races.find((race) => race.round === requestedRound);

  if (!officialRace) {
    throw new Error(`Completed round ${requestedRound} was not found for ${year}.`);
  }
}

const targetRound = officialRace.round;
const officialSnapshot = await storeJsonSnapshot(officialRace, {
  year,
  round: targetRound,
  source: 'formula1-com',
});

let seasonWrite;
if (canWriteDynamo) {
  const context = getDynamoContext();
  seasonWrite = await writeSeasonToDynamo(context, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    inventory: season.inventory,
    formula1UpdatedAt: season.updatedAt,
  });
}

if (values['official-only']) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'official-only',
    year,
    round: targetRound,
    grandPrix: officialRace.grand_prix,
    sessions: officialRace.source_manifest,
    officialSnapshot,
    seasonWrite,
  }, null, 2));
  process.exit(0);
}

const timing = await withRetries(
  () => collectFastF1Snapshot({
    year,
    round: targetRound,
    session: values.session,
    includeTelemetry: values.telemetry,
  }),
  { attempts: retryCount, delayMs: retryDelayMs },
);

const validation = validateRaceSources({ ...officialRace, year }, timing);
const analytics = deriveRaceAnalytics(timing);
const timingSnapshot = await storeJsonSnapshot(timing, {
  year,
  round: targetRound,
  source: 'fastf1-timing',
});
const validationSnapshot = await storeJsonSnapshot(validation, {
  year,
  round: targetRound,
  source: 'source-validation',
});
const analyticsSnapshot = await storeJsonSnapshot(analytics, {
  year,
  round: targetRound,
  source: 'derived-analytics',
});

let analyticsWrite;
if (canWriteDynamo && validation.status !== 'fail') {
  analyticsWrite = await writeRaceAnalyticsToDynamo(
    getDynamoContext(),
    {
      year,
      round: targetRound,
      analytics,
      validation,
      rawSnapshots: {
        official: officialSnapshot,
        timing: timingSnapshot,
        validation: validationSnapshot,
        analytics: analyticsSnapshot,
      },
    },
  );
}

console.log(JSON.stringify({
  ok: validation.status !== 'fail',
  year,
  round: targetRound,
  grandPrix: officialRace.grand_prix,
  validation: {
    status: validation.status,
    checks: validation.checks.map((check) => ({
      id: check.id,
      status: check.status,
      differences: check.differences?.length ?? 0,
    })),
    capabilityMatrix: validation.capability_matrix,
  },
  analytics: analytics.summary,
  storage: {
    official: officialSnapshot,
    timing: timingSnapshot,
    validation: validationSnapshot,
    analytics: analyticsSnapshot,
  },
  seasonWrite,
  analyticsWrite,
}, null, 2));

if (validation.status === 'fail') process.exitCode = 2;
