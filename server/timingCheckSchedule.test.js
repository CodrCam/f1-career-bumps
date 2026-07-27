import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimingCheckSchedules } from './timingCheckSchedule.js';

test('builds one-time scheduler payloads that enqueue idempotent post-session checks', () => {
  const [schedule] = buildTimingCheckSchedules({
    sourceId: 'licensed-provider',
    sessions: [{
      id: '2026-01-Q',
      name: 'Example Grand Prix Qualifying',
      checkAt: '2026-03-07T15:10:00.000Z',
    }],
    queueArn: 'arn:aws:sqs:us-west-2:123456789012:timing-check',
    schedulerRoleArn: 'arn:aws:iam::123456789012:role/timing-scheduler',
    scheduleGroupName: 'slipstream-timing-shadow',
  });
  const request = JSON.parse(schedule.Target.Input);

  assert.match(schedule.Name, /^timing-check-2026-01-q-/);
  assert.equal(schedule.ScheduleExpression, 'at(2026-03-07T15:10:00)');
  assert.equal(schedule.ScheduleExpressionTimezone, 'UTC');
  assert.equal(schedule.ActionAfterCompletion, 'DELETE');
  assert.equal(schedule.Target.Arn, 'arn:aws:sqs:us-west-2:123456789012:timing-check');
  assert.equal(request.sourceId, 'licensed-provider');
  assert.equal(request.sessionId, '2026-01-Q');
  assert.equal(request.reason, 'scheduled_post_session_check');

  const [sameSchedule] = buildTimingCheckSchedules({
    sourceId: 'licensed-provider',
    sessions: [{
      id: '2026-01-Q',
      checkAt: '2026-03-07T15:10:00.000Z',
    }],
    queueArn: 'arn:aws:sqs:us-west-2:123456789012:timing-check',
    schedulerRoleArn: 'arn:aws:iam::123456789012:role/timing-scheduler',
    scheduleGroupName: 'slipstream-timing-shadow',
  });
  assert.equal(sameSchedule.Name, schedule.Name);
  assert.equal(
    JSON.parse(sameSchedule.Target.Input).requestId,
    request.requestId,
  );
});

test('requires an explicit check time instead of guessing publication latency', () => {
  assert.throws(
    () => buildTimingCheckSchedules({
      sourceId: 'licensed-provider',
      sessions: [{ id: '2026-01-R' }],
      queueArn: 'queue',
      schedulerRoleArn: 'role',
      scheduleGroupName: 'group',
    }),
    /explicit checkAt/,
  );
});
