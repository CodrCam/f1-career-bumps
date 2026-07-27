const numericPoints = (value) => {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
};

const sortStandings = (entries) => (
  entries.sort((left, right) => (
    right.points - left.points || left.name.localeCompare(right.name)
  ))
);

export const accumulateStandings = (races) => {
  const drivers = new Map();
  const constructors = new Map();

  races.forEach((race) => {
    [...(race.race_results ?? []), ...(race.sprint_results ?? [])].forEach((result) => {
      const points = numericPoints(result.points);
      const driverName = result.driver ?? result.driver_code;
      const teamName = result.team;

      if (driverName) {
        const current = drivers.get(driverName) ?? {
          name: driverName,
          code: result.driver_code,
          team: teamName,
          points: 0,
        };
        current.points += points;
        current.code = result.driver_code ?? current.code;
        current.team = teamName ?? current.team;
        drivers.set(driverName, current);
      }

      if (teamName) {
        const current = constructors.get(teamName) ?? {
          name: teamName,
          points: 0,
        };
        current.points += points;
        constructors.set(teamName, current);
      }
    });
  });

  return {
    drivers: sortStandings([...drivers.values()]),
    constructors: sortStandings([...constructors.values()]),
  };
};

export const withRankMovement = (current, previous) => {
  const previousRank = new Map(previous.map((entry, index) => [entry.name, index + 1]));

  return current.map((entry, index) => {
    const rank = index + 1;
    const priorRank = previousRank.get(entry.name);

    return {
      ...entry,
      rank,
      movement: priorRank ? priorRank - rank : null,
      gapToLeader: index === 0 ? 0 : current[0].points - entry.points,
      gapToAhead: index === 0 ? null : current[index - 1].points - entry.points,
    };
  });
};

const uniqueSources = (sources) => [...new Set(sources.filter(Boolean))];

export const buildSeasonOverview = ({
  year,
  season,
  summary,
  analytics,
  publication,
} = {}) => {
  const races = [...(season?.races ?? [])].sort((a, b) => a.round - b.round);
  const latestRace = races.at(-1);
  const previousRaces = latestRace ? races.slice(0, -1) : [];
  const currentStandings = accumulateStandings(races);
  const previousStandings = accumulateStandings(previousRaces);
  const statusByRound = new Map(
    (publication?.races ?? []).map((status) => [Number(status.round), status]),
  );
  const analyticsByRound = new Map(
    (analytics?.races ?? []).map((race) => [Number(race.round), race]),
  );
  const latestStatus = latestRace ? statusByRound.get(Number(latestRace.round)) : null;
  const latestAnalytics = latestRace ? analyticsByRound.get(Number(latestRace.round)) : null;
  const latestGridByDriver = new Map(
    (latestRace?.starting_grid ?? []).map((result) => [
      result.driver_code ?? result.driver,
      Number(result.position),
    ]),
  );
  const publishedRounds = (analytics?.races ?? []).map((race) => Number(race.round));
  const seasonUpdatedAt = summary?.updatedAt ?? season?.updatedAt;
  const publicationUpdatedAt = latestStatus?.updatedAt
    ?? latestStatus?.lastAttemptAt
    ?? latestAnalytics?.updatedAt;
  const publishedAt = publicationUpdatedAt ?? seasonUpdatedAt ?? new Date().toISOString();
  const state = latestStatus?.state
    ?? (latestAnalytics ? 'published' : latestRace ? 'results_ready' : 'scheduled');
  const sourceCoverage = latestStatus?.sourceCoverage ?? {};

  return {
    data: {
      year: Number(year),
      completedRounds: races.length,
      resultsCount: summary?.results,
      latestRace: latestRace
        ? {
          round: Number(latestRace.round),
          grandPrix: latestRace.grand_prix,
          date: latestRace.date,
          circuit: latestRace.circuit,
          state,
          podium: (latestRace.race_results ?? []).slice(0, 3).map((result) => ({
            position: Number(result.position),
            driver: result.driver,
            code: result.driver_code,
            team: result.team,
            points: numericPoints(result.points),
            grid: Number.isFinite(Number(result.grid))
              ? Number(result.grid)
              : latestGridByDriver.get(result.driver_code ?? result.driver) ?? null,
          })),
          storySummary: latestAnalytics?.summary ?? null,
          updatedAt: publicationUpdatedAt ?? seasonUpdatedAt,
        }
        : null,
      driverStandings: withRankMovement(
        currentStandings.drivers,
        previousStandings.drivers,
      ),
      constructorStandings: withRankMovement(
        currentStandings.constructors,
        previousStandings.constructors,
      ),
      coverage: {
        completedRounds: races.length,
        storyReadyRounds: publishedRounds.length,
        publishedRounds,
        incompleteRounds: races
          .filter((race) => !analyticsByRound.has(Number(race.round)))
          .map((race) => ({
            round: Number(race.round),
            grandPrix: race.grand_prix,
            state: statusByRound.get(Number(race.round))?.state ?? 'results_ready',
          })),
      },
    },
    meta: {
      season: Number(year),
      schemaVersion: '2.0',
      contentVersion: latestStatus?.contentVersion
        ?? `season-${year}-${seasonUpdatedAt ?? races.length}`,
      state,
      publishedAt,
      sources: uniqueSources([
        summary?.source,
        sourceCoverage.formula1Official === 'ready' ? 'Formula1.com' : null,
        sourceCoverage.openF1 === 'ready' ? 'OpenF1' : null,
        sourceCoverage.fastF1 === 'ready' ? 'FastF1' : null,
        sourceCoverage.dhlPitService === 'ready' ? 'DHL Fastest Pit Stop' : null,
      ]),
      warnings: latestStatus?.missingCapabilities ?? [],
    },
  };
};
