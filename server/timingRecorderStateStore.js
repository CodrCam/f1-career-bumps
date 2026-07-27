import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export const TIMING_RECORDER_STATE_VERSION = 1;
export const TIMING_RECORDER_STATUSES = Object.freeze([
  'scheduled',
  'dispatching',
  'recording',
  'interrupted',
  'complete',
  'failed',
]);

const safeSegment = (value) => String(value ?? 'unknown')
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-|-$/g, '');

const stateKey = (sourceId, sessionId) => `${sourceId}#${sessionId}`;
const recorderPartitionKey = (sourceId) => `TIMING_RECORDER#${sourceId}`;
const recorderSortKey = (sessionId) => `SESSION#${sessionId}`;
const iso = (value = new Date()) => new Date(value).toISOString();
const leaseExpiry = (now, leaseDurationMs) => (
  new Date(new Date(now).getTime() + leaseDurationMs).toISOString()
);

const requireSession = (session) => {
  if (
    !session?.id
    || !Number.isInteger(Number(session.year))
    || !Number.isInteger(Number(session.round))
    || !session.type
    || !session.startsAt
  ) {
    throw new Error('Recorder sessions require id, year, round, type, and startsAt.');
  }
};

const publicSourceMetadata = (source) => ({
  id: source.id,
  displayName: source.displayName,
  attribution: source.attribution,
  schemaVersion: source.schemaVersion,
  authorization: {
    status: source.authorization?.status,
    basis: source.authorization?.basis,
    reviewedAt: source.authorization?.reviewedAt,
    reviewedBy: source.authorization?.reviewedBy,
    termsUrl: source.authorization?.termsUrl,
    contractId: source.authorization?.contractId,
    deploymentScopes: source.authorization?.deploymentScopes ?? [],
  },
});

const initialState = ({ session, source, now }) => {
  requireSession(session);
  if (!source?.id) throw new Error('Recorder state requires source metadata.');

  return {
    stateVersion: TIMING_RECORDER_STATE_VERSION,
    source: publicSourceMetadata(source),
    session: {
      id: String(session.id),
      year: Number(session.year),
      round: Number(session.round),
      type: String(session.type),
      name: session.name ? String(session.name) : String(session.type),
      startsAt: iso(session.startsAt),
      endsAt: session.endsAt ? iso(session.endsAt) : null,
    },
    status: 'scheduled',
    cursor: null,
    lastSequence: 0,
    messageCount: 0,
    batchCount: 0,
    attempts: 0,
    health: null,
    lastBatch: null,
    lastMessageAt: null,
    lastError: null,
    createdAt: iso(now),
    updatedAt: iso(now),
  };
};

const claimState = (state, {
  ownerId,
  leaseDurationMs,
  allowCompleted = false,
  now,
} = {}) => {
  const timestamp = iso(now);
  if (!ownerId) throw new Error('A recorder owner id is required to claim a session.');
  if (!Number.isFinite(leaseDurationMs) || leaseDurationMs < 1_000) {
    throw new Error('Recorder lease duration must be at least 1000ms.');
  }
  if (state.status === 'complete' && !allowCompleted) {
    return { acquired: false, reason: 'already_complete', state };
  }
  if (
    state.leaseOwner
    && state.leaseOwner !== ownerId
    && Date.parse(state.leaseExpiresAt) > Date.parse(timestamp)
  ) {
    return { acquired: false, reason: 'lease_held', state };
  }

  const nextState = {
    acquired: true,
    reason: state.leaseOwner === ownerId ? 'renewed' : 'acquired',
    state: {
      ...state,
      status: 'recording',
      leaseOwner: ownerId,
      leaseExpiresAt: leaseExpiry(timestamp, leaseDurationMs),
      attempts: Number(state.attempts ?? 0) + 1,
      startedAt: state.startedAt ?? timestamp,
      completedAt: null,
      updatedAt: timestamp,
      lastError: null,
    },
  };
  delete nextState.state.dispatchRequestId;
  delete nextState.state.dispatchExpiresAt;
  return nextState;
};

