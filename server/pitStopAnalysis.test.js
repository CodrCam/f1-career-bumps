import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregatePitStops,
  buildPitStopRecords,
  summarizePitStopCoverage,
} from '../src/utils/pitStopAnalysis.js';

const races = [{
  round: 1,
  grand_prix: 'Test Grand Prix',
  pit_stops: [
    {
      stop_number: 1,
      driver: 'Sergio Perez',
      driver_code: 'PER',
      team: 'Cadillac',
      lap: 20,
      time_seconds: 24.5,
    },
    {
      stop_number: 1,
      driver: 'Valtteri Bottas',
      driver_code: 'BOT',
      team: 'Cadillac',
      lap: 21,
      time_seconds: 25.1,
    },
  ],
  dhl_pit_stops: [
    {
      position: 2,
      driver: 'Perez',
      team: 'Cadillac',
      lap: 20,
      service_time_seconds: 2.4,
      points: 18,
    },
  ],
}];

test('joins DHL service time to Formula1 pit-lane time by driver and lap', () => {
  const records = buildPitStopRecords(races, { seasonYear: 2026 });
  const perez = records.find((record) => record.driver === 'Sergio Perez');

  assert.equal(records.length, 2);
  assert.equal(perez.serviceTime, 2.4);
  assert.equal(perez.pitLaneTime, 24.5);
  assert.equal(perez.transitTime, 22.1);
  assert.equal(perez.hasBreakdown, true);
});

test('keeps unmatched source records and reports honest coverage', () => {
  const records = buildPitStopRecords(races, { seasonYear: 2026 });
  const coverage = summarizePitStopCoverage(records);

  assert.equal(coverage.pitLaneStops, 2);
  assert.equal(coverage.serviceStops, 1);
  assert.equal(coverage.matchedStops, 1);
});

test('aggregates actual pit-stop measurements without forecast scoring', () => {
  const records = buildPitStopRecords(races, { seasonYear: 2026 });
  const cadillac = aggregatePitStops(records, 'team')[0];

  assert.equal(cadillac.entity, 'Cadillac');
  assert.equal(cadillac.pitLaneMedian, 24.8);
  assert.equal(cadillac.serviceMedian, 2.4);
  assert.equal(cadillac.matchedStops, 1);
});

test('folds shortened DHL team names into the official team timing table', () => {
  const records = buildPitStopRecords([
    {
      round: 1,
      grand_prix: 'Test Grand Prix',
      pit_stops: [],
      dhl_pit_stops: [
        { driver: 'Bearman', team: 'Haas', lap: 12, service_time_seconds: 8.4 },
        { driver: 'Hadjar', team: 'Red Bull', lap: 18, service_time_seconds: 7.9 },
      ],
    },
  ], { seasonYear: 2026 });

  assert.deepEqual(
    aggregatePitStops(records, 'team').map((entry) => entry.entity).sort(),
    ['Haas F1 Team', 'Red Bull Racing'],
  );
});
