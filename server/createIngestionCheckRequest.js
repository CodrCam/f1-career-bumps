import { parseArgs } from 'node:util';
import { buildIngestionCheckRequest } from './ingestionCheckDispatcher.js';

const { values } = parseArgs({
  options: {
    source: {
      type: 'string',
      short: 's',
    },
    session: {
      type: 'string',
    },
    requester: {
      type: 'string',
      default: 'manual-operator',
    },
    reason: {
      type: 'string',
      default: 'manual_check',
    },
    attempt: {
      type: 'string',
      default: '1',
    },
  },
});

const request = buildIngestionCheckRequest({
  sourceId: values.source,
  sessionId: values.session,
  requestedBy: values.requester,
  reason: values.reason,
  attempt: Number(values.attempt),
});

process.stdout.write(`${JSON.stringify(request)}\n`);
