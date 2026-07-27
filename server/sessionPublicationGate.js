export const SESSION_PUBLICATION_GATE_VERSION = 1;

const materializedSessionTypes = new Set([
  'qualifying',
  'sprint_qualifying',
  'sprint_shootout',
  'sprint',
  'race',
]);

const latestByTimestamp = (events) => [...events].sort((left, right) => (
  right.timestamp.localeCompare(left.timestamp)
  || right.eventId.localeCompare(left.eventId)
))[0];

const addMilliseconds = (timestamp, milliseconds) => (
  new Date(Date.parse(timestamp) + milliseconds).toISOString()
);

export const evaluateSessionPublication = ({
  recorderState,
  events = [],
  now = new Date().toISOString(),
  provisionalRetryMs = 10 * 60 * 1_000,
} = {}) => {
  if (!recorderState?.session?.id) {
    throw new Error('Session publication evaluation requires recorder state.');
  }
  const sessionEvents = events.filter(
    (event) => event.sessionId === recorderState.session.id,
  );
  const sessionFinished = Boolean(
    latestByTimestamp(sessionEvents.filter((event) => event.eventType === 'race_finish')),
  );
  const classifications = sessionEvents.filter(
    (event) => event.eventType === 'classification',
  );
  const classification = latestByTimestamp(classifications);
  const classificationStatus = String(
    classification?.observed?.status ?? 'unavailable',
  ).toLowerCase();
  const entries = Array.isArray(classification?.observed?.entries)
    ? classification.observed.entries
    : [];
  const sessionType = String(recorderState.session.type).toLowerCase();
  const shouldMaterialize = materializedSessionTypes.has(sessionType);

  let status = 'waiting_for_recorder';
  let reason = 'Recorder has not completed the session.';
  let publishable = false;
  let authority = null;

  if (recorderState.status === 'failed' || recorderState.status === 'interrupted') {
    status = 'recorder_incomplete';
    reason = `Recorder ended in ${recorderState.status} state.`;
  } else if (recorderState.status === 'complete' && !sessionFinished) {
    status = 'waiting_for_session_finish';
    reason = 'Recorder completed without a session-finish event.';
  } else if (recorderState.status === 'complete' && (!classification || !entries.length)) {
    status = 'waiting_for_classification';
    reason = 'Session finished, but no non-empty classification is available.';
  } else if (recorderState.status === 'complete' && !shouldMaterialize) {
    status = 'recorded_no_driver_update';
    reason = `${sessionType} sessions are recorded but do not update driver result models.`;
  } else if (recorderState.status === 'complete' && classificationStatus === 'final') {
    status = 'ready_final';
    reason = 'A final classification is available.';
    publishable = true;
    authority = 'final';
  } else if (recorderState.status === 'complete') {
    status = 'ready_provisional';
    reason = 'A provisional classification is available; later corrections remain possible.';
    publishable = true;
    authority = 'provisional';
  }

  return {
    schemaVersion: SESSION_PUBLICATION_GATE_VERSION,
    sessionId: recorderState.session.id,
    sessionType,
    evaluatedAt: new Date(now).toISOString(),
    status,
    reason,
    publishable,
    authority,
    action: publishable
      ? `materialize_${sessionType}_${authority}`
      : 'wait',
    classification: classification
      ? {
        eventId: classification.eventId,
        timestamp: classification.timestamp,
        status: classificationStatus,
        entries: entries.length,
        revisionsObserved: classifications.length,
      }
      : null,
    nextCheckAt: status === 'ready_final' || status === 'recorded_no_driver_update'
      ? null
      : addMilliseconds(now, provisionalRetryMs),
  };
};
