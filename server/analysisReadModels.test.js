import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCompareReadModel,
  buildDriverDirectoryReadModel,
  buildDriverProfileReadModel,
  buildPaceCatalogReadModel,
  buildPitLaneReadModel,
} from './analysisReadModels.js';

const season = {
  races: [
    {
      round: 1,
      grand_prix: 'Opening Grand Prix',
      qualifying_results: [
        { position: 1, driver: 'Alex Apex', team: 'Velocity' },
        { position: 2, driver: 'Jamie Jet', team: 'Velocity' },
      ],
      race_results: [
        { position: 1, driver: 'Alex Apex', team: 'Velocity', points: 25, grid: 1 },
        { position: 2, driver: 'Jamie Jet', team: 'Velocity', points: 18, grid: 2 },
      ],
      pit_stops: [
        { driver: 'Alex Apex', team: 'Velocity', lap: 20, time_seconds: 21 },
      ],
      dhl_pit_stops: [
        {
          driver: 'Alex Apex',
          driver_full_name: 'Alex Apex',
          team: 'Velocity',
          lap: 20,
          service_time_seconds: 2.2,
        },
      ],
    },
    {
      round: 2,
      grand_prix: 'Second Grand Prix',
      qualifying_results: [
        { position: 1, driver: 'Jamie Jet', team: 'Velocity' },
        { position: 2, driver: 'Alex Apex', team: 'Velocity' },
      ],
      race_results: [
        { position: 1, driver: 'Jamie Jet', team: 'Velocity', points: 25, grid: 1 },
        {
          position: 2,
          driver: 'Alex Apex',
          team: 'Velocity',
          points: 18,
          grid: 2,
          status: 'Finished',
        },
      ],
    },
  ],
};

const summary = { source: 'Formula1.com', updatedAt: '2026-03-08T18:00:00Z' };
const publication = {
  races: [
    { round: 1, state: 'published' },
    { round: 2, state: 'results_ready' },
  ],
};

test('builds driver directory metrics, form, and teammate context', () => {
  const envelope = buildDriverDirectoryReadModel({
    year: 2026,
    season,
    summary,
    publication,
  });

  assert.equal(envelope.data.drivers.length, 2);
  assert.equal(envelope.data.drivers[0].points, 43);
  assert.equal(envelope.data.drivers[0].recentForm.length, 2);
  assert.deepEqual(envelope.data.drivers[0].teammates, ['Jamie Jet']);
  assert.equal(envelope.meta.schemaVersion, '2.0');
});

test('builds an addressable driver profile and comparison sample', () => {
  const profile = buildDriverProfileReadModel({
    year: 2026,
    driverId: 'alex-apex',
    season,
    summary,
    publication,
  });
  const comparison = buildCompareReadModel({
    year: 2026,
    season,
    summary,
    publication,
  });

  assert.equal(profile.data.driver.name, 'Alex Apex');
  assert.equal(profile.data.teammate.name, 'Jamie Jet');
  assert.equal(comparison.data.drivers.length, 2);
  assert.equal(buildDriverProfileReadModel({
    year: 2026,
    driverId: 'missing',
    season,
  }), null);
});

test('builds pace availability and pit-lane source distinctions', () => {
  const pace = buildPaceCatalogReadModel({
    year: 2026,
    season,
    summary,
    analytics: { races: [{ round: 1 }] },
    publication,
  });
  const pitLane = buildPitLaneReadModel({
    year: 2026,
    season,
    summary,
    publication,
  });

  assert.equal(pace.data.races[0].detailedTimingReady, true);
  assert.equal(pace.data.races[1].detailedTimingReady, false);
  assert.equal(pitLane.data.records[0].serviceTime, 2.2);
  assert.equal(pitLane.data.records[0].pitLaneTime, 21);
  assert.equal(pitLane.data.records[0].transitTime, 18.8);
});
