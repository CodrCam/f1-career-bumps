import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRaceArchiveReadModel,
  buildRaceDossierReadModel,
  buildResultsReadModel,
  buildStandingsReadModel,
} from './coreReadModels.js';

const season = {
  races: [
    {
      round: 1,
      grand_prix: 'Opening Grand Prix',
      date: '2026-03-01',
      circuit: 'Alpha Circuit',
      qualifying_results: [
        { position: 1, driver: 'Alex Apex', team: 'Velocity' },
        { position: 2, driver: 'Jamie Jet', team: 'Momentum' },
      ],
      race_results: [
        {
          position: 1,
          driver: 'Jamie Jet',
          team: 'Momentum',
          points: 25,
          grid: 2,
          time: '1:30:00.000',
        },
        {
          position: 2,
          driver: 'Alex Apex',
          team: 'Velocity',
          points: 18,
          grid: 1,
          time: '+3.000s',
        },
      ],
    },
    {
      round: 2,
      grand_prix: 'Second Grand Prix',
      date: '2026-03-08',
      circuit: 'Beta Circuit',
      qualifying_results: [
        { position: 1, driver: 'Alex Apex', team: 'Velocity' },
        { position: 2, driver: 'Jamie Jet', team: 'Momentum' },
      ],
      race_results: [
        {
          position: 1,
          driver: 'Alex Apex',
          team: 'Velocity',
          points: 25,
          grid: 1,
          time: '1:28:00.000',
        },
        {
          position: 2,
          driver: 'Jamie Jet',
          team: 'Momentum',
          points: 18,
          grid: 2,
          time: '+2.000s',
        },
      ],
    },
  ],
};

const summary = {
  source: 'Formula1.com',
  updatedAt: '2026-03-08T19:00:00.000Z',
};

const publication = {
  races: [
    { round: 1, state: 'published', publishedAt: '2026-03-01T19:00:00.000Z' },
    { round: 2, state: 'results_ready', lastAttemptAt: '2026-03-08T19:00:00.000Z' },
  ],
};

const analytics = {
  races: [
    { round: 1, summary: { retained_overtakes: 12 } },
  ],
};

test('standings read model includes movement, gaps, and constructor contributions', () => {
  const envelope = buildStandingsReadModel({
    year: 2026,
    season,
    summary,
    publication,
  });

  assert.equal(envelope.data.throughRound, 2);
  assert.equal(envelope.data.driverStandings[0].name, 'Alex Apex');
  assert.equal(envelope.data.driverStandings[0].movement, 1);
  assert.equal(envelope.data.driverStandings[1].gapToLeader, 0);
  assert.equal(
    envelope.data.constructorStandings
      .find((standing) => standing.name === 'Velocity')
      .drivers[0].name,
    'Alex Apex',
  );
  assert.equal(envelope.meta.state, 'results_ready');
});

test('results read model creates a driver-by-round matrix', () => {
  const envelope = buildResultsReadModel({
    year: 2026,
    season,
    summary,
    publication,
  });

  assert.equal(envelope.data.races.length, 2);
  assert.equal(envelope.data.drivers[0].results[1].position, 2);
  assert.equal(envelope.data.drivers[0].results[1].gridDelta, -1);
  assert.equal(envelope.data.drivers[0].totalPoints, 43);
});

test('race archive exposes official results while analysis is processing', () => {
  const envelope = buildRaceArchiveReadModel({
    year: 2026,
    season,
    summary,
    analytics,
    publication,
  });

  assert.equal(envelope.data.races[0].storyReady, true);
  assert.equal(envelope.data.races[1].storyReady, false);
  assert.equal(envelope.data.races[1].winner.driver, 'Alex Apex');
  assert.equal(envelope.meta.state, 'results_ready');
});

test('race dossier is useful without detailed timing and warns truthfully', () => {
  const envelope = buildRaceDossierReadModel({
    year: 2026,
    round: 2,
    season,
    summary,
    analytics: null,
    publication: publication.races[1],
  });

  assert.equal(envelope.data.classification[0].driver, 'Alex Apex');
  assert.equal(envelope.data.analysis, null);
  assert.match(envelope.meta.warnings[0], /not yet published/i);
  assert.equal(
    buildRaceDossierReadModel({ year: 2026, round: 99, season }),
    null,
  );
});
