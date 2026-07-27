import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicIngestionCheckRequest,
  findPublicTimingSession,
  isPublicTimingCheckLimitReached,
  publicTimingCheckStatus,
  validatePublicTimingCheck,
} from './publicTimingCheck.js';

const state = {
  source: { id: 'licensed-provider' },
  session: {
    id: '2026-01-R',
    year: 2026,
    round: 1,
    type: 'race',
  },
  status: 'scheduled',
  cursor: null,
};

test('public timing requests resolve only registered season, round, and session types', () => {
  assert.deepEqual(validatePublicTimingCheck({
    year: '2026',
    round: '1',
    sessionType: 'RACE',
  }), {
    year: 2026,
    round: 1,
    sessionType: 'race',
  });
  assert.equal(findPublicTimingSession([state], {
    year: 2026,
    round: 1,
    sessionType: 'race',
  }), state);
  assert.throws(
    () => validatePublicTimingCheck({
      year: 2026,
      round: 1,
      sessionType: 'arbitrary',
    }),
    /session type is invalid/,
  );
});

test('public status distinguishes unavailable, provisional, and final timing', () => {
  assert.equal(publicTimingCheckStatus(null).status, 'session_not_registered');
  assert.equal(publicTimingCheckStatus(state).status, 'not_checked');
  assert.equal(publicTimingCheckStatus({
    ...state,
    availability: {
      available: false,
      checkedAt: '2026-03-01T12:00:00Z',
    },
  }).status, 'not_available');
  assert.equal(publicTimingCheckStatus({
    ...state,
    status: 'complete',
    cursor: 45,
    availability: {
      available: true,
      latestCursor: 45,
      classificationStatus: 'provisional',
      checkedAt: '2026-03-01T12:00:00Z',
    },
  }).status, 'provisional');
  assert.equal(publicTimingCheckStatus({
    ...state,
    status: 'complete',
    cursor: 46,
    availability: {
      available: true,
      latestCursor: 46,
      classificationStatus: 'final',
      checkedAt: '2026-03-01T12:00:00Z',
    },
  }).status, 'up_to_date');
});

test('public check requests expose no provider credentials or arbitrary source choice', () => {
  const request = buildPublicIngestionCheckRequest({
    state,
    requestedAt: '2026-03-01T12:00:00Z',
    requestId: 'public-check-1',
  });
  assert.equal(request.sourceId, 'licensed-provider');
  assert.equal(request.sessionId, '2026-01-R');
  assert.equal(request.requestedBy, 'public-site');
  assert.equal(request.reason, 'public_user_check');
});

test('public timing checks enforce a configurable per-session maximum', () => {
  assert.equal(isPublicTimingCheckLimitReached({
    state: { publicCheckCount: 23 },
    maxChecks: 24,
  }), false);
  assert.equal(isPublicTimingCheckLimitReached({
    state: { publicCheckCount: 24 },
    maxChecks: 24,
  }), true);
  assert.throws(
    () => isPublicTimingCheckLimitReached({ state, maxChecks: 0 }),
    /positive integer/,
  );
});
