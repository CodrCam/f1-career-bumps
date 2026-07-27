import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildTimingCheckSchedules } from './timingCheckSchedule.js';

const { values } = parseArgs({
  options: {
    plan: {
      type: 'string',
      short: 'p',
      default: resolve(import.meta.dirname, 'fixtures/timing/session-check-plan.example.json'),
    },
    'queue-arn': {
      type: 'string',
    },
    'role-arn': {
      type: 'string',
    },
    group: {
      type: 'string',
    },
  },
});

const plan = JSON.parse(await readFile(resolve(values.plan), 'utf8'));
const schedules = buildTimingCheckSchedules({
  sourceId: plan.sourceId,
  sessions: plan.sessions,
  queueArn: values['queue-arn'],
  schedulerRoleArn: values['role-arn'],
  scheduleGroupName: values.group,
});

process.stdout.write(`${JSON.stringify(schedules, null, 2)}\n`);
