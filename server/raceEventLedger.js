import { createHash } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  readdir,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const RACE_EVENT_SCHEMA_VERSION = 1;

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
};

const deterministicId = (value) => createHash('sha256')
  .update(JSON.stringify(stableValue(value)))
  .digest('hex')
  .slice(0, 24);

const requireWholeNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return number;
};

export const buildRaceEvent = ({
  year,
  round,
  sessionId,
  eventType,
  timestamp,
  source,
  sourceSchemaVersion,
  sourceEventId,
  supersedesEventId,
  correlationId,
  confidence = 1,
  evidence = [],
  observed = {},
  derived = {},
  interpretation = {
    status: 'unexplained',
    summary: 'No interpretation assigned.',
  },
  processingVersion,
} = {}) => {
  const normalizedYear = requireWholeNumber(year, 'Year');
  const normalizedRound = requireWholeNumber(round, 'Round');
  if (
    !sessionId
    || !eventType
    || !timestamp
    || !source
    || sourceSchemaVersion === undefined
    || !processingVersion
  ) {
    throw new Error('Race events require session, type, timestamp, source, source schema, and processing version.');
  }
  const normalizedConfidence = Number(confidence);
  if (!Number.isFinite(normalizedConfidence)) {
    throw new Error('Race event confidence must be a finite number.');
  }

  const identity = {
    year: normalizedYear,
    round: normalizedRound,
    sessionId,
    eventType,
    timestamp: new Date(timestamp).toISOString(),
    source,
    sourceSchemaVersion,
    sourceEventId,
    supersedesEventId,
    correlationId,
    observed,
    derived,
    processingVersion,
  };

  return {
    schemaVersion: RACE_EVENT_SCHEMA_VERSION,
    eventId: deterministicId(identity),
    year: normalizedYear,
    round: normalizedRound,
    sessionId: String(sessionId),
    eventType: String(eventType),
    timestamp: identity.timestamp,
    source: String(source),
    sourceSchemaVersion: String(sourceSchemaVersion),
    sourceEventId: sourceEventId ? String(sourceEventId) : undefined,
    supersedesEventId: supersedesEventId ? String(supersedesEventId) : undefined,
    correlationId: correlationId ? String(correlationId) : undefined,
    confidence: Math.max(0, Math.min(1, normalizedConfidence)),
    evidence,
    observed,
    derived,
    interpretation,
    processingVersion: String(processingVersion),
  };
};

const eventPartitionKey = (event) => (
  `RACE_EVENTS#${event.year}#${String(event.round).padStart(2, '0')}`
);
const eventSortKey = (event) => (
  `${event.timestamp}#${event.eventType}#${event.eventId}`
);

const safeSegment = (value) => String(value ?? 'unknown')
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-|-$/g, '');

export const createMemoryRaceEventLedger = () => {
  const events = new Map();

  return {
    mode: 'memory',

    async put(event) {
      if (events.has(event.eventId)) return { status: 'duplicate', eventId: event.eventId };
      events.set(event.eventId, event);
      return { status: 'inserted', eventId: event.eventId };
    },

    async putMany(items) {
      const results = [];
      for (const event of items) results.push(await this.put(event));
      return results;
    },

    async list() {
      return [...events.values()].sort((left, right) => (
        left.timestamp.localeCompare(right.timestamp)
        || left.eventId.localeCompare(right.eventId)
      ));
    },
  };
};

const collectJsonFiles = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJsonFiles(path));
    if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files;
};

export const createLocalRaceEventLedger = ({
  root = resolve(import.meta.dirname, '../.data/timing-recorder'),
} = {}) => {
  const eventsRoot = resolve(root, 'race-events');
  const eventPath = (event) => resolve(
    eventsRoot,
    String(event.year),
    `round-${String(event.round).padStart(2, '0')}`,
    safeSegment(event.sessionId),
    `${event.eventId}.json`,
  );

  return {
    mode: 'local',
    root: resolve(root),

    async put(event) {
      const path = eventPath(event);
      await mkdir(resolve(path, '..'), { recursive: true });
      let handle;
      try {
        handle = await open(path, 'wx');
        await handle.writeFile(`${JSON.stringify(event)}\n`);
        await handle.sync();
        return { status: 'inserted', eventId: event.eventId };
      } catch (error) {
        if (error.code === 'EEXIST') {
          return { status: 'duplicate', eventId: event.eventId };
        }
        throw error;
      } finally {
        await handle?.close();
      }
    },

    async putMany(items) {
      const results = [];
      for (const event of items) results.push(await this.put(event));
      return results;
    },

    async list({
      year,
      round,
      sessionId,
    } = {}) {
      let directory = eventsRoot;
      if (year) directory = resolve(directory, String(year));
      if (round) directory = resolve(directory, `round-${String(round).padStart(2, '0')}`);
      if (sessionId) directory = resolve(directory, safeSegment(sessionId));
      const files = await collectJsonFiles(directory);
      const events = await Promise.all(files.map(async (path) => (
        JSON.parse(await readFile(path, 'utf8'))
      )));
      return events.sort((left, right) => (
        left.timestamp.localeCompare(right.timestamp)
        || left.eventId.localeCompare(right.eventId)
      ));
    },
  };
};

export const createDynamoRaceEventLedger = ({
  documentClient,
  tableName = process.env.DYNAMODB_TABLE ?? 'f1-website-data',
} = {}) => ({
  mode: 'dynamodb',

  async put(event) {
    const item = {
      pk: eventPartitionKey(event),
      sk: eventSortKey(event),
      itemType: 'race_event',
      ...event,
    };

    try {
      await documentClient.send(new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }));
      return { status: 'inserted', eventId: event.eventId };
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        return { status: 'duplicate', eventId: event.eventId };
      }
      throw error;
    }
  },

  async putMany(items) {
    const results = [];
    for (const event of items) results.push(await this.put(event));
    return results;
  },

  async list({
    year,
    round,
    sessionId,
  } = {}) {
    if (!year || !round) {
      throw new Error('DynamoDB event-ledger reads require a year and round.');
    }

    const events = [];
    let exclusiveStartKey;
    do {
      const response = await documentClient.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: sessionId ? 'sessionId = :sessionId' : undefined,
        ExpressionAttributeValues: {
          ':pk': eventPartitionKey({ year, round }),
          ...(sessionId ? { ':sessionId': String(sessionId) } : {}),
        },
        ExclusiveStartKey: exclusiveStartKey,
      }));
      events.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return events
      .map(({ pk: _pk, sk: _sk, itemType: _itemType, ...event }) => event)
      .sort((left, right) => (
        left.timestamp.localeCompare(right.timestamp)
        || left.eventId.localeCompare(right.eventId)
      ));
  },
});
