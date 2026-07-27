import {
  buildIngestionCheckRequest,
} from './ingestionCheckDispatcher.js';

export const PUBLIC_TIMING_CHECK_SESSION_TYPES = Object.freeze([
  'qualifying',
  'sprint_qualifying',
  'sprint_shootout',
  'sprint',
  'race',
]);

export const validatePublicTimingCheck = ({
  year,
  round,
  sessionType,
} = {}) => {
  const normalizedYear = Number(year);
  const normalizedRound = Number(round);
  const normalizedType = String(sessionType ?? '').toLowerCase();
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2025 || normalizedYear > 2100) {
    throw new Error('Timing check year is invalid.');
  }
  if (!Number.isInteger(normalizedRound) || normalizedRound < 1 || normalizedRound > 30) {
    throw new Error('Timing check round is invalid.');
  }
  if (!PUBLIC_TIMING_CHECK_SESSION_TYPES.includes(normalizedType)) {
    throw new Error('Timing check session type is invalid.');
  }
  return {
    year: normalizedYear,
    round: normalizedRound,
    sessionType: normalizedType,
  };
};

export const findPublicTimingSession = (states, input) => {
  const query = validatePublicTimingCheck(input);
  return states.find((state) => (
    Number(state.session.year) === query.year
    && Number(state.session.round) === query.round
    && String(state.session.type).toLowerCase() === query.sessionType
  )) ?? null;
};

export const isPublicTimingCheckLimitReached = ({
  state,
  maxChecks,
} = {}) => {
  const normalizedMaximum = Number(maxChecks);
  if (!Number.isInteger(normalizedMaximum) || normalizedMaximum < 1) {
    throw new Error('Public timing check maximum must be a positive integer.');
  }
  return Number(state?.publicCheckCount ?? 0) >= normalizedMaximum;
};

export const publicTimingCheckStatus = (state) => {
  if (!state) {
    return {
      status: 'session_not_registered',
      message: 'This timing session has not been registered for checking yet.',
    };
  }
  if (state.status === 'dispatching' || state.status === 'recording') {
    return {
      status: 'processing',
      message: 'Timing data is available and ingestion is in progress.',
      checkedAt: state.availability?.checkedAt ?? null,
    };
  }
  const availability = state.availability;
  if (!availability) {
    return {
      status: 'not_checked',
      message: 'No timing availability check has completed for this session yet.',
    };
  }
  if (!availability.available) {
    return {
      status: 'not_available',
      message: 'Timing data is not available from our configured source yet.',
      checkedAt: availability.checkedAt,
    };
  }

  const sourceCursor = Number(availability.latestCursor);
  const recordedCursor = Number(state.cursor);
  const isCurrent = (
    state.status === 'complete'
    && Number.isFinite(sourceCursor)
    && Number.isFinite(recordedCursor)
    && recordedCursor >= sourceCursor
  );
  if (isCurrent && String(availability.classificationStatus).toLowerCase() === 'final') {
    return {
      status: 'up_to_date',
      message: 'The final timing classification is already up to date.',
      checkedAt: availability.checkedAt,
    };
  }
  if (isCurrent) {
    return {
      status: 'provisional',
      message: 'The available timing is ingested and still marked provisional.',
      checkedAt: availability.checkedAt,
    };
  }
  return {
    status: 'available',
    message: 'Timing data is available and queued for ingestion.',
    checkedAt: availability.checkedAt,
  };
};

export const buildPublicIngestionCheckRequest = ({
  state,
  requestedAt,
  requestId,
} = {}) => {
  if (!state?.source?.id || !state?.session?.id) {
    throw new Error('A registered timing session is required to request a public check.');
  }
  return buildIngestionCheckRequest({
    sourceId: state.source.id,
    sessionId: state.session.id,
    requestedBy: 'public-site',
    reason: 'public_user_check',
    requestedAt,
    requestId,
  });
};
