import { randomUUID } from 'node:crypto';
import { storeRawEventBatch } from './rawEventLogStore.js';
import {
  assertSourceOperationPermitted,
  streamWithReconnect,
} from './timingSourceAdapter.js';
import { normalizeTimingMessage } from './timingEventNormalizer.js';

export class RecorderLeaseUnavailableError extends Error {
  constructor(sourceId, sessionId, reason) {
    super(`Recorder session "${sourceId}/${sessionId}" cannot be claimed: ${reason}.`);
    this.name = 'RecorderLeaseUnavailableError';
    this.reason = reason;
  }
}

const summarizeWrites = (writes) => ({
  inserted: writes.filter((write) => write.status === 'inserted').length,
  duplicates: writes.filter((write) => write.status === 'duplicate').length,
});

const nextOrInterval = (pendingNext, intervalMs, signal) => new Promise((resolve, reject) => {
  let settled = false;
  const finish = (callback, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
    callback(value);
  };
  const timeout = setTimeout(
    () => finish(resolve, { kind: 'interval' }),
    intervalMs,
  );
  const onAbort = () => finish(
    reject,
    signal.reason ?? new Error('Timing recorder aborted.'),
  );

  signal?.addEventListener('abort', onAbort, { once: true });
  pendingNext.then(
    (result) => finish(resolve, { kind: 'next', result }),
    (error) => finish(reject, error),
  );
});

const validateRecorderMessage = (message, session) => {
  if (!message?.id) throw new Error('Timing messages require a source event id.');
  if (message.session_id !== session.id) {
    throw new Error(`Timing event "${message.id}" is not part of session "${session.id}".`);
  }
  const sequence = Number(message.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`Timing event "${message.id}" requires a positive whole-number sequence.`);
  }
  return sequence;
};

const safeHealth = async (adapter) => {
  try {
    return await adapter.getConnectionHealth();
  } catch (error) {
    return {
      status: 'unhealthy',
      checkedAt: new Date().toISOString(),
      error: error.message,
    };
  }
};

