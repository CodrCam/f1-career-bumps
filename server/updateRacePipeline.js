import { parseArgs } from 'node:util';
import './loadLocalEnv.js';
import { hasLocalAwsCredentials } from './awsLocalCredentials.js';
import {
  getDynamoContext,
  writeRaceAnalyticsToDynamo,
  writeRacePublicationStatusToDynamo,
  writeSeasonToDynamo,
} from './dynamoSeasonWriter.js';
import { createDynamoSeasonReader } from './dynamoSeasonReader.js';
import {
  buildFormula1Race,
  buildFormula1Season,
} from './formula1SeasonBuilder.js';
import { createDynamoRaceEventLedger, createLocalRaceEventLedger } from './raceEventLedger.js';
import {
  auditRacePublication,
  buildRacePublicationStatus,
} from './racePublicationStatus.js';
import { storeJsonSnapshot } from './rawDataStore.js';
import { publishOwnedRaceTiming } from './ownedRacePublication.js';
import {
  createDynamoTimingRecorderStateStore,
  createLocalTimingRecorderStateStore,
} from './timingRecorderStateStore.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    round: { type: 'string', short: 'r' },
    source: { type: 'string' },
    'official-only': { type: 'boolean', default: false },
    'no-dynamo': { type: 'boolean', default: false },
    // Accepted temporarily so older manual commands do not break during cutover.
    retries: { type: 'string' },
    'retry-delay': { type: 'string' },
    telemetry: { type: 'boolean', default: false },
    session: { type: 'string' },
  },
});

const year = Number(values.year ?? new Date().getFullYear());
const requestedRound = values.round ? Number(values.round) : null;
const sourceId = values.source
  ?? process.env.TIMING_SOURCE_ID
  ?? 'slipstream-owned';
const canWriteDynamo = !values['no-dynamo'] && hasLocalAwsCredentials();

if (!Number.isInteger(year) || (requestedRound !== null && !Number.isInteger(requestedRound))) {
  throw new Error('Year and round must be whole numbers.');
}

let season;
let officialRace;
if (requestedRound !== null && !canWriteDynamo) {
  officialRace = {
    ...await buildFormula1Race(year, requestedRound),
    year,
  };
} else {
  season = await buildFormula1Season(year);
  if (!season.races.length) {
    throw new Error(`No completed Formula1.com races were found for ${year}.`);
  }
  officialRace = requestedRound === null
    ? season.races.at(-1)
    : season.races.find((race) => Number(race.round) === requestedRound);
  if (!officialRace) {
    throw new Error(`Completed round ${requestedRound} was not found for ${year}.`);
  }
  officialRace = { ...officialRace, year };
}

const officialSnapshot = await storeJsonSnapshot(officialRace, {
  year,
  round: officialRace.round,
  source: 'formula1-com',
});
const context = canWriteDynamo ? getDynamoContext() : null;
const seasonWrite = context && season
  ? await writeSeasonToDynamo(context, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    inventory: season.inventory,
    formula1UpdatedAt: season.updatedAt,
  })
  : undefined;
const persistStatus = (status) => (
  context
    ? writeRacePublicationStatusToDynamo(context, status)
    : undefined
);

const getPublicationAudit = async (currentStatus) => {
  if (!context || !season) return undefined;
  const reader = createDynamoSeasonReader();
  const [seasonAnalytics, seasonStatuses] = await Promise.all([
    reader.getSeasonAnalytics(year),
    reader.getSeasonPublicationStatus(year),
  ]);
  return auditRacePublication({
    completedRaces: season.races,
    analyticsRaces: seasonAnalytics?.races,
    publicationStatuses: [
      ...(seasonStatuses?.races ?? [])
        .filter((status) => status.round !== currentStatus.round),
      currentStatus,
    ],
  });
};

if (values['official-only']) {
  const publicationStatus = buildRacePublicationStatus({
    year,
    round: officialRace.round,
    grandPrix: officialRace.grand_prix,
    state: 'results_ready',
    sourceCoverage: {
      formula1Official: 'ready',
      slipstreamRecorder: 'not_requested',
      detailedTiming: 'not_requested',
    },
    missingCapabilities: ['Detailed race timing and derived race story'],
    contentVersion: officialSnapshot.sha256,
  });
  const publicationStatusWrite = await persistStatus(publicationStatus);
  const publicationAudit = await getPublicationAudit(publicationStatus);

  console.log(JSON.stringify({
    ok: true,
    mode: 'official-only',
    year,
    round: officialRace.round,
    grandPrix: officialRace.grand_prix,
    officialSnapshot,
    seasonWrite,
    publicationStatus,
    publicationStatusWrite,
    publicationAudit,
  }, null, 2));
  process.exit(0);
}

const stateStore = context
  ? createDynamoTimingRecorderStateStore({
    documentClient: context.documentClient,
    tableName: context.tableName,
  })
  : createLocalTimingRecorderStateStore();
const ledger = context
  ? createDynamoRaceEventLedger({
    documentClient: context.documentClient,
    tableName: context.tableName,
  })
  : createLocalRaceEventLedger();

const publication = await publishOwnedRaceTiming({
  officialRace,
  officialSnapshot,
  sourceId,
  stateStore,
  ledger,
  persistStatus,
  persistAnalytics: (data) => (
    context ? writeRaceAnalyticsToDynamo(context, data) : undefined
  ),
  storeSnapshot: storeJsonSnapshot,
});
const publicationAudit = await getPublicationAudit(publication.status);

console.log(JSON.stringify({
  ok: publication.ok,
  expected: publication.expected,
  mode: publication.mode,
  year,
  round: officialRace.round,
  grandPrix: officialRace.grand_prix,
  timingSource: sourceId,
  readiness: publication.readiness,
  eventCount: publication.events,
  validation: publication.validation
    ? {
      status: publication.validation.status,
      checks: publication.validation.checks.map((check) => ({
        id: check.id,
        status: check.status,
        blocking: check.blocking,
        differences: check.differences?.length ?? 0,
      })),
      capabilityMatrix: publication.validation.capability_matrix,
    }
    : undefined,
  analytics: publication.analytics?.summary,
  storage: {
    official: officialSnapshot,
    ...publication.snapshots,
  },
  seasonWrite,
  analyticsWrite: publication.analyticsWrite,
  publicationStatus: publication.status,
  publicationStatusWrite: publication.statusWrite,
  publicationAudit,
}, null, 2));

if (!publication.ok && !publication.expected) process.exitCode = 2;
