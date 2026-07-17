import { buildFormula1Season } from './formula1SeasonBuilder.js';
import { getDynamoContext, writeSeasonToDynamo } from './dynamoSeasonWriter.js';

export const handler = async (event = {}) => {
  const year = Number(event.year ?? process.env.UPDATE_SEASON_YEAR ?? new Date().getFullYear());
  const season = await buildFormula1Season(year);
  const context = getDynamoContext();

  if (season.races.length === 0) {
    return {
      ok: false,
      year,
      reason: 'No completed races found from Formula1.com',
      skipped: season.skipped,
    };
  }

  const summary = await writeSeasonToDynamo(context, year, season.races, {
    source: season.source,
    sourceUrl: season.sourceUrl,
    skipped: season.skipped,
    formula1UpdatedAt: season.updatedAt,
    inventory: season.inventory,
  });

  return {
    ok: true,
    ...summary,
    skipped: season.skipped,
  };
};
