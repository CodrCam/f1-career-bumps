import './loadLocalEnv.js';
import { hasLocalAwsCredentials, printLocalCredentialHelp } from './awsLocalCredentials.js';
import { getDynamoContext, writeSeasonToDynamo } from './dynamoSeasonWriter.js';
import { buildFormula1Season } from './formula1SeasonBuilder.js';

if (!hasLocalAwsCredentials()) {
  printLocalCredentialHelp();
  process.exit(1);
}

const years = process.argv.slice(2).map(Number).filter(Number.isInteger);
const targetYears = years.length > 0 ? years : [new Date().getFullYear()];
const context = getDynamoContext();

for (const year of targetYears) {
  const season = await buildFormula1Season(year);

  if (season.races.length === 0) {
    console.log(JSON.stringify({
      year,
      updated: false,
      reason: 'No completed races found from Formula1.com',
      skipped: season.skipped,
    }, null, 2));
    continue;
  }

  const summary = await writeSeasonToDynamo(context, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    formula1UpdatedAt: season.updatedAt,
    inventory: season.inventory,
  });

  console.log(JSON.stringify({
    ...summary,
    updated: true,
    source: season.source,
    skipped: season.skipped,
  }, null, 2));
}
