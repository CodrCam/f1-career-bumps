export const RACE_PUBLICATION_SCHEMA_VERSION = 1;

export const RACE_PUBLICATION_STATES = Object.freeze([
  'scheduled',
  'awaiting_results',
  'results_ready',
  'awaiting_timing',
  'timing_ready',
  'published',
  'degraded',
  'failed',
]);

const publicationStateSet = new Set(RACE_PUBLICATION_STATES);

const uniqueStrings = (values = []) => (
  [...new Set(values.filter(Boolean).map(String))]
);

const requireWholeNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return number;
};

export const buildRacePublicationStatus = ({
  year,
  round,
  grandPrix,
  state,
  sourceCoverage = {},
  missingCapabilities = [],
  lastAttemptAt = new Date().toISOString(),
  nextAttemptAt,
  publishedAt,
  contentVersion,
  lastErrorCode,
  lastErrorSummary,
} = {}) => {
  if (!publicationStateSet.has(state)) {
    throw new Error(`Unknown race publication state: ${state}`);
  }

  const normalizedYear = requireWholeNumber(year, 'Year');
  const normalizedRound = requireWholeNumber(round, 'Round');

  return {
    schemaVersion: RACE_PUBLICATION_SCHEMA_VERSION,
    year: normalizedYear,
    round: normalizedRound,
    grandPrix: grandPrix ? String(grandPrix) : `Round ${normalizedRound}`,
    state,
    sourceCoverage,
    missingCapabilities: uniqueStrings(missingCapabilities),
    lastAttemptAt,
    nextAttemptAt,
    publishedAt,
    contentVersion,
    lastErrorCode,
    lastErrorSummary,
  };
};

export const missingDetailedTimingCapabilities = (capabilityMatrix = []) => (
  capabilityMatrix
    .filter((entry) => !(entry.owned_recorder ?? entry.detailed_timing))
    .map((entry) => entry.capability)
);

export const publicRacePublicationStatus = (item) => {
  if (!item) return null;

  const {
    pk: _pk,
    sk: _sk,
    itemType: _itemType,
    ...status
  } = item;

  return status;
};

export const auditRacePublication = ({
  completedRaces = [],
  analyticsRaces = [],
  publicationStatuses = [],
} = {}) => {
  const analyticsRounds = new Set(analyticsRaces.map((race) => Number(race.round)));
  const statusByRound = new Map(
    publicationStatuses.map((status) => [Number(status.round), status]),
  );
  const completeStates = new Set(['published']);

  const races = completedRaces
    .map((race) => {
      const round = Number(race.round);
      const status = statusByRound.get(round);
      const hasAnalytics = analyticsRounds.has(round);
      const state = status?.state ?? (hasAnalytics ? 'published_legacy' : 'missing');

      return {
        round,
        grandPrix: race.grand_prix ?? status?.grandPrix ?? `Round ${round}`,
        state,
        hasAnalytics,
        lastAttemptAt: status?.lastAttemptAt,
      };
    })
    .sort((a, b) => a.round - b.round);

  return {
    completed: races.length,
    published: races
      .filter((race) => completeStates.has(race.state) || race.state === 'published_legacy')
      .map((race) => race.round),
    incomplete: races
      .filter((race) => !completeStates.has(race.state) && race.state !== 'published_legacy')
      .map((race) => ({
        round: race.round,
        grandPrix: race.grandPrix,
        state: race.state,
      })),
    races,
  };
};
