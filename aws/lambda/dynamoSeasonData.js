import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { publicRacePublicationStatus } from '../../server/racePublicationStatus.js';

const tableName = process.env.DYNAMODB_TABLE ?? 'f1-website-data';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-west-2',
});

const documentClient = DynamoDBDocumentClient.from(client);

const seasonPk = (year) => `SEASON#${year}`;
const raceStatusSk = (round) => `STATUS#ROUND#${String(round).padStart(2, '0')}`;
const raceAnalyticsPk = (year, round) => (
  `RACE#${year}#${String(round).padStart(2, '0')}`
);
const driverInternalFields = new Set(['pk', 'sk', 'itemType', 'year', 'round']);
const publicDriverFields = (item) => Object.fromEntries(
  Object.entries(item).filter(([key]) => !driverInternalFields.has(key)),
);

export const getDynamoSeasonSummary = async (year) => {
  const response = await documentClient.send(new GetCommand({
    TableName: tableName,
    Key: {
      pk: seasonPk(year),
      sk: 'META',
    },
  }));

  if (!response.Item) return null;

  return {
    year: response.Item.year,
    rounds: response.Item.rounds,
    results: response.Item.results,
    source: response.Item.source,
    sourceUrl: response.Item.sourceUrl,
    updatedAt: response.Item.updatedAt,
    dataStore: 'dynamodb',
  };
};

export const getDynamoSeason = async (year) => {
  const [summary, response] = await Promise.all([
    getDynamoSeasonSummary(year),
    documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :racePrefix)',
    ExpressionAttributeValues: {
      ':pk': seasonPk(year),
      ':racePrefix': 'RACE#',
    },
    ScanIndexForward: true,
  })),
  ]);

  const races = (response.Items ?? [])
    .sort((a, b) => a.round - b.round)
    .map((item) => item.race);

  if (races.length === 0) return null;

  return {
    races,
    source: summary?.source,
    sourceUrl: summary?.sourceUrl,
    updatedAt: summary?.updatedAt,
    dataStore: 'dynamodb',
  };
};

export const getDynamoRaceAnalytics = async (year, round) => {
  const response = await documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': raceAnalyticsPk(year, round),
    },
  }));

  const items = response.Items ?? [];
  const metadata = items.find((item) => item.sk === 'ANALYTICS#META');
  if (!metadata) return null;

  const validation = items.find((item) => item.sk === 'SOURCE#VALIDATION');
  const overtakes = items.find((item) => item.sk === 'ANALYTICS#OVERTAKES');
  const story = items.find((item) => item.sk === 'ANALYTICS#STORY');
  const drivers = items
    .filter((item) => item.sk.startsWith('DRIVER#'))
    .map(publicDriverFields)
    .sort((a, b) => (
      (a.finish_position ?? Number.MAX_SAFE_INTEGER)
      - (b.finish_position ?? Number.MAX_SAFE_INTEGER)
    ));

  return {
    schemaVersion: metadata.schemaVersion,
    calculationVersion: metadata.calculationVersion,
    year: metadata.year,
    round: metadata.round,
    session: metadata.session,
    summary: metadata.summary,
    definitions: metadata.definitions,
    circuitProfile: metadata.circuitProfile,
    validationStatus: metadata.validationStatus,
    validation: validation?.validation,
    rawSnapshots: metadata.rawSnapshots,
    updatedAt: metadata.updatedAt,
    overtakeEvents: overtakes?.events ?? [],
    storyEvents: story?.events ?? [],
    trafficSegments: story?.trafficSegments ?? [],
    pitCycleEvents: story?.pitCycleEvents ?? [],
    attritionEvents: story?.attritionEvents ?? [],
    disruptionEvents: story?.disruptionEvents ?? [],
    drivers,
    dataStore: 'dynamodb',
  };
};

export const getDynamoRacePublicationStatus = async (year, round) => {
  const response = await documentClient.send(new GetCommand({
    TableName: tableName,
    Key: {
      pk: seasonPk(year),
      sk: raceStatusSk(round),
    },
  }));

  return publicRacePublicationStatus(response.Item);
};

export const getDynamoSeasonPublicationStatus = async (year) => {
  const response = await documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': seasonPk(year),
      ':prefix': 'STATUS#ROUND#',
    },
    ScanIndexForward: true,
  }));

  return {
    year,
    races: (response.Items ?? [])
      .map(publicRacePublicationStatus)
      .sort((a, b) => a.round - b.round),
    dataStore: 'dynamodb',
  };
};

export const getDynamoSeasonAnalytics = async (year) => {
  const response = await documentClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': seasonPk(year),
      ':prefix': 'ANALYTICS#ROUND#',
    },
    ScanIndexForward: true,
  }));

  return {
    year,
    races: (response.Items ?? [])
      .sort((a, b) => a.round - b.round)
      .map((item) => ({
        year: item.year,
        round: item.round,
        session: item.session,
        summary: item.summary,
        circuitProfile: item.circuitProfile,
        validationStatus: item.validationStatus,
        updatedAt: item.updatedAt,
      })),
    dataStore: 'dynamodb',
  };
};
