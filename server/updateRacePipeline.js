import { parseArgs } from 'node:util';
import './loadLocalEnv.js';
import { hasLocalAwsCredentials } from './awsLocalCredentials.js';
import {
  collectDhlPitStopSeason,
  mergeDhlPitStopsIntoSeason,
} from './dhlPitStopCollector.js';
import {
  getDynamoContext,
  writeRacePublicationStatusToDynamo,
  writeRaceAnalyticsToDynamo,
  writeSeasonToDynamo,
} from './dynamoSeasonWriter.js';
import { createDynamoSeasonReader } from './dynamoSeasonReader.js';
import { collectFastF1Snapshot } from './fastF1Timing.js';
import {
  buildFormula1Race,
  buildFormula1Season,
} from './formula1SeasonBuilder.js';
import { storeJsonSnapshot } from './rawDataStore.js';
import { deriveRaceAnalytics } from './raceAnalytics.js';
import {
  auditRacePublication,
  buildRacePublicationStatus,
  missingDetailedTimingCapabilities,
} from './racePublicationStatus.js';
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
const nextRetryAt = (hours = 6) => (
  new Date(Date.now() + (hours * 60 * 60 * 1000)).toISOString()
);

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

let dhlSeason;
try {
  dhlSeason = await collectDhlPitStopSeason(year, {
    completedRounds: season?.races.length ?? requestedRound ?? officialRace.round,
  });

  if (season) {
    season = mergeDhlPitStopsIntoSeason(season, dhlSeason);
    officialRace = season.races.find((race) => race.round === requestedRound)
      ?? season.races.at(-1);
  } else {
    officialRace = mergeDhlPitStopsIntoSeason(
      { races: [officialRace] },
      dhlSeason,
    ).races[0];
  }
} catch (error) {
  console.warn(`DHL pit-stop collection skipped: ${error.message}`);
}

const targetRound = officialRace.round;
const formula1OfficialRace = { ...officialRace };
delete formula1OfficialRace.dhl_pit_stops;
delete formula1OfficialRace.pit_stop_sources;
const officialSnapshot = await storeJsonSnapshot(formula1OfficialRace, {
  year,
  round: targetRound,
  source: 'formula1-com',
});
const dhlRace = dhlSeason?.races.find((race) => race.round === targetRound);
const dhlSnapshot = dhlRace
  ? await storeJsonSnapshot(dhlRace, {
    year,
    round: targetRound,
    source: 'dhl-fastest-pit-stop',
  })
  : null;

let seasonWrite;
const dynamoContext = canWriteDynamo ? getDynamoContext() : null;
if (canWriteDynamo) {
  seasonWrite = await writeSeasonToDynamo(dynamoContext, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    inventory: season.inventory,
    formula1UpdatedAt: season.updatedAt,
    dhlPitStopUpdatedAt: season.dhlPitStopUpdatedAt,
  });
}

const sourceCoverage = {
  formula1Official: 'ready',
  dhlPitService: dhlSnapshot ? 'ready' : 'unavailable',
  detailedTiming: 'awaiting',
};
const persistPublicationStatus = async (status) => (
  dynamoContext
    ? writeRacePublicationStatusToDynamo(dynamoContext, status)
    : undefined
);
const getPublicationAudit = async (currentStatus) => {
  if (!canWriteDynamo || !season) return undefined;

  const reader = createDynamoSeasonReader();
  const [seasonAnalytics, seasonStatuses] = await Promise.all([
    reader.getSeasonAnalytics(year),
    reader.getSeasonPublicationStatus(year),
  ]);
  const statuses = [
    ...(seasonStatuses?.races ?? []).filter((status) => status.round !== currentStatus.round),
    currentStatus,
  ];

  return auditRacePublication({
    completedRaces: season.races,
    analyticsRaces: seasonAnalytics?.races,
    publicationStatuses: statuses,
  });
};

