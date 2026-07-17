import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const projectRoot = resolve(import.meta.dirname, '..');
const roots = [
  resolve(projectRoot, '.data/raw'),
  resolve(projectRoot, '.data/raw/raw'),
];

const snapshotPath = (root, year, round, source) => resolve(
  root,
  String(year),
  `round-${String(round).padStart(2, '0')}`,
  source,
  'latest.json.gz',
);

const readSnapshot = async (year, round, source) => {
  for (const root of roots) {
    try {
      const compressed = await readFile(snapshotPath(root, year, round, source));
      return JSON.parse(gunzipSync(compressed).toString('utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return null;
};

const readValidatedAnalytics = async (year, round) => {
  const [analytics, validation] = await Promise.all([
    readSnapshot(year, round, 'derived-analytics'),
    readSnapshot(year, round, 'source-validation'),
  ]);

  return { analytics, validation };
};

const toRaceAnalyticsResponse = (analytics, validation) => {
  if (!analytics) return null;

  return {
    schemaVersion: analytics.schema_version,
    calculationVersion: analytics.calculation_version,
    year: analytics.year,
    round: analytics.round,
    session: analytics.session,
    summary: analytics.summary,
    definitions: analytics.definitions,
    validationStatus: validation?.status ?? 'unknown',
    validation,
    rawSnapshots: null,
    updatedAt: analytics.calculated_at,
    circuitProfile: analytics.circuit_profile,
    overtakeEvents: analytics.overtake_events ?? [],
    storyEvents: analytics.story_events ?? [],
    trafficSegments: analytics.traffic_segments ?? [],
    pitCycleEvents: analytics.pit_cycle_events ?? [],
    attritionEvents: analytics.attrition_events ?? [],
    disruptionEvents: analytics.disruption_events ?? [],
    drivers: analytics.drivers ?? [],
    dataStore: 'local-snapshot',
  };
};

export const createLocalRaceAnalyticsReader = () => ({
  async getRaceAnalytics(year, round) {
    const { analytics, validation } = await readValidatedAnalytics(year, round);
    if (validation?.status === 'fail') return null;
    return toRaceAnalyticsResponse(analytics, validation);
  },

  async getSeasonAnalytics(year) {
    const snapshots = await Promise.all(
      Array.from({ length: 30 }, (_, index) => readValidatedAnalytics(year, index + 1)),
    );

    return {
      year,
      races: snapshots
        .filter(({ analytics, validation }) => analytics && validation?.status !== 'fail')
        .sort((a, b) => a.analytics.round - b.analytics.round)
        .map(({ analytics, validation }) => ({
          year: analytics.year,
          round: analytics.round,
          session: analytics.session,
          summary: analytics.summary,
          circuitProfile: analytics.circuit_profile,
          validationStatus: validation?.status ?? 'unknown',
          updatedAt: analytics.calculated_at,
        })),
      dataStore: 'local-snapshot',
    };
  },
});