const requireActiveLease = (state, { ownerId, now }) => {
  const timestamp = iso(now);
  if (state?.leaseOwner !== ownerId) {
    throw new Error(`Recorder lease is not held by "${ownerId}".`);
  }
  if (Date.parse(state.leaseExpiresAt) < Date.parse(timestamp)) {
    throw new Error(`Recorder lease held by "${ownerId}" has expired.`);
  }
  return timestamp;
};

const checkpointState = (state, {
  ownerId,
  leaseDurationMs,
  cursor = state.cursor,
  lastSequence = state.lastSequence,
  messageCount = state.messageCount,
  batchCount = state.batchCount,
  lastMessageAt = state.lastMessageAt,
  lastBatch = state.lastBatch,
  health = state.health,
  now,
} = {}) => {
  const timestamp = requireActiveLease(state, { ownerId, now });
  return {
    ...state,
    cursor,
    lastSequence: Number(lastSequence ?? 0),
    messageCount: Number(messageCount ?? 0),
    batchCount: Number(batchCount ?? 0),
    lastMessageAt,
    lastBatch,
    health,
    leaseExpiresAt: leaseExpiry(timestamp, leaseDurationMs),
    updatedAt: timestamp,
  };
};

const finishState = (state, {
  ownerId,
  status,
  error,
  health = state.health,
  now,
} = {}) => {
  if (!['complete', 'interrupted', 'failed'].includes(status)) {
    throw new Error(`Recorder cannot finish with status "${status}".`);
  }
  const timestamp = requireActiveLease(state, { ownerId, now });
  const next = {
    ...state,
    status,
    health,
    updatedAt: timestamp,
    completedAt: status === 'complete' ? timestamp : null,
    lastError: error
      ? {
        name: String(error.name ?? 'Error'),
        message: String(error.message ?? error),
        at: timestamp,
      }
      : null,
  };
  delete next.leaseOwner;
  delete next.leaseExpiresAt;
  return next;
};

const probeState = (state, {
  availability,
  requestId,
  now,
} = {}) => {
  if (!state) throw new Error('Recorder session must be registered before recording a probe.');
  if (!availability?.checkedAt) {
    throw new Error('Recorder availability probes require a checkedAt timestamp.');
  }
  return {
    ...state,
    availability: {
      checkedAt: iso(availability.checkedAt),
      available: Boolean(availability.available),
      sessionStatus: availability.sessionStatus ?? 'unknown',
      classificationStatus: availability.classificationStatus ?? null,
      latestCursor: availability.latestCursor ?? null,
      messageCount: Number(availability.messageCount ?? 0),
    },
    lastCheckRequestId: requestId ? String(requestId) : null,
    updatedAt: iso(now),
  };
};

const reserveDispatchState = (state, {
  requestId,
  reservationDurationMs = 5 * 60 * 1_000,
  now,
} = {}) => {
  if (!state) throw new Error('Recorder session must be registered before dispatch.');
  if (!requestId) throw new Error('Recorder dispatch reservations require a request id.');
  const timestamp = iso(now);
  if (state.status === 'recording') {
    return { reserved: false, reason: 'recorder_already_running', state };
  }
  if (
    state.dispatchRequestId !== requestId
    && Date.parse(state.dispatchExpiresAt) > Date.parse(timestamp)
  ) {
    return { reserved: false, reason: 'dispatch_in_progress', state };
  }
  return {
    reserved: true,
    reason: state.dispatchRequestId === requestId ? 'renewed' : 'reserved',
    state: {
      ...state,
      status: 'dispatching',
      dispatchRequestId: String(requestId),
      dispatchExpiresAt: leaseExpiry(timestamp, reservationDurationMs),
      updatedAt: timestamp,
    },
  };
};