if (values['official-only']) {
  const publicationStatus = buildRacePublicationStatus({
    year,
    round: targetRound,
    grandPrix: officialRace.grand_prix,
    state: 'results_ready',
    sourceCoverage: {
      ...sourceCoverage,
      detailedTiming: 'not_requested',
    },
    missingCapabilities: ['Detailed race timing and derived race story'],
    contentVersion: officialSnapshot.sha256,
  });
  const publicationStatusWrite = await persistPublicationStatus(publicationStatus);
  const publicationAudit = await getPublicationAudit(publicationStatus);

  console.log(JSON.stringify({
    ok: true,
    mode: 'official-only',
    year,
    round: targetRound,
    grandPrix: officialRace.grand_prix,
    sessions: officialRace.source_manifest,
    officialSnapshot,
    seasonWrite,
    publicationStatus,
    publicationStatusWrite,
    publicationAudit,
  }, null, 2));
  process.exit(0);
}

const awaitingTimingStatus = buildRacePublicationStatus({
  year,
  round: targetRound,
  grandPrix: officialRace.grand_prix,
  state: 'awaiting_timing',
  sourceCoverage,
  missingCapabilities: ['Detailed race timing and derived race story'],
  contentVersion: officialSnapshot.sha256,
});
await persistPublicationStatus(awaitingTimingStatus);

let timing;
try {
  timing = await withRetries(
    () => collectFastF1Snapshot({
      year,
      round: targetRound,
      session: values.session,
      includeTelemetry: values.telemetry,
    }),
    { attempts: retryCount, delayMs: retryDelayMs },
  );
} catch (error) {
  const publicationStatus = buildRacePublicationStatus({
    year,
    round: targetRound,
    grandPrix: officialRace.grand_prix,
    state: 'degraded',
    sourceCoverage: {
      ...sourceCoverage,
      detailedTiming: 'unavailable',
      fastF1: 'failed',
    },
    missingCapabilities: ['Detailed race timing and derived race story'],
    nextAttemptAt: nextRetryAt(),
    contentVersion: officialSnapshot.sha256,
    lastErrorCode: 'DETAILED_TIMING_UNAVAILABLE',
    lastErrorSummary: String(error.message).slice(0, 500),
  });
  const publicationStatusWrite = await persistPublicationStatus(publicationStatus);
  const publicationAudit = await getPublicationAudit(publicationStatus);

  console.warn(`FastF1 timing collection failed: ${error.message}`);
  console.log(JSON.stringify({
    ok: false,
    mode: 'degraded',
    year,
    round: targetRound,
    grandPrix: officialRace.grand_prix,
    reason: 'FastF1 timing data was unavailable; Formula1.com season data was updated.',
    storage: {
      official: officialSnapshot,
      dhl: dhlSnapshot,
    },
    seasonWrite,
    publicationStatus,
    publicationStatusWrite,
    publicationAudit,
  }, null, 2));
  process.exit(3);
}

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
    dynamoContext,
    {
      year,
      round: targetRound,
      analytics,
      validation,
      rawSnapshots: {
        official: officialSnapshot,
        dhl: dhlSnapshot,
        timing: timingSnapshot,
        validation: validationSnapshot,
        analytics: analyticsSnapshot,
      },
    },
  );
}

const publicationStatus = buildRacePublicationStatus({
  year,
  round: targetRound,
  grandPrix: officialRace.grand_prix,
  state: validation.status === 'fail' ? 'failed' : 'published',
  sourceCoverage: {
    ...sourceCoverage,
    detailedTiming: 'ready',
    fastF1: 'ready',
    sourceValidation: validation.status,
  },
  missingCapabilities: missingDetailedTimingCapabilities(validation.capability_matrix),
  publishedAt: validation.status === 'fail' ? undefined : analytics.calculated_at,
  contentVersion: analyticsSnapshot.sha256,
  lastErrorCode: validation.status === 'fail' ? 'SOURCE_VALIDATION_FAILED' : undefined,
  lastErrorSummary: validation.status === 'fail'
    ? 'Detailed timing did not pass source validation.'
    : undefined,
});
const publicationStatusWrite = await persistPublicationStatus(publicationStatus);
const publicationAudit = await getPublicationAudit(publicationStatus);

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
    dhl: dhlSnapshot,
    timing: timingSnapshot,
    validation: validationSnapshot,
    analytics: analyticsSnapshot,
  },
  seasonWrite,
  analyticsWrite,
  publicationStatus,
  publicationStatusWrite,
  publicationAudit,
}, null, 2));

if (validation.status === 'fail') process.exitCode = 2;
