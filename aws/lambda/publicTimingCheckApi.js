import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import {
  buildPublicIngestionCheckRequest,
  findPublicTimingSession,
  isPublicTimingCheckLimitReached,
  publicTimingCheckStatus,
  validatePublicTimingCheck,
} from '../../server/publicTimingCheck.js';

const region = process.env.AWS_REGION ?? 'us-west-2';
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const sqs = new SQSClient({ region });
const allowedOrigins = new Set(
  String(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const environment = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const response = (event, statusCode, body, headers = {}) => {
  const origin = event.headers?.origin ?? event.headers?.Origin;
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(origin && allowedOrigins.has(origin)
        ? { 'access-control-allow-origin': origin, vary: 'Origin' }
        : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

const listSessions = async () => {
  const result = await dynamo.send(new QueryCommand({
    TableName: environment('DYNAMODB_TABLE'),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :session)',
    ExpressionAttributeValues: {
      ':pk': `TIMING_RECORDER#${environment('TIMING_SOURCE_ID')}`,
      ':session': 'SESSION#',
    },
    ConsistentRead: true,
  }));
  return result.Items ?? [];
};

const inputFromEvent = (event) => validatePublicTimingCheck(
  event.requestContext?.http?.method === 'GET'
    ? event.pathParameters
    : JSON.parse(event.body ?? '{}'),
);

const getStatus = async (event) => {
  const input = inputFromEvent(event);
  const state = findPublicTimingSession(await listSessions(), input);
  const status = publicTimingCheckStatus(state);
  return response(event, state ? 200 : 404, {
    ...status,
    session: input,
  });
};

const requestCheck = async (event) => {
  const input = inputFromEvent(event);
  const state = findPublicTimingSession(await listSessions(), input);
  if (!state) {
    return response(event, 404, {
      ...publicTimingCheckStatus(null),
      session: input,
    });
  }

  const now = new Date();
  const nowEpoch = Math.floor(now.getTime() / 1_000);
  const cooldownSeconds = Number(process.env.PUBLIC_CHECK_COOLDOWN_SECONDS ?? 90);
  const maxChecks = Number(process.env.PUBLIC_CHECK_MAX_PER_SESSION ?? 24);
  const cooldownUntil = nowEpoch + cooldownSeconds;
  try {
    await dynamo.send(new UpdateCommand({
      TableName: environment('DYNAMODB_TABLE'),
      Key: {
        pk: state.pk,
        sk: state.sk,
      },
      UpdateExpression: [
        'SET publicCheckCooldownUntil = :cooldownUntil',
        'publicCheckQueuedAt = :now',
        'publicCheckCount = if_not_exists(publicCheckCount, :zero) + :one',
      ].join(', '),
      ConditionExpression: [
        'attribute_exists(pk)',
        '(attribute_not_exists(publicCheckCooldownUntil) OR publicCheckCooldownUntil <= :nowEpoch)',
        '(attribute_not_exists(publicCheckCount) OR publicCheckCount < :maxChecks)',
      ].join(' AND '),
      ExpressionAttributeValues: {
        ':cooldownUntil': cooldownUntil,
        ':now': now.toISOString(),
        ':zero': 0,
        ':one': 1,
        ':nowEpoch': nowEpoch,
        ':maxChecks': maxChecks,
      },
    }));
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') throw error;
    const latestState = (await dynamo.send(new GetCommand({
      TableName: environment('DYNAMODB_TABLE'),
      Key: {
        pk: state.pk,
        sk: state.sk,
      },
      ConsistentRead: true,
    }))).Item ?? state;
    if (isPublicTimingCheckLimitReached({
      state: latestState,
      maxChecks,
    })) {
      return response(event, 429, {
        status: 'limit_reached',
        message: 'This session has reached its community timing-check limit.',
        checksRemaining: 0,
        current: publicTimingCheckStatus(latestState),
        session: input,
      });
    }
    const retryAfter = Math.max(
      1,
      Number(latestState.publicCheckCooldownUntil ?? nowEpoch + cooldownSeconds) - nowEpoch,
    );
    return response(event, 429, {
      status: 'cooldown',
      message: 'A timing check was requested recently. Please give it a moment.',
      retryAfterSeconds: retryAfter,
      checksRemaining: Math.max(
        0,
        maxChecks - Number(latestState.publicCheckCount ?? 0),
      ),
      current: publicTimingCheckStatus(latestState),
      session: input,
    }, {
      'retry-after': String(retryAfter),
    });
  }

  const request = buildPublicIngestionCheckRequest({
    state,
    requestedAt: now.toISOString(),
  });
  await sqs.send(new SendMessageCommand({
    QueueUrl: environment('INGESTION_CHECK_QUEUE_URL'),
    MessageBody: JSON.stringify(request),
  }));
  return response(event, 202, {
    status: 'queued',
    message: 'Timing availability check queued.',
    cooldownSeconds,
    checksRemaining: Math.max(
      0,
      maxChecks - Number(state.publicCheckCount ?? 0) - 1,
    ),
    current: publicTimingCheckStatus(state),
    session: input,
  });
};

export const handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method;
    if (method === 'GET') return await getStatus(event);
    if (method === 'POST') return await requestCheck(event);
    return response(event, 405, {
      status: 'method_not_allowed',
      message: 'Method not allowed.',
    });
  } catch (error) {
    if (error instanceof SyntaxError || /Timing check .* is invalid/.test(error.message)) {
      return response(event, 400, {
        status: 'invalid_request',
        message: error.message,
      });
    }
    console.error(error);
    return response(event, 500, {
      status: 'error',
      message: 'The timing check service could not process this request.',
    });
  }
};
