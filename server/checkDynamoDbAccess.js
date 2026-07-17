import './loadLocalEnv.js';
import { hasLocalAwsCredentials, printLocalCredentialHelp } from './awsLocalCredentials.js';
import {
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

const tableName = process.env.DYNAMODB_TABLE ?? 'f1-website-data';
const region = process.env.AWS_REGION ?? 'us-west-2';
const year = Number(process.argv[2] ?? 2025);

if (!hasLocalAwsCredentials()) {
  printLocalCredentialHelp();
  process.exit(1);
}

const client = new DynamoDBClient({ region });
const documentClient = DynamoDBDocumentClient.from(client);

try {
  const table = await client.send(new DescribeTableCommand({ TableName: tableName }));
  const meta = await documentClient.send(new GetCommand({
    TableName: tableName,
    Key: {
      pk: `SEASON#${year}`,
      sk: 'META',
    },
  }));

  console.log(JSON.stringify({
    ok: true,
    region,
    table: tableName,
    year,
    tableStatus: table.Table?.TableStatus,
    seeded: Boolean(meta.Item),
    summary: meta.Item
      ? {
          year: meta.Item.year,
          rounds: meta.Item.rounds,
          results: meta.Item.results,
        }
      : null,
  }, null, 2));
} catch (error) {
  if (error instanceof ResourceNotFoundException) {
    console.error(`DynamoDB table "${tableName}" does not exist in ${region}.`);
    console.error('Run: npm run db:seed:ddb');
    process.exit(1);
  }

  if (error.name === 'CredentialsProviderError') {
    printLocalCredentialHelp();
    process.exit(1);
  }

  if (error.code === 'ENOTFOUND') {
    console.error('Could not reach DynamoDB from this environment.');
    console.error('If you are running inside Codex, this can be sandbox/network related.');
    console.error('Try the same command in your normal terminal after .env.local is filled in.');
    process.exit(1);
  }

  if (error.name === 'AccessDeniedException') {
    console.error('AWS credentials were found, but they do not have DynamoDB access.');
    console.error('');
    console.error('Attach this inline policy to IAM user f1website:');
    console.error('aws/iam/f1website-dynamodb-seed-policy.json');
    console.error('');
    console.error(`The policy must allow access to table "${tableName}" in ${region}.`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
}
