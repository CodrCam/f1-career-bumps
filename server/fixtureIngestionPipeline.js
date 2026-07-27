import { assertSourceOperationPermitted } from './timingSourceAdapter.js';
import { storeRawEventBatch } from './rawEventLogStore.js';
import { analyzePitStopRecords } from '../src/utils/pitStopAnomalies.js';
import {
  buildPitAnomalyEvents,
  materializePitStops,
  normalizeTimingMessage,
} from './timingEventNormalizer.js';

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const summarizeWrites = (writes) => ({
  inserted: writes.filter((write) => write.status === 'inserted').length,
  duplicates: writes.filter((write) => write.status === 'duplicate').length,
});

export const runRecordedTimingPipeline = async ({
  adapter,
  rawStore,
  ledger,
  session,
  rawBatchSize = 100,
} = {}) => {
  assertSourceOperationPermitted(adapter, 'historicalReplay');
  assertSourceOperationPermitted(adapter, 'rawStorage');
  assertSourceOperationPermitted(adapter, 'transformation');

  const messages = [];
  for await (const message of adapter.replaySession(session)) messages.push(message);
  if (!messages.length) throw new Error(`Fixture session "${session.id}" has no messages.`);

  const rawBatches = [];
  const rawBatchBySourceEvent = new Map();
  for (const messagesInBatch of chunk(messages, rawBatchSize)) {
    const rawBatch = await storeRawEventBatch(rawStore, messagesInBatch, {
      session,
      source: adapter.metadata.id,
      sourceSchemaVersion: adapter.metadata.schemaVersion,
    });
    rawBatches.push(rawBatch);
    messagesInBatch.forEach((message) => rawBatchBySourceEvent.set(message.id, rawBatch));
  }

  const normalizedEvents = messages.map((message) => normalizeTimingMessage(message, {
    source: adapter.metadata.id,
    sourceSchemaVersion: adapter.metadata.schemaVersion,
    rawBatch: rawBatchBySourceEvent.get(message.id),
  }));
  const normalizedWrites = await ledger.putMany(normalizedEvents);
  const pitStops = materializePitStops(normalizedEvents);
  const analyzedPitStops = pitStops.length ? analyzePitStopRecords(pitStops) : [];
  const anomalyEvents = buildPitAnomalyEvents(pitStops, session.id);
  const anomalyWrites = await ledger.putMany(anomalyEvents);

  return {
    session,
    source: adapter.metadata,
    messages: messages.length,
    rawBatches,
    normalizedEvents,
    pitStops: analyzedPitStops,
    anomalyEvents,
    ledgerWrites: {
      normalized: summarizeWrites(normalizedWrites),
      anomalies: summarizeWrites(anomalyWrites),
    },
  };
};
