const statusOrder = ['dispatching', 'recording', 'failed', 'interrupted', 'scheduled', 'complete'];

const countStatuses = (states) => Object.fromEntries(
  statusOrder.map((status) => [
    status,
    states.filter((state) => state.status === status).length,
  ]),
);

const sessionStatus = (state) => ({
  source: {
    id: state.source.id,
    displayName: state.source.displayName,
    attribution: state.source.attribution,
    authorizationStatus: state.source.authorization?.status,
    authorizationBasis: state.source.authorization?.basis,
  },
  session: state.session,
  recorder: {
    status: state.status,
    attempts: state.attempts,
    cursor: state.cursor,
    lastSequence: state.lastSequence,
    messageCount: state.messageCount,
    batchCount: state.batchCount,
    lastMessageAt: state.lastMessageAt,
    lastBatch: state.lastBatch
      ? {
        key: state.lastBatch.key,
        sha256: state.lastBatch.sha256,
        firstSequence: state.lastBatch.firstSequence,
        lastSequence: state.lastBatch.lastSequence,
        records: state.lastBatch.records,
        status: state.lastBatch.status,
      }
      : null,
    health: state.health,
    availability: state.availability ?? null,
    lastError: state.lastError,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    startedAt: state.startedAt ?? null,
    completedAt: state.completedAt ?? null,
  },
});

export const buildTimingRecorderReadModel = (
  states,
  {
    generatedAt = new Date().toISOString(),
  } = {},
) => {
  const sessions = [...states]
    .sort((left, right) => (
      left.session.startsAt.localeCompare(right.session.startsAt)
      || left.session.id.localeCompare(right.session.id)
    ))
    .map(sessionStatus);

  return {
    schemaVersion: 1,
    generatedAt,
    summary: {
      sessions: sessions.length,
      statuses: countStatuses(states),
    },
    sessions,
  };
};
