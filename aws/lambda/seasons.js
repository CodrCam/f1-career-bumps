import {
  getDynamoCompare,
  getDynamoDriverDirectory,
  getDynamoDriverProfile,
  getDynamoPaceCatalog,
  getDynamoPitLane,
  getDynamoRaceArchive,
  getDynamoRaceAnalytics,
  getDynamoRaceDossier,
  getDynamoRaceTiming,
  getDynamoRacePublicationStatus,
  getDynamoSeason,
  getDynamoSeasonAnalytics,
  getDynamoSeasonOverview,
  getDynamoSeasonPublicationStatus,
  getDynamoSeasonResults,
  getDynamoSeasonStandings,
  getDynamoSeasonSummary,
} from './dynamoSeasonData.js';
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const response = (statusCode, body, { cacheable = statusCode === 200 } = {}) => ({
  statusCode,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': cacheable
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
  const isV2 = parts[0] === 'api' && parts[1] === 'v2';
  const year = Number(params.year ?? parts[seasonsIndex + 1]);
  const tail = parts.slice(seasonsIndex + 2);

  return {
    year,
    isV2,
    view: params.view ?? tail[0],
    driverId: params.driverId ?? (tail[0] === 'drivers' ? tail[1] : undefined),
    isV2DriverProfile: isV2 && tail[0] === 'drivers' && tail.length === 2,
    round: Number(params.round ?? (tail[0] === 'races' ? tail[1] : undefined)),
    isV2RaceDossier: isV2 && tail[0] === 'races' && tail.length === 2,
    isRaceAnalytics: tail[0] === 'races' && tail[2] === 'analytics',
    isRaceStatus: tail[0] === 'races' && tail[2] === 'status',
    isRaceTiming: isV2 && tail[0] === 'races' && tail[2] === 'timing',
  };
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;

  if (method === 'OPTIONS') {
    return response(204, {});
  }

  const {
    year,
    isV2,
    view,
    driverId,
    isV2DriverProfile,
    round,
    isV2RaceDossier,
    isRaceAnalytics,
    isRaceStatus,
    isRaceTiming,
  } = getRoute(event);

  if (method !== 'GET') {
    return response(405, { error: 'Method not allowed' });
  }

  if (!Number.isInteger(year)) {
    return response(400, { error: 'Invalid season year' });
  }

  if (
    (isV2RaceDossier || isRaceAnalytics || isRaceStatus || isRaceTiming)
    && (!Number.isInteger(round) || round < 1)
  ) {
    return response(400, { error: 'Invalid race round' });
  }

  try {
    const data = isV2 && view === 'overview'
      ? await getDynamoSeasonOverview(year)
      : isV2DriverProfile
        ? await getDynamoDriverProfile(year, driverId)
      : isV2 && view === 'drivers'
        ? await getDynamoDriverDirectory(year)
      : isV2 && view === 'compare'
        ? await getDynamoCompare(year)
      : isV2 && view === 'pace'
        ? await getDynamoPaceCatalog(year)
      : isV2 && view === 'pit-lane'
        ? await getDynamoPitLane(year)
      : isRaceTiming
        ? await getDynamoRaceTiming(year, round)
      : isV2RaceDossier
        ? await getDynamoRaceDossier(year, round)
      : isV2 && view === 'races'
        ? await getDynamoRaceArchive(year)
      : isV2 && view === 'standings'
        ? await getDynamoSeasonStandings(year)
      : isV2 && view === 'results'
        ? await getDynamoSeasonResults(year)
      : isRaceAnalytics
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
        error: isRaceTiming
          ? `No owned timing found for ${year} round ${round}`
          : isRaceAnalytics
          ? `No race analytics found for ${year} round ${round}`
          : isV2DriverProfile
            ? `No driver found for ${year}: ${driverId}`
          : isV2RaceDossier
            ? `No race found for ${year} round ${round}`
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
