import { deriveRaceAnalytics } from './raceAnalytics.js';
import {
  buildRacePublicationStatus,
  missingDetailedTimingCapabilities,
} from './racePublicationStatus.js';
import {
  evaluateOwnedTimingReadiness,
  materializeOwnedTimingSnapshot,
} from './ownedTimingMaterializer.js';
import { validateRaceSources } from './sourceValidation.js';

const latestRecorderState = (states, { year, round, sessionType = 'race' }) => (
  states
    .filter((state) => (
      Number(state.session?.year) === Number(year)
      && Number(state.session?.round) === Number(round)
      && String(state.session?.type).toLowerCase() === sessionType
    ))
    .sort((left, right) => (
      String(right.updatedAt ?? right.session?.startsAt)
        .localeCompare(String(left.updatedAt ?? left.session?.startsAt))
    ))[0] ?? null
);

const unavailableCapabilities = [
  'Detailed race timing and derived race story',
];

const deferredPublicationState = ({
  officialRace,
  officialSnapshot,
  readiness,
  now,
}) => buildRacePublicationStatus({
  year: officialRace.year,
  round: officialRace.round,
  grandPrix: officialRace.grand_prix,
  state: readiness.status === 'results_ready' ? 'results_ready' : 'awaiting_timing',
  sourceCoverage: {
    formula1Official: 'ready',
    slipstreamRecorder: readiness.status,
    detailedTiming: 'awaiting',
  },
  missingCapabilities: unavailableCapabilities,
  lastAttemptAt: now,
  nextAttemptAt: readiness.nextCheckAt,
  contentVersion: officialSnapshot?.sha256,
});

export const publishOwnedRaceTiming = async ({
  officialRace,
  officialSnapshot,
  sourceId = 'slipstream-owned',
  stateStore,
  ledger,
  persistStatus = async () => undefined,
  persistAnalytics = async () => undefined,
  storeSnapshot,
  now = new Date().toISOString(),
  retryMs,
} = {}) => {
  if (!officialRace?.year || !officialRace?.round) {
    throw new Error('Owned race publication requires an official race with year and round.');
  }
  if (!stateStore?.list || !ledger?.list) {
    throw new Error('Owned race publication requires recorder state and event-ledger readers.');
  }

  const states = await stateStore.list({ sourceId });
  const recorderState = latestRecorderState(states, {
    year: officialRace.year,
    round: officialRace.round,
  });
  const events = recorderState
    ? await ledger.list({
      year: officialRace.year,
      round: officialRace.round,
      sessionId: recorderState.session.id,
    })
    : [];
  const readiness = evaluateOwnedTimingReadiness({
    recorderState,
    events,
    now,
    retryMs,
  });

  if (!readiness.ready) {
    const status = readiness.expected
      ? deferredPublicationState({
        officialRace,
        officialSnapshot,
        readiness,
        now,
      })
      : buildRacePublicationStatus({
        year: officialRace.year,
        round: officialRace.round,
        grandPrix: officialRace.grand_prix,
        state: 'degraded',
        sourceCoverage: {
          formula1Official: 'ready',
          slipstreamRecorder: readiness.status,
          detailedTiming: 'unavailable',
        },
        missingCapabilities: unavailableCapabilities,
        lastAttemptAt: now,
        nextAttemptAt: readiness.nextCheckAt,
        contentVersion: officialSnapshot?.sha256,
        lastErrorCode: 'OWNED_RECORDER_INCOMPLETE',
        lastErrorSummary: readiness.reason,
      });
    const statusWrite = await persistStatus(status);

    return {
      ok: readiness.expected,
      expected: readiness.expected,
      mode: readiness.status,
      readiness,
      recorderState,
      events: events.length,
      status,
      statusWrite,
    };
  }

  const timing = materializeOwnedTimingSnapshot({ recorderState, events });
  const validation = validateRaceSources(officialRace, timing);
  const analytics = deriveRaceAnalytics(timing);
  const timingSnapshot = await storeSnapshot(timing, {
    year: officialRace.year,
    round: officialRace.round,
    source: 'slipstream-owned-timing',
  });
  const validationSnapshot = await storeSnapshot(validation, {
    year: officialRace.year,
    round: officialRace.round,
    source: 'source-validation',
  });
  const analyticsSnapshot = await storeSnapshot(analytics, {
    year: officialRace.year,
    round: officialRace.round,
    source: 'derived-analytics',
  });
  const hardFailure = validation.status === 'fail';
  const analyticsWrite = hardFailure
    ? undefined
    : await persistAnalytics({
      year: officialRace.year,
      round: officialRace.round,
      analytics,
      validation,
      timing,
      rawSnapshots: {
        official: officialSnapshot,
        ownedTiming: timingSnapshot,
        validation: validationSnapshot,
        analytics: analyticsSnapshot,
        recorderEvidence: {
          sourceId,
          sessionId: recorderState.session.id,
          eventCount: events.length,
          lastBatch: recorderState.lastBatch,
        },
      },
    });
  const status = buildRacePublicationStatus({
    year: officialRace.year,
    round: officialRace.round,
    grandPrix: officialRace.grand_prix,
    state: hardFailure ? 'failed' : 'published',
    sourceCoverage: {
      formula1Official: 'ready',
      slipstreamRecorder: 'ready',
      detailedTiming: 'ready',
      sourceValidation: validation.status,
    },
    missingCapabilities: missingDetailedTimingCapabilities(
      validation.capability_matrix,
    ),
    lastAttemptAt: now,
    publishedAt: hardFailure ? undefined : analytics.calculated_at,
    nextAttemptAt: hardFailure
      ? new Date(Date.parse(now) + (retryMs ?? 6 * 60 * 60 * 1_000)).toISOString()
      : undefined,
    contentVersion: analyticsSnapshot.sha256,
    lastErrorCode: hardFailure ? 'SOURCE_VALIDATION_FAILED' : undefined,
    lastErrorSummary: hardFailure
      ? 'Owned timing did not match the official classification.'
      : undefined,
  });
  const statusWrite = await persistStatus(status);

  return {
    ok: !hardFailure,
    expected: !hardFailure,
    mode: hardFailure ? 'validation_failed' : 'published',
    readiness,
    recorderState,
    events: events.length,
    timing,
    validation,
    analytics,
    snapshots: {
      timing: timingSnapshot,
      validation: validationSnapshot,
      analytics: analyticsSnapshot,
    },
    analyticsWrite,
    status,
    statusWrite,
  };
};
