import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { defineTimingSourceAdapter } from './timingSourceAdapter.js';

const readFixtureMessages = async (fixturePath) => {
  const messages = [];
  const lines = createInterface({
    input: createReadStream(fixturePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    messages.push(JSON.parse(line));
  }

  return messages;
};

const wait = (milliseconds, signal) => new Promise((resolvePromise, reject) => {
  const timeout = setTimeout(resolvePromise, milliseconds);
  signal?.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(signal.reason ?? new Error('Fixture stream aborted.'));
  }, { once: true });
});

export const createFixtureTimingAdapter = ({
  fixturePath,
  liveDelayMs = 0,
} = {}) => {
  const path = resolve(fixturePath);

  return defineTimingSourceAdapter({
    metadata: {
      id: 'slipstream-fixture',
      displayName: 'Slipstream recorded timing fixture',
      schemaVersion: 1,
      attribution: 'Synthetic timing records authored for Slipstream tests',
      capabilities: [
        'session_information',
        'drivers_and_teams',
        'pit_stops',
        'race_control',
        'final_classification',
      ],
      authorization: {
        status: 'approved',
        basis: 'self_owned',
        reviewedAt: '2026-07-27',
        reviewedBy: 'Cameron Griffin',
        termsUrl: null,
        notes: 'Self-owned synthetic fixture; contains no upstream timing records.',
        deploymentScopes: ['development', 'test'],
        operations: {
          availabilityProbe: true,
          sessionDiscovery: true,
          liveIngestion: true,
          historicalReplay: true,
          rawStorage: true,
          transformation: true,
          publicDisplay: true,
        },
      },
    },

    async probeSessionAvailability(session) {
      const messages = (await readFixtureMessages(path))
        .filter((message) => message.session_id === session.id);
      const classification = messages
        .filter((message) => message.type === 'classification')
        .at(-1);
      const finished = messages.some(
        (message) => (
          message.type === 'session_status'
          && message.payload?.status === 'finished'
        ),
      );

      return {
        checkedAt: new Date().toISOString(),
        available: messages.length > 0,
        sessionStatus: finished ? 'complete' : (messages.length ? 'live' : 'scheduled'),
        classificationStatus: classification?.payload?.status ?? null,
        latestCursor: messages.at(-1)?.cursor ?? messages.at(-1)?.sequence ?? null,
        messageCount: messages.length,
      };
    },

    async discoverSessions({ from, to } = {}) {
      const messages = await readFixtureMessages(path);
      const sessions = new Map();

      messages.forEach((message) => {
        const startedAt = message.session_started_at;
        if (from && Date.parse(startedAt) < Date.parse(from)) return;
        if (to && Date.parse(startedAt) > Date.parse(to)) return;
        sessions.set(message.session_id, {
          id: message.session_id,
          year: Number(message.year),
          round: Number(message.round),
          type: message.session_type,
          name: message.session_name,
          startsAt: startedAt,
          source: 'slipstream-fixture',
        });
      });

      return [...sessions.values()];
    },

    async *replaySession(session, { cursor = 0, signal } = {}) {
      const messages = await readFixtureMessages(path);
      for (const message of messages) {
        if (signal?.aborted) throw signal.reason ?? new Error('Fixture replay aborted.');
        if (message.session_id !== session.id || Number(message.sequence) <= Number(cursor)) {
          continue;
        }
        yield message;
      }
    },

    async *streamLive(session, { cursor = 0, signal } = {}) {
      for await (const message of this.replaySession(session, { cursor, signal })) {
        if (liveDelayMs > 0) await wait(liveDelayMs, signal);
        yield message;
      }
    },

    async getConnectionHealth() {
      try {
        const messages = await readFixtureMessages(path);
        return {
          status: messages.length ? 'healthy' : 'degraded',
          checkedAt: new Date().toISOString(),
          messageCount: messages.length,
          authentication: 'not_required',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          checkedAt: new Date().toISOString(),
          error: error.message,
          authentication: 'not_required',
        };
      }
    },
  });
};
