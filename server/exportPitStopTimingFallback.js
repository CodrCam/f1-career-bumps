import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  collectDhlPitStopSeason,
  mergeDhlPitStopsIntoSeason,
} from './dhlPitStopCollector.js';
import {
  buildFormula1Race,
  getFormula1SeasonRaceList,
} from './formula1SeasonBuilder.js';

const { values } = parseArgs({
  options: {
    year: { type: 'string', short: 'y' },
    rounds: { type: 'string', short: 'r' },
    output: { type: 'string', short: 'o' },
  },
});

const year = Number(values.year);
const requestedRounds = values.rounds ? Number(values.rounds) : null;

if (!Number.isInteger(year) || (requestedRounds !== null && !Number.isInteger(requestedRounds))) {
  throw new Error('Provide a whole-number --year and optional --rounds.');
}

const raceList = await getFormula1SeasonRaceList(year);
const roundCount = requestedRounds === null
  ? raceList.length
  : Math.min(requestedRounds, raceList.length);
const races = [];

for (const raceInfo of raceList.slice(0, roundCount)) {
  const race = await buildFormula1Race(year, raceInfo.round);
  if (race.race_results.length > 0) races.push(race);
}

const dhlSeason = await collectDhlPitStopSeason(year, {
  completedRounds: races.length,
});
const enriched = mergeDhlPitStopsIntoSeason({ races }, dhlSeason);
const payload = {
  year,
  generated_at: new Date().toISOString(),
  formula1_source: `https://www.formula1.com/en/results/${year}/races`,
  dhl_source: dhlSeason.source_url,
  races: enriched.races.map((race) => ({
    round: race.round,
    grand_prix: race.grand_prix,
    circuit: race.circuit,
    pit_stops: race.pit_stops,
    dhl_pit_stops: race.dhl_pit_stops,
    pit_stop_sources: race.pit_stop_sources,
  })),
};
const outputPath = resolve(
  values.output ?? `src/data/pitStopTiming${year}.json`,
);

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({
  output: outputPath,
  year,
  rounds: payload.races.length,
  pitLaneStops: payload.races.reduce((sum, race) => sum + race.pit_stops.length, 0),
  dhlStops: payload.races.reduce((sum, race) => sum + (race.dhl_pit_stops?.length ?? 0), 0),
}, null, 2));