export const createMemoryTimingRecorderStateStore = () => {
  const states = new Map();

  return {
    mode: 'memory',

    async register({ session, source, now = new Date() }) {
      const key = stateKey(source.id, session.id);
      if (!states.has(key)) states.set(key, initialState({ session, source, now }));
      return states.get(key);
    },

    async get(sourceId, sessionId) {
      return states.get(stateKey(sourceId, sessionId)) ?? null;
    },

    async list({ sourceId } = {}) {
      return [...states.values()]
        .filter((state) => !sourceId || state.source.id === sourceId)
        .sort((left, right) => left.session.startsAt.localeCompare(right.session.startsAt));
    },

    async claim({ sourceId, sessionId, ...options }) {
      const key = stateKey(sourceId, sessionId);
      const state = states.get(key);
      if (!state) throw new Error(`Recorder session "${sourceId}/${sessionId}" is not registered.`);
      const result = claimState(state, options);
      if (result.acquired) states.set(key, result.state);
      return result;
    },

    async checkpoint({ sourceId, sessionId, ...options }) {
      const key = stateKey(sourceId, sessionId);
      const next = checkpointState(states.get(key), options);
      states.set(key, next);
      return next;
    },

    async finish({ sourceId, sessionId, ...options }) {
      const key = stateKey(sourceId, sessionId);
      const next = finishState(states.get(key), options);
      states.set(key, next);
      return next;
    },

    async recordProbe({ sourceId, sessionId, ...options }) {
      const key = stateKey(sourceId, sessionId);
      const next = probeState(states.get(key), options);
      states.set(key, next);
      return next;
    },

    async reserveDispatch({ sourceId, sessionId, ...options }) {
      const key = stateKey(sourceId, sessionId);
      const result = reserveDispatchState(states.get(key), options);
      if (result.reserved) states.set(key, result.state);
      return result;
    },
  };
};

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const writeJsonAtomic = async (path, value) => {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporaryPath, path);
};

