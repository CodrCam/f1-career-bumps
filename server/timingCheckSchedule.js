import { createHash } from 'node:crypto';
import { buildIngestionCheckRequest } from './ingestionCheckDispatcher.js';

const safeScheduleName = (value) => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9-_]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48);

const scheduleTimestamp = (value) => new Date(value)
  .toISOString()
  .replace(/\.\d{3}Z$/, '');

const deterministicRequestId = (sourceId, sessionId, checkAt) => createHash('sha256')
  .update(`${sourceId}\n${sessionId}\n${new Date(checkAt).toISOString()}`)
  .digest('hex')
  .slice(0, 32);

export const buildTimingCheckSchedules = ({
  sourceId,
  sessions,
  queueArn,
  schedulerRoleArn,
  scheduleGroupName,
} = {}) => {
  if (!sourceId || !queueArn || !schedulerRoleArn || !scheduleGroupName) {
    throw new Error('Timing check schedules require source, queue, role, and schedule-group identifiers.');
  }
  if (!Array.isArray(sessions) || !sessions.length) {
    throw new Error('Timing check schedules require at least one session.');
  }

  return sessions.map((session) => {
    if (!session?.id || !session.checkAt) {
      throw new Error('Each timing check schedule requires a session id and explicit checkAt timestamp.');
    }
    const checkAt = new Date(session.checkAt).toISOString();
    const requestId = deterministicRequestId(sourceId, session.id, checkAt);
    const suffix = requestId.slice(0, 10);
    const request = buildIngestionCheckRequest({
      sourceId,
      sessionId: session.id,
      requestedBy: 'eventbridge-scheduler',
      reason: 'scheduled_post_session_check',
      requestedAt: checkAt,
      requestId,
    });

    return {
      Name: `${safeScheduleName(`timing-check-${session.id}`)}-${suffix}`,
      GroupName: scheduleGroupName,
      Description: `Check timing availability for ${session.name ?? session.id}`,
      ScheduleExpression: `at(${scheduleTimestamp(checkAt)})`,
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: {
        Mode: 'OFF',
      },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: queueArn,
        RoleArn: schedulerRoleArn,
        Input: JSON.stringify(request),
      },
    };
  });
};
