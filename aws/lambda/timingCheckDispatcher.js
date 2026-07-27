import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createFixtureTimingAdapter } from '../../server/fixtureTimingAdapter.js';
import {
  processIngestionCheck,
} from '../../server/ingestionCheckDispatcher.js';
import {
  createDynamoTimingRecorderStateStore,
} from '../../server/timingRecorderStateStore.js';

const region = process.env.AWS_REGION ?? 'us-west-2';
const ecs = new ECSClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const requiredEnvironment = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const commaList = (name) => requiredEnvironment(name)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const createAdapter = (sourceId) => {
  if (sourceId === 'slipstream-fixture') {
    return createFixtureTimingAdapter({
      fixturePath:
        process.env.TIMING_FIXTURE_PATH ??
        new URL(
          './server/fixtures/timing/2026-round-99-race.jsonl',
          import.meta.url,
        ).pathname,
    });
  }
  throw new Error(
    `Timing source "${sourceId}" is not installed in the dispatcher bundle.`,
  );
};

const launchRecorderTask = async ({
  request,
  session,
  streamMode,
  refreshCompleted,
}) => {
  const result = await ecs.send(new RunTaskCommand({
    cluster: requiredEnvironment('RECORDER_CLUSTER_ARN'),
    taskDefinition: requiredEnvironment('RECORDER_TASK_DEFINITION_ARN'),
    launchType: 'FARGATE',
    count: 1,
    enableECSManagedTags: true,
    startedBy: request.requestId.slice(0, 36),
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: process.env.RECORDER_ASSIGN_PUBLIC_IP ?? 'DISABLED',
        subnets: commaList('RECORDER_SUBNET_IDS'),
        securityGroups: commaList('RECORDER_SECURITY_GROUP_IDS'),
      },
    },
    overrides: {
      containerOverrides: [{
        name: process.env.RECORDER_CONTAINER_NAME ?? 'recorder',
        environment: [
          { name: 'TIMING_SOURCE_ID', value: request.sourceId },
          { name: 'TIMING_SESSION_ID', value: session.id },
          { name: 'TIMING_JOB_MODE', value: streamMode },
          {
            name: 'TIMING_REFRESH_COMPLETED',
            value: refreshCompleted ? 'true' : 'false',
          },
        ],
      }],
    },
    tags: [
      { key: 'application', value: 'slipstream' },
      { key: 'component', value: 'timing-recorder' },
      { key: 'timing-session', value: session.id.slice(0, 256) },
      { key: 'ingestion-request', value: request.requestId.slice(0, 256) },
    ],
  }));

  if (result.failures?.length || !result.tasks?.[0]?.taskArn) {
    throw new Error(
      `ECS did not start the recorder task: ${JSON.stringify(result.failures ?? [])}`,
    );
  }
  return {
    taskArn: result.tasks[0].taskArn,
    lastStatus: result.tasks[0].lastStatus,
  };
};

export const handler = async (event) => {
  const failures = [];
  for (const record of event.Records ?? []) {
    try {
      const request = {
        ...JSON.parse(record.body),
        attempt: Number(record.attributes?.ApproximateReceiveCount ?? 1),
      };
      const adapter = createAdapter(request.sourceId);
      const decision = await processIngestionCheck({
        request,
        adapter,
        deploymentScope: process.env.TIMING_DEPLOYMENT_SCOPE ?? 'production',
        stateStore: createDynamoTimingRecorderStateStore({
          documentClient: dynamo,
          tableName: requiredEnvironment('DYNAMODB_TABLE'),
        }),
        launch: launchRecorderTask,
      });

      console.log(JSON.stringify({
        requestId: request.requestId,
        sessionId: request.sessionId,
        status: decision.status,
        reason: decision.reason,
        nextCheckAt: decision.nextCheckAt,
      }));

      if (decision.status === 'retry') {
        failures.push({ itemIdentifier: record.messageId });
      }
    } catch (error) {
      console.error(JSON.stringify({
        messageId: record.messageId,
        error: error.message,
      }));
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return {
    batchItemFailures: failures,
  };
};