export const runTimingSessionRecorder = async ({
  adapter,
  session,
  rawStore,
  ledger,
  stateStore,
  ownerId = randomUUID(),
  deploymentScope = 'development',
  streamMode = 'live',
  refreshCompleted = false,
  rawBatchSize = 100,
  flushIntervalMs = 5_000,
  leaseDurationMs = 60_000,
  reconnect = {},
  signal,
} = {}) => {
  if (!adapter || !session || !rawStore || !ledger || !stateStore) {
    throw new Error('Timing recorder requires an adapter, session, raw store, ledger, and state store.');
  }
  if (!Number.isInteger(rawBatchSize) || rawBatchSize < 1) {
    throw new Error('Timing recorder raw batch size must be a positive whole number.');
  }
  if (!Number.isFinite(flushIntervalMs) || flushIntervalMs < 10) {
    throw new Error('Timing recorder flush interval must be at least 10ms.');
  }
  if (!Number.isFinite(leaseDurationMs) || leaseDurationMs < Math.max(1_000, flushIntervalMs * 2)) {
    throw new Error('Timing recorder lease duration must be at least 1000ms and twice the flush interval.');
  }
  if (!['live', 'historical'].includes(streamMode)) {
    throw new Error(`Unknown timing recorder stream mode: ${streamMode}.`);
  }

  [
    streamMode === 'live' ? 'liveIngestion' : 'historicalReplay',
    'rawStorage',
    'transformation',
  ].forEach((operation) => {
    assertSourceOperationPermitted(adapter, operation, { deploymentScope });
  });

  await stateStore.register({
    session,
    source: adapter.metadata,
  });
  const claim = await stateStore.claim({
    sourceId: adapter.metadata.id,
    sessionId: session.id,
    ownerId,
    leaseDurationMs,
    allowCompleted: refreshCompleted,
  });
  if (!claim.acquired) {
    if (claim.reason === 'already_complete') {
      return {
        status: 'already_complete',
        ownerId,
        state: claim.state,
        rawBatches: [],
        ledgerWrites: { inserted: 0, duplicates: 0 },
      };
    }
    throw new RecorderLeaseUnavailableError(
      adapter.metadata.id,
      session.id,
      claim.reason,
    );
  }

  let state = claim.state;
  let buffer = [];
  let acceptedSequence = Number(state.lastSequence ?? 0);
  let messageCount = Number(state.messageCount ?? 0);
  let batchCount = Number(state.batchCount ?? 0);
  let cursor = state.cursor ?? undefined;
  let health = await safeHealth(adapter);
  const rawBatches = [];
  const ledgerWrites = { inserted: 0, duplicates: 0 };
  const sequenceGaps = [];

  const checkpoint = async ({
    lastBatch = state.lastBatch,
    lastMessageAt = state.lastMessageAt,
  } = {}) => {
    state = await stateStore.checkpoint({
      sourceId: adapter.metadata.id,
      sessionId: session.id,
      ownerId,
      leaseDurationMs,
      cursor: cursor ?? null,
      lastSequence: acceptedSequence,
      messageCount,
      batchCount,
      lastMessageAt,
      lastBatch,
      health,
    });
  };

  const flush = async () => {
    if (!buffer.length) {
      health = await safeHealth(adapter);
      await checkpoint();
      return;
    }

    const messages = buffer;
    buffer = [];
    const rawBatch = await storeRawEventBatch(rawStore, messages, {
      session,
      source: adapter.metadata.id,
      sourceSchemaVersion: adapter.metadata.schemaVersion,
    });
    const events = messages.map((message) => normalizeTimingMessage(message, {
      source: adapter.metadata.id,
      sourceSchemaVersion: adapter.metadata.schemaVersion,
      rawBatch,
    }));
    const writes = summarizeWrites(await ledger.putMany(events));
    ledgerWrites.inserted += writes.inserted;
    ledgerWrites.duplicates += writes.duplicates;
    rawBatches.push(rawBatch);
    messageCount += messages.length;
    batchCount += 1;
    cursor = messages.at(-1).cursor ?? messages.at(-1).sequence;
    acceptedSequence = Number(messages.at(-1).sequence);
    health = await safeHealth(adapter);
    await checkpoint({
      lastMessageAt: new Date(
        messages.at(-1).occurred_at ?? messages.at(-1).timestamp,
      ).toISOString(),
      lastBatch: {
        key: rawBatch.key,
        uri: rawBatch.uri,
        sha256: rawBatch.sha256,
        firstSequence: rawBatch.firstSequence,
        lastSequence: rawBatch.lastSequence,
        records: rawBatch.records,
        status: rawBatch.status,
      },
    });
  };

  const stream = streamMode === 'live'
    ? streamWithReconnect(adapter, session, {
      ...reconnect,
      deploymentScope,
      cursor,
      signal,
    })
    : adapter.replaySession(session, {
      cursor,
      signal,
    });
  const iterator = stream[Symbol.asyncIterator]();
  let pendingNext;

  try {
    while (true) {
      pendingNext ??= iterator.next();
      const outcome = await nextOrInterval(pendingNext, flushIntervalMs, signal);
      if (outcome.kind === 'interval') {
        await flush();
        continue;
      }

      pendingNext = null;
      if (outcome.result.done) break;
      const message = outcome.result.value;
      const sequence = validateRecorderMessage(message, session);
      if (sequence <= acceptedSequence) continue;
      if (acceptedSequence > 0 && sequence > acceptedSequence + 1) {
        sequenceGaps.push({
          after: acceptedSequence,
          before: sequence,
        });
      }
      acceptedSequence = sequence;
      buffer.push(message);
      if (buffer.length >= rawBatchSize) await flush();
    }

    await flush();
    health = await safeHealth(adapter);
    state = await stateStore.finish({
      sourceId: adapter.metadata.id,
      sessionId: session.id,
      ownerId,
      status: 'complete',
      health,
    });
    return {
      status: 'complete',
      ownerId,
      state,
      rawBatches,
      ledgerWrites,
      sequenceGaps,
    };
  } catch (error) {
    let finalError = error;
    try {
      await flush();
    } catch (flushError) {
      finalError = new globalThis.AggregateError(
        [error, flushError],
        'Timing stream and final batch flush both failed.',
      );
    }

    health = await safeHealth(adapter);
    try {
      state = await stateStore.finish({
        sourceId: adapter.metadata.id,
        sessionId: session.id,
        ownerId,
        status: signal?.aborted ? 'interrupted' : 'failed',
        error: finalError,
        health,
      });
    } catch (finishError) {
      finalError = new globalThis.AggregateError(
        [finalError, finishError],
        'Timing recorder failed and could not persist its final state.',
      );
    }
    throw finalError;
  } finally {
    await iterator.return?.();
  }
};
