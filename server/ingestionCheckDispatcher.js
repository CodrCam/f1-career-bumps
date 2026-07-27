import { randomUUID } from 'node:crypto';
import {
  assertSourceOperationPermitted,
} from './timingSourceAdapter.js';

export const INGESTION_CHECK_REQUEST_VERSION = 1;

const retryDelaysSeconds = [120, 300, 600, 900, 1_800, 3_600];

const nextRetry = (attempt, now) => {
  const delaySeconds = retryDelaysSeconds[
    Math.min(Math.max(Number(attempt ?? 1) - 1, 0), retryDelaysSeconds.length - 1)
  ];
  return {
    delaySeconds,
    nextCheckAt: new Date(Date.parse(now) + delaySeconds * 1_000).toISOString(),
  };
};

export const buildIngestionCheckRequest = ({
  sourceId,
  sessionId,
  requestedBy,
  reason = 'manual',
  requestedAt = new Date().toISOString(),
  attempt = 1,
  requestId = randomUUID(),
} = {}) => {
  if (!sourceId || !sessionId || !requestedBy) {
    throw new Error('Ingestion checks require source, session, and requester identifiers.');
  }
  return {
    schemaVersion: INGESTION_CHECK_REQUEST_VERSION,
    requestId: String(requestId),
    sourceId: String(sourceId),
    sessionId: String(sessionId),
    requestedBy: String(requestedBy),
    reason: String(reason),
    requestedAt: new Date(requestedAt).toISOString(),
    attempt: Number(attempt),
  };
};

export const processIngestionCheck = async ({
  request,
  adapter,
  stateStore,
  launch,
  deploymentScope = 'development',
  now = new Date().toISOString(),
} = {}) => {
  if (!request || !adapter || !stateStore || typeof launch !== 'function') {
    throw new Error('Ingestion check processing requires a request, adapter, state store, and launcher.');
  }
  if (request.sourceId !== adapter.metadata.id) {
    throw new Error(
      `Ingestion request source "${request.sourceId}" does not match adapter "${adapter.metadata.id}".`,
    );
  }
  assertSourceOperationPermitted(adapter, 'availabilityProbe', { deploymentScope });
  assertSourceOperationPermitted(adapter, 'sessionDiscovery', { deploymentScope });

  const sessions = await adapter.discoverSessions();
  const session = sessions.find((candidate) => candidate.id === request.sessionId);
  if (!session) {
    return {
      status: 'rejected',
      reason: 'session_not_discovered',
      request,
    };
  }

  await stateStore.register({
    session,
    source: adapter.metadata,
  });
  const [availability, recorderState] = await Promise.all([
    adapter.probeSessionAvailability(session),
    stateStore.get(adapter.metadata.id, session.id),
  ]);
  await stateStore.recordProbe({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    availability,
    requestId: request.requestId,
    now,
  });
  const retry = nextRetry(request.attempt, now);

  if (!availability.available) {
    return {
      status: 'retry',
      reason: 'source_not_available',
      request,
      session,
      availability,
      ...retry,
    };
  }
  if (recorderState?.status === 'recording') {
    return {
      status: 'no_action',
      reason: 'recorder_already_running',
      request,
      session,
      availability,
      recorderState,
    };
  }

  const latestCursor = Number(availability.latestCursor);
  const recordedCursor = Number(recorderState?.cursor);
  const hasNewSourceRecords = (
    Number.isFinite(latestCursor)
    && (!Number.isFinite(recordedCursor) || latestCursor > recordedCursor)
  );
  if (recorderState?.status === 'complete' && !hasNewSourceRecords) {
    if (String(availability.classificationStatus).toLowerCase() === 'final') {
      return {
        status: 'no_action',
        reason: 'final_classification_up_to_date',
        request,
        session,
        availability,
        recorderState,
      };
    }
    return {
      status: 'retry',
      reason: 'provisional_classification_unchanged',
      request,
      session,
      availability,
      recorderState,
      ...retry,
    };
  }

  const streamMode = availability.sessionStatus === 'complete'
    ? 'historical'
    : 'live';
  const reservation = await stateStore.reserveDispatch({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    requestId: request.requestId,
    now,
  });
  if (!reservation.reserved) {
    return {
      status: 'no_action',
      reason: reservation.reason,
      request,
      session,
      availability,
      recorderState: reservation.state,
    };
  }
  const launchResult = await launch({
    request,
    session,
    availability,
    streamMode,
    refreshCompleted: recorderState?.status === 'complete',
  });
  return {
    status: 'launched',
    reason: hasNewSourceRecords ? 'new_source_records' : 'source_available',
    request,
    session,
    availability,
    streamMode,
    launchResult,
  };
};
