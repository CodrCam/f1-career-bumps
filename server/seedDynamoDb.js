import './loadLocalEnv.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasLocalAwsCredentials, printLocalCredentialHelp } from './awsLocalCredentials.js';
import { getDynamoContext, writeSeasonToDynamo } from './dynamoSeasonWriter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const seedPath = path.join(projectRoot, 'src', 'data', 'f1_2025_season.json');

if (!hasLocalAwsCredentials()) {
  printLocalCredentialHelp();
  process.exit(1);
}

const seedDynamoDb = async (year = 2025) => {
  const seed = JSON.parse(await readFile(seedPath, 'utf8'));
  const context = getDynamoContext();
  const summary = await writeSeasonToDynamo(context, year, seed.races, {
    source: 'local-json-seed',
  });

  console.log(JSON.stringify(summary, null, 2));
};

const year = Number(process.argv[2] ?? 2025);
await seedDynamoDb(year);