export const createLocalTimingRecorderStateStore = ({
  root = resolve(import.meta.dirname, '../.data/timing-recorder'),
} = {}) => {
  const stateRoot = resolve(root, 'state');
  const pathFor = (sourceId, sessionId) => resolve(
    stateRoot,
    safeSegment(sourceId),
    `${safeSegment(sessionId)}.json`,
  );

  return {
    mode: 'local',
    coordination: 'single-host-development',
    root: resolve(root),

    async register({ session, source, now = new Date() }) {
      const path = pathFor(source.id, session.id);
      const existing = await readJson(path);
      if (existing) return existing;
      const state = initialState({ session, source, now });
      await writeJsonAtomic(path, state);
      return state;
    },

    async get(sourceId, sessionId) {
      return readJson(pathFor(sourceId, sessionId));
    },

    async list({ sourceId } = {}) {
      let sourceDirectories;
      try {
        sourceDirectories = sourceId
          ? [safeSegment(sourceId)]
          : (await readdir(stateRoot, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }

      const states = [];
      for (const directory of sourceDirectories) {
        let files;
        try {
          files = await readdir(resolve(stateRoot, directory), { withFileTypes: true });
        } catch (error) {
          if (error.code === 'ENOENT') continue;
          throw error;
        }
        for (const file of files) {
          if (!file.isFile() || !file.name.endsWith('.json')) continue;
          const state = await readJson(resolve(stateRoot, directory, file.name));
          if (state) states.push(state);
        }
      }
      return states.sort((left, right) => (
        left.session.startsAt.localeCompare(right.session.startsAt)
      ));
    },

    async claim({ sourceId, sessionId, ...options }) {
      const path = pathFor(sourceId, sessionId);
      const state = await readJson(path);
      if (!state) throw new Error(`Recorder session "${sourceId}/${sessionId}" is not registered.`);
      const result = claimState(state, options);
      if (result.acquired) await writeJsonAtomic(path, result.state);
      return result;
    },

    async checkpoint({ sourceId, sessionId, ...options }) {
      const path = pathFor(sourceId, sessionId);
      const next = checkpointState(await readJson(path), options);
      await writeJsonAtomic(path, next);
      return next;
    },

    async finish({ sourceId, sessionId, ...options }) {
      const path = pathFor(sourceId, sessionId);
      const next = finishState(await readJson(path), options);
      await writeJsonAtomic(path, next);
      return next;
    },

    async recordProbe({ sourceId, sessionId, ...options }) {
      const path = pathFor(sourceId, sessionId);
      const next = probeState(await readJson(path), options);
      await writeJsonAtomic(path, next);
      return next;
    },

    async reserveDispatch({ sourceId, sessionId, ...options }) {
      const path = pathFor(sourceId, sessionId);
      const result = reserveDispatchState(await readJson(path), options);
      if (result.reserved) await writeJsonAtomic(path, result.state);
      return result;
    },
  };
};

const dynamoKey = (sourceId, sessionId) => ({
  pk: recorderPartitionKey(sourceId),
  sk: recorderSortKey(sessionId),
});

export const createDynamoTimingRecorderStateStore = ({
  documentClient,
  tableName = process.env.DYNAMODB_TABLE ?? 'f1-website-data',
} = {}) => {
  if (!documentClient) throw new Error('Dynamo recorder state requires a document client.');

  const get = async (sourceId, sessionId) => {
    const result = await documentClient.send(new GetCommand({
      TableName: tableName,
      Key: dynamoKey(sourceId, sessionId),
      ConsistentRead: true,
    }));
    return result.Item ?? null;
  };

  return {
    mode: 'dynamodb',

    async register({ session, source, now = new Date() }) {
      const state = {
        ...dynamoKey(source.id, session.id),
        itemType: 'timing_recorder_state',
        ...initialState({ session, source, now }),
      };
      try {
        await documentClient.send(new PutCommand({
          TableName: tableName,
          Item: state,
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        }));
        return state;
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error;
        return get(source.id, session.id);
      }
    },

    get,

    async list({ sourceId } = {}) {
      if (!sourceId) {
        throw new Error('Dynamo recorder state listing requires a source id.');
      }
      const result = await documentClient.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :session)',
        ExpressionAttributeValues: {
          ':pk': recorderPartitionKey(sourceId),
          ':session': 'SESSION#',
        },
        ConsistentRead: true,
      }));
      return (result.Items ?? []).sort((left, right) => (
        left.session.startsAt.localeCompare(right.session.startsAt)
      ));
    },

    async claim({
      sourceId,
      sessionId,
      ownerId,
      leaseDurationMs,
      allowCompleted = false,
      now = new Date(),
    }) {
      const timestamp = iso(now);
      try {
        const result = await documentClient.send(new UpdateCommand({
          TableName: tableName,
          Key: dynamoKey(sourceId, sessionId),
          UpdateExpression: [
            'SET #status = :recording, leaseOwner = :owner, leaseExpiresAt = :expires,',
            'attempts = if_not_exists(attempts, :zero) + :one,',
            'startedAt = if_not_exists(startedAt, :now), updatedAt = :now',
            'REMOVE dispatchRequestId, dispatchExpiresAt',
          ].join(' '),
          ConditionExpression: [
            'attribute_exists(pk)',
            '(:allowCompleted = :true OR #status <> :complete)',
            '(attribute_not_exists(leaseExpiresAt) OR leaseExpiresAt < :now OR leaseOwner = :owner)',
          ].join(' AND '),
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':recording': 'recording',
            ':complete': 'complete',
            ':allowCompleted': allowCompleted,
            ':true': true,
            ':owner': ownerId,
            ':expires': leaseExpiry(timestamp, leaseDurationMs),
            ':now': timestamp,
            ':zero': 0,
            ':one': 1,
          },
          ReturnValues: 'ALL_NEW',
        }));
        return { acquired: true, reason: 'acquired', state: result.Attributes };
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error;
        const state = await get(sourceId, sessionId);
        return {
          acquired: false,
          reason: state?.status === 'complete' ? 'already_complete' : 'lease_held',
          state,
        };
      }
    },

    async checkpoint({
      sourceId,
      sessionId,
      ownerId,
      leaseDurationMs,
      cursor,
      lastSequence,
      messageCount,
      batchCount,
      lastMessageAt,
      lastBatch,
      health,
      now = new Date(),
    }) {
      const timestamp = iso(now);
      const result = await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: dynamoKey(sourceId, sessionId),
        UpdateExpression: [
          'SET cursor = :cursor',
          'lastSequence = :lastSequence',
          'messageCount = :messageCount',
          'batchCount = :batchCount',
          'lastMessageAt = :lastMessageAt',
          'lastBatch = :lastBatch',
          'health = :health',
          'leaseExpiresAt = :expires',
          'updatedAt = :now',
        ].join(', '),
        ConditionExpression: 'leaseOwner = :owner AND leaseExpiresAt >= :now',
        ExpressionAttributeValues: {
          ':owner': ownerId,
          ':cursor': cursor,
          ':lastSequence': lastSequence,
          ':messageCount': messageCount,
          ':batchCount': batchCount,
          ':lastMessageAt': lastMessageAt,
          ':lastBatch': lastBatch,
          ':health': health,
          ':expires': leaseExpiry(timestamp, leaseDurationMs),
          ':now': timestamp,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return result.Attributes;
    },

    async finish({
      sourceId,
      sessionId,
      ownerId,
      status,
      error,
      health,
      now = new Date(),
    }) {
      if (!['complete', 'interrupted', 'failed'].includes(status)) {
        throw new Error(`Recorder cannot finish with status "${status}".`);
      }
      const timestamp = iso(now);
      const result = await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: dynamoKey(sourceId, sessionId),
        UpdateExpression: [
          'SET #status = :status, health = :health, updatedAt = :now,',
          'completedAt = :completedAt, lastError = :lastError',
          'REMOVE leaseOwner, leaseExpiresAt',
        ].join(' '),
        ConditionExpression: 'leaseOwner = :owner AND leaseExpiresAt >= :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':owner': ownerId,
          ':status': status,
          ':health': health ?? null,
          ':now': timestamp,
          ':completedAt': status === 'complete' ? timestamp : null,
          ':lastError': error
            ? {
              name: String(error.name ?? 'Error'),
              message: String(error.message ?? error),
              at: timestamp,
            }
            : null,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return result.Attributes;
    },

    async recordProbe({
      sourceId,
      sessionId,
      availability,
      requestId,
      now = new Date(),
    }) {
      const timestamp = iso(now);
      const result = await documentClient.send(new UpdateCommand({
        TableName: tableName,
        Key: dynamoKey(sourceId, sessionId),
        UpdateExpression: [
          'SET availability = :availability',
          'lastCheckRequestId = :requestId',
          'updatedAt = :now',
        ].join(', '),
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeValues: {
          ':availability': {
            checkedAt: iso(availability.checkedAt),
            available: Boolean(availability.available),
            sessionStatus: availability.sessionStatus ?? 'unknown',
            classificationStatus: availability.classificationStatus ?? null,
            latestCursor: availability.latestCursor ?? null,
            messageCount: Number(availability.messageCount ?? 0),
          },
          ':requestId': requestId ? String(requestId) : null,
          ':now': timestamp,
        },
        ReturnValues: 'ALL_NEW',
      }));
      return result.Attributes;
    },

    async reserveDispatch({
      sourceId,
      sessionId,
      requestId,
      reservationDurationMs = 5 * 60 * 1_000,
      now = new Date(),
    }) {
      const timestamp = iso(now);
      try {
        const result = await documentClient.send(new UpdateCommand({
          TableName: tableName,
          Key: dynamoKey(sourceId, sessionId),
          UpdateExpression: [
            'SET #status = :dispatching, dispatchRequestId = :requestId,',
            'dispatchExpiresAt = :expires, updatedAt = :now',
          ].join(' '),
          ConditionExpression: [
            'attribute_exists(pk)',
            '#status <> :recording',
            '(attribute_not_exists(dispatchExpiresAt) OR dispatchExpiresAt < :now OR dispatchRequestId = :requestId)',
          ].join(' AND '),
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':dispatching': 'dispatching',
            ':recording': 'recording',
            ':requestId': String(requestId),
            ':expires': leaseExpiry(timestamp, reservationDurationMs),
            ':now': timestamp,
          },
          ReturnValues: 'ALL_NEW',
        }));
        return {
          reserved: true,
          reason: 'reserved',
          state: result.Attributes,
        };
      } catch (error) {
        if (error.name !== 'ConditionalCheckFailedException') throw error;
        return {
          reserved: false,
          reason: 'dispatch_in_progress',
          state: await get(sourceId, sessionId),
        };
      }
    },
  };
};
