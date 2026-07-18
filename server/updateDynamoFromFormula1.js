import './loadLocalEnv.js';
import { hasLocalAwsCredentials, printLocalCredentialHelp } from './awsLocalCredentials.js';
import {
  collectDhlPitStopSeason,
  mergeDhlPitStopsIntoSeason,
} from './dhlPitStopCollector.js';
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
  let season = await buildFormula1Season(year);

  if (season.races.length === 0) {
    console.log(JSON.stringify({
      year,
      updated: false,
      reason: 'No completed races found from Formula1.com',
      skipped: season.skipped,
    }, null, 2));
    continue;
  }

  try {
    const dhlSeason = await collectDhlPitStopSeason(year, {
      completedRounds: season.races.length,
    });
    season = mergeDhlPitStopsIntoSeason(season, dhlSeason);
  } catch (error) {
    console.warn(`DHL pit-stop collection skipped for ${year}: ${error.message}`);
  }

  const summary = await writeSeasonToDynamo(context, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    formula1UpdatedAt: season.updatedAt,
    dhlPitStopUpdatedAt: season.dhlPitStopUpdatedAt,
    inventory: season.inventory,
  });

  console.log(JSON.stringify({
    ...summary,
    updated: true,
    source: season.source,
    skipped: season.skipped,
  }, null, 2));
}
