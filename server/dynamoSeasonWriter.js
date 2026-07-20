import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

export const dynamoDocumentClientOptions = {
  marshallOptions: {
    removeUndefinedValues: true,
  },
};

export const getDynamoContext = () => {
  const tableName = process.env.DYNAMODB_TABLE ?? 'f1-website-data';
  const region = process.env.AWS_REGION ?? 'us-west-2';
  const client = new DynamoDBClient({ region });
  const documentClient = DynamoDBDocumentClient.from(client, dynamoDocumentClientOptions);

  return { tableName, region, client, documentClient };
};

export const seasonPk = (year) => `SEASON#${year}`;
export const raceSk = (round) => `RACE#${String(round).padStart(2, '0')}`;
export const raceAnalyticsPk = (year, round) => `RACE#${year}#${String(round).padStart(2, '0')}`;

const chunk = (items, size) => {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

const seasonItemKey = ({ pk, sk }) => `${pk}\0${sk}`;

const isReplaceableSeasonItem = (item) => (
  item.sk === 'META' || item.sk.startsWith('RACE#')
);

export const ensureSeasonTable = async ({ client, tableName }) => {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }
  }

  await client.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    Tags: [
      { Key: 'Application', Value: 'f1-website' },
      { Key: 'awsApplication', Value: 'f1-website' },
    ],
  }));

  await waitUntilTableExists(
    { client, maxWaitTime: 60 },
    { TableName: tableName },
  );
};

export const batchWriteAll = async ({ documentClient, tableName }, requests) => {
  let pending = requests;

  while (pending.length > 0) {
    const response = await documentClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: pending,
      },
    }));

    pending = response.UnprocessedItems?.[tableName] ?? [];
  }
};

const getReplaceableSeasonKeys = async (context, year) => {
  const { documentClient, tableName } = context;
  const pk = seasonPk(year);
  const existing = await documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': pk,
    },
    ProjectionExpression: 'pk, sk',
  }));

  return (existing.Items ?? []).filter(isReplaceableSeasonItem);
};

const deleteSeasonItems = async (context, items) => {
  const deleteRequests = items
    .map((item) => ({
      DeleteRequest: {
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
      },
    }));

  for (const requests of chunk(deleteRequests, 25)) {
    if (requests.length > 0) {
      await batchWriteAll(context, requests);
    }
  }
};

export const deleteExistingSeason = async (context, year) => {
  await deleteSeasonItems(context, await getReplaceableSeasonKeys(context, year));
};

const deleteStaleSeasonItems = async (context, year, activeKeys) => {
  const staleItems = (await getReplaceableSeasonKeys(context, year))
    .filter((item) => !activeKeys.has(seasonItemKey(item)));

  await deleteSeasonItems(context, staleItems);
};

export const deletePartition = async (context, pk) => {
  const { documentClient, tableName } = context;
  const existing = await documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': pk },
    ProjectionExpression: 'pk, sk',
  }));

  const deleteRequests = (existing.Items ?? []).map((item) => ({
    DeleteRequest: {
      Key: {
        pk: item.pk,
        sk: item.sk,
      },
    },
  }));

  for (const requests of chunk(deleteRequests, 25)) {
    if (requests.length > 0) await batchWriteAll(context, requests);
  }
};

export const countResultRows = (races) => races.reduce((count, race) => {
  return count
    + (race.sprint_results?.length ?? 0)
    + (race.sprint_qualifying_results?.length ?? 0)
    + (race.qualifying_results?.length ?? 0)
    + (race.race_results?.length ?? 0);
}, 0);

export const writeSeasonToDynamo = async (context, year, races, metadata = {}) => {
  await ensureSeasonTable(context);

  const pk = seasonPk(year);
  const results = countResultRows(races);
  const items = [
    {
      pk,
      sk: 'META',
      itemType: 'season',
      year,
      rounds: races.length,
      results,
      updatedAt: new Date().toISOString(),
      ...metadata,
    },
    ...races.map((race) => ({
      pk,
      sk: raceSk(race.round),
      itemType: 'race',
      year,
      round: race.round,
      grandPrix: race.grand_prix,
      race,
    })),
  ];

  const putRequests = items.map((item) => ({
    PutRequest: { Item: item },
  }));

  for (const requests of chunk(putRequests, 25)) {
    await batchWriteAll(context, requests);
  }

  await deleteStaleSeasonItems(
    context,
    year,
    new Set(items.map(seasonItemKey)),
  );

  return {
    table: context.tableName,
    region: context.region,
    year,
    rounds: races.length,
    results,
    items: items.length,
  };
};

export const writeRaceAnalyticsToDynamo = async (
  context,
  {
    year,
    round,
    analytics,
    validation,
    rawSnapshots = {},
  },
) => {
  await ensureSeasonTable(context);

  const pk = raceAnalyticsPk(year, round);
  await deletePartition(context, pk);

  const items = [
    {
      pk,
      sk: 'ANALYTICS#META',
      itemType: 'race_analytics',
      schemaVersion: analytics.schema_version,
      calculationVersion: analytics.calculation_version,
      year,
      round,
      session: analytics.session,
      summary: analytics.summary,
      definitions: analytics.definitions,
      circuitProfile: analytics.circuit_profile,
      validationStatus: validation.status,
      rawSnapshots,
      updatedAt: new Date().toISOString(),
    },
    {
      pk,
      sk: 'SOURCE#VALIDATION',
      itemType: 'source_validation',
      year,
      round,
      validation,
    },
    {
      pk,
      sk: 'ANALYTICS#OVERTAKES',
      itemType: 'overtake_events',
      year,
      round,
      events: analytics.overtake_events,
    },
    {
      pk,
      sk: 'ANALYTICS#STORY',
      itemType: 'race_story_events',
      year,
      round,
      events: analytics.story_events,
      trafficSegments: analytics.traffic_segments,
      pitCycleEvents: analytics.pit_cycle_events,
      attritionEvents: analytics.attrition_events,
      disruptionEvents: analytics.disruption_events,
    },
    ...analytics.drivers.map((driver) => ({
      pk,
      sk: `DRIVER#${driver.driver}`,
      itemType: 'driver_race_analytics',
      year,
      round,
      ...driver,
    })),
    {
      pk: seasonPk(year),
      sk: `ANALYTICS#ROUND#${String(round).padStart(2, '0')}`,
      itemType: 'season_race_analytics_index',
      year,
      round,
      session: analytics.session,
      summary: analytics.summary,
      circuitProfile: analytics.circuit_profile,
      validationStatus: validation.status,
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const requests of chunk(items.map((item) => ({
    PutRequest: { Item: item },
  })), 25)) {
    await batchWriteAll(context, requests);
  }

  return {
    table: context.tableName,
    region: context.region,
    year,
    round,
    partition: pk,
    items: items.length,
    drivers: analytics.drivers.length,
  };
};
