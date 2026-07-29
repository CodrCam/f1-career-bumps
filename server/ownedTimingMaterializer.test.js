import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeRaceEvents,
  evaluateOwnedTimingReadiness,
  materializeOwnedTimingSnapshot,
} from './ownedTimingMaterializer.js';

const state = {
  source: {
    id: 'slipstream-owned',
    displayName: 'Slipstream owned recorder',
  },
  session: {
    id: '2026-01-R',
    year: 2026,
    round: 1,
    type: 'race',
    name: 'Australian Grand Prix',
    startsAt: '2026-03-08T04:00:00.000Z',
    endsAt: '2026-03-08T06:00:00.000Z',
  },
  status: 'complete',
};

const event = (eventType, timestamp, observed, eventId = `${eventType}-${timestamp}`) => ({
  eventId,
  year: 2026,
  round: 1,
  sessionId: state.session.id,
  eventType,
  timestamp,
  source: 'slipstream-owned',
  observed,
});

const completeEvents = [
  event('race_start', '2026-03-08T04:00:00.000Z', {}),
  event('driver_registered', '2026-03-08T04:00:01.000Z', {
    driver: 'NOR',
    driver_name: 'Lando Norris',
    driver_number: '4',
    team: 'McLaren',
  }),
  event('lap_timing', '2026-03-08T04:02:00.000Z', {
    driver: 'NOR',
    lap: 1,
    lap_time_seconds: 91.4,
    position: 1,
    track_status: '1',
  }),
  event('sector_timing', '2026-03-08T04:02:01.000Z', {
    driver: 'NOR',
    lap: 1,
    sector1_time_seconds: 30.1,
  }),
  event('lap_timing', '2026-03-08T04:03:30.000Z', {
    driver: 'NOR',
    lap: 2,
    lap_time_seconds: null,
    sector1_time_seconds: 30.1,
    position: 1,
  }),
  event('pit_entry', '2026-03-08T04:02:05.000Z', {
    driver: 'NOR',
    lap: 1,
  }),
  event('pit_exit', '2026-03-08T04:02:25.000Z', {
    driver: 'NOR',
    lap: 1,
  }),
  event('classification', '2026-03-08T05:35:00.000Z', {
    status: 'final',
    entries: [{
      position: 1,
      driver: 'NOR',
      grid_position: 2,
      status: 'Finished',
      points: 25,
    }],
  }),
  event('race_finish', '2026-03-08T05:36:00.000Z', {}),
];

test('owned timing materializer creates the analytics snapshot without coercing nulls to zero', () => {
  const snapshot = materializeOwnedTimingSnapshot({
    recorderState: state,
    events: completeEvents,
  });

  assert.equal(snapshot.source.id, 'slipstream-owned');
  assert.equal(snapshot.results[0].abbreviation, 'NOR');
  assert.equal(snapshot.results[0].team_name, 'McLaren');
  assert.equal(snapshot.laps[0].lap_time, 91.4);
  assert.equal(snapshot.laps[0].is_accurate, true);
  assert.equal(snapshot.laps[0].pit_in_time, 125);
  assert.equal(snapshot.laps[1].lap_time, null);
  assert.equal(snapshot.laps[1].pit_out_time, 145);
  assert.equal(snapshot.capabilities.lap_timing, true);
  assert.equal(snapshot.capabilities.pit_markers, true);
});

test('owned timing readiness defers expected partial sessions instead of failing', () => {
  const withoutLaps = completeEvents.filter((item) => item.eventType !== 'lap_timing');
  const readiness = evaluateOwnedTimingReadiness({
    recorderState: state,
    events: withoutLaps,
    now: '2026-03-08T06:00:00.000Z',
  });

  assert.equal(readiness.status, 'results_ready');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.expected, true);
  assert.equal(readiness.nextCheckAt, '2026-03-08T06:15:00.000Z');
});

test('superseded corrections are excluded from materialization', () => {
  const original = event('lap_timing', '2026-03-08T04:02:00.000Z', {
    driver: 'NOR',
    lap: 1,
    lap_time_seconds: 99,
  }, 'original-lap');
  const correction = {
    ...event('lap_timing', '2026-03-08T04:02:01.000Z', {
      driver: 'NOR',
      lap: 1,
      lap_time_seconds: 91.4,
    }, 'corrected-lap'),
    supersedesEventId: original.eventId,
  };

  assert.deepEqual(
    activeRaceEvents([original, correction]).map((item) => item.eventId),
    ['corrected-lap'],
  );
});
