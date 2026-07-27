import {
  getDynamoRaceAnalytics,
  getDynamoRacePublicationStatus,
  getDynamoSeason,
  getDynamoSeasonAnalytics,
  getDynamoSeasonPublicationStatus,
  getDynamoSeasonSummary,
} from './dynamoSeasonData.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': statusCode === 200
      ? 'public, max-age=30, stale-while-revalidate=300'
      : 'no-store',
  },
  body: JSON.stringify(body),
});

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

const getPathParts = (event) => {
  const path = event.rawPath ?? event.path ?? '';
  return path.split('/').filter(Boolean);
};

const getRoute = (event) => {
  const params = event.pathParameters ?? {};
  const parts = getPathParts(event);
  const seasonsIndex = parts.indexOf('seasons');
  const year = Number(params.year ?? parts[seasonsIndex + 1]);
  const tail = parts.slice(seasonsIndex + 2);

  return {
    year,
    view: params.view ?? tail[0],
    round: Number(params.round ?? (tail[0] === 'races' ? tail[1] : undefined)),
    isRaceAnalytics: tail[0] === 'races' && tail[2] === 'analytics',
    isRaceStatus: tail[0] === 'races' && tail[2] === 'status',
  };
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;

  if (method === 'OPTIONS') {
    return response(204, {});
  }

  if (method !== 'GET') {
    return response(405, { error: 'Method not allowed' });
  }

  const {
    year,
    view,
    round,
    isRaceAnalytics,
    isRaceStatus,
  } = getRoute(event);

  if (!Number.isInteger(year)) {
    return response(400, { error: 'Invalid season year' });
  }

  if ((isRaceAnalytics || isRaceStatus) && (!Number.isInteger(round) || round < 1)) {
    return response(400, { error: 'Invalid race round' });
  }

  try {
    const data = isRaceAnalytics
      ? await getDynamoRaceAnalytics(year, round)
      : isRaceStatus
        ? await getDynamoRacePublicationStatus(year, round)
      : view === 'summary'
        ? await getDynamoSeasonSummary(year)
        : view === 'status'
          ? await getDynamoSeasonPublicationStatus(year)
        : view === 'analytics'
          ? await getDynamoSeasonAnalytics(year)
        : await getDynamoSeason(year);

    if (!data) {
      return response(404, {
        error: isRaceAnalytics
          ? `No race analytics found for ${year} round ${round}`
          : isRaceStatus
            ? `No race publication status found for ${year} round ${round}`
          : `No season data found for ${year}`,
      });
    }

    return response(200, normalizeSeasonTeams(data, year));
  } catch (error) {
    console.error(error);
    return response(500, { error: 'Unexpected data store error' });
  }
};
