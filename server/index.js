import cors from 'cors';
import express from 'express';
import './loadLocalEnv.js';
import { hasLocalAwsCredentials } from './awsLocalCredentials.js';
import { createDynamoSeasonReader } from './dynamoSeasonReader.js';
import { createF1Database } from './f1Database.js';
import { createLocalRaceAnalyticsReader } from './localRaceAnalyticsReader.js';
import {
  buildRaceArchiveReadModel,
  buildRaceDossierReadModel,
  buildResultsReadModel,
  buildStandingsReadModel,
} from './coreReadModels.js';
import {
  buildCompareReadModel,
  buildDriverDirectoryReadModel,
  buildDriverProfileReadModel,
  buildPaceCatalogReadModel,
  buildPitLaneReadModel,
} from './analysisReadModels.js';
import { buildSeasonOverview } from './seasonOverview.js';

const port = Number(process.env.PORT ?? 3001);
const app = express();
const useDynamo = Boolean(process.env.DYNAMODB_TABLE) && hasLocalAwsCredentials();
const database = useDynamo ? null : await createF1Database();
const dynamoReader = useDynamo ? createDynamoSeasonReader() : null;
const analyticsReader = dynamoReader ?? createLocalRaceAnalyticsReader();
const audiTeamPattern = /\b(sauber|kick|stake)\b/i;
const resultKeys = ['race_results', 'qualifying_results', 'sprint_results', 'sprint_qualifying_results'];

const normalizeTeamName = (teamName, year) => (
  Number(year) >= 2026 && audiTeamPattern.test(teamName ?? '') ? 'Audi' : teamName
);

const normalizeSeasonTeams = (season, year) => {
  if (!season?.races) return season;

  return {
    ...season,
    races: season.races.map((race) => {
      const normalizedRace = { ...race };

      resultKeys.forEach((key) => {
        if (!Array.isArray(normalizedRace[key])) return;

        normalizedRace[key] = normalizedRace[key].map((result) => ({
          ...result,
          team: normalizeTeamName(result.team, year),
        }));
      });

      return normalizedRace;
    }),
  };
};

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, dataSource: useDynamo ? 'dynamodb' : 'sqlite' });
});

app.get('/api/v2/seasons/:year/overview', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const season = useDynamo
      ? await dynamoReader.getSeason(year)
      : database.getSeason(year);

    if (!season) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }

    const [summary, analytics, publication] = await Promise.all([
      useDynamo
        ? dynamoReader.getSeasonSummary(year)
        : database.getSeasonSummary(year),
      analyticsReader.getSeasonAnalytics(year),
      analyticsReader.getSeasonPublicationStatus(year),
    ]);

    res.json(buildSeasonOverview({
      year,
      season,
      summary,
      analytics,
      publication,
    }));
  } catch (error) {
    next(error);
  }
});

const getSeasonData = async (year) => {
  const season = useDynamo
    ? await dynamoReader.getSeason(year)
    : database.getSeason(year);
  if (!season) return null;

  const [summary, analytics, publication] = await Promise.all([
    useDynamo
      ? dynamoReader.getSeasonSummary(year)
      : database.getSeasonSummary(year),
    analyticsReader.getSeasonAnalytics(year),
    analyticsReader.getSeasonPublicationStatus(year),
  ]);

  return {
    season: normalizeSeasonTeams(season, year),
    summary,
    analytics,
    publication,
  };
};

app.get('/api/v2/seasons/:year/standings', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildStandingsReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/results', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildResultsReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/races', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildRaceArchiveReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/races/:round', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const round = Number(req.params.round);
    if (!Number.isInteger(year) || !Number.isInteger(round) || round < 1) {
      res.status(400).json({ error: 'Invalid season year or race round' });
      return;
    }

    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    const [raceAnalytics, racePublication] = await Promise.all([
      analyticsReader.getRaceAnalytics(year, round),
      analyticsReader.getRacePublicationStatus(year, round),
    ]);
    const dossier = buildRaceDossierReadModel({
      year,
      round,
      season: source.season,
      summary: source.summary,
      analytics: raceAnalytics,
      publication: racePublication,
    });
    if (!dossier) {
      res.status(404).json({ error: `No race found for ${year} round ${round}` });
      return;
    }
    res.json(dossier);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/drivers', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildDriverDirectoryReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/drivers/:driverId', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    const profile = buildDriverProfileReadModel({
      year,
      driverId: req.params.driverId,
      ...source,
    });
    if (!profile) {
      res.status(404).json({ error: `No driver found for ${year}: ${req.params.driverId}` });
      return;
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/compare', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildCompareReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/pace', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildPaceCatalogReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/v2/seasons/:year/pit-lane', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const source = await getSeasonData(year);
    if (!source) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }
    res.json(buildPitLaneReadModel({ year, ...source }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const season = useDynamo
      ? await dynamoReader.getSeason(year)
      : database.getSeason(year);

    if (!season) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }

    res.json(normalizeSeasonTeams(season, year));
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year/summary', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const summary = useDynamo
      ? await dynamoReader.getSeasonSummary(year)
      : database.getSeasonSummary(year);

    if (!summary) {
      res.status(404).json({ error: `No season data found for ${year}` });
      return;
    }

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year/analytics', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const analytics = await analyticsReader.getSeasonAnalytics(year);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year/status', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const status = await analyticsReader.getSeasonPublicationStatus(year);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year/races/:round/analytics', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const round = Number(req.params.round);

    if (!Number.isInteger(year) || !Number.isInteger(round) || round < 1) {
      res.status(400).json({ error: 'Invalid season year or race round' });
      return;
    }

    const analytics = await analyticsReader.getRaceAnalytics(year, round);

    if (!analytics) {
      res.status(404).json({ error: `No race analytics found for ${year} round ${round}` });
      return;
    }

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

app.get('/api/seasons/:year/races/:round/status', async (req, res, next) => {
  try {
    const year = Number(req.params.year);
    const round = Number(req.params.round);

    if (!Number.isInteger(year) || !Number.isInteger(round) || round < 1) {
      res.status(400).json({ error: 'Invalid season year or race round' });
      return;
    }

    const status = await analyticsReader.getRacePublicationStatus(year, round);

    if (!status) {
      res.status(404).json({
        error: `No race publication status found for ${year} round ${round}`,
      });
      return;
    }

    res.json(status);
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/seed/:year', async (req, res, next) => {
  try {
    if (useDynamo) {
      res.status(400).json({ error: 'Local seed endpoint is only available for the SQLite fallback.' });
      return;
    }

    const year = Number(req.params.year);
    await database.reseed(year);
    res.json(database.getSeasonSummary(year));
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected backend error' });
});

const server = app.listen(port, () => {
  console.log(`F1 backend listening on http://localhost:${port} (${useDynamo ? 'DynamoDB' : 'SQLite'} data source)`);
});

const shutdown = async () => {
  if (database) {
    await database.save();
    database.close();
  }
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
