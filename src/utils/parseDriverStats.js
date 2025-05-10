// src/utils/parseDriverStats.js

export function parseDriverStats(f1Data) {
  const drivers = new Map();
  const rounds = f1Data.races || [];

  rounds.forEach(round => {
    const { qualifying_results, race_results, sprint_results } = round;

    race_results.forEach(({ driver, team, points, position }) => {
      if (!drivers.has(driver)) {
        drivers.set(driver, {
          points: 0,
          finishes: [],
          qualis: [],
          teams: [],
          heads: {},
          raceTeamHistory: []
        });
      }
      const d = drivers.get(driver);
      d.points += points;
      d.finishes.push(position);
      d.teams.push(team);
      d.raceTeamHistory.push({ round: round.round, team });
    });

    qualifying_results.forEach(({ driver, position, team }) => {
      if (!drivers.has(driver)) {
        drivers.set(driver, {
          points: 0,
          finishes: [],
          qualis: [],
          teams: [],
          heads: {},
          raceTeamHistory: []
        });
      }
      const d = drivers.get(driver);
      d.qualis.push(position);
      d.teams.push(team);
    });

    sprint_results?.forEach(({ driver, team, points }) => {
      if (!drivers.has(driver)) {
        drivers.set(driver, {
          points: 0,
          finishes: [],
          qualis: [],
          teams: [],
          heads: {},
          raceTeamHistory: []
        });
      }
      const d = drivers.get(driver);
      d.points += points;
      d.teams.push(team);
    });
  });

  // Calculate head-to-head
  const teamDrivers = {};
  for (const [name, data] of drivers.entries()) {
    const primaryTeam = getPrimaryTeam(data.teams);
    if (!teamDrivers[primaryTeam]) teamDrivers[primaryTeam] = [];
    teamDrivers[primaryTeam].push(name);
  }

  rounds.forEach(round => {
    const resultMap = {};
    round.race_results?.forEach(({ driver, position }) => {
      resultMap[driver] = position;
    });
    Object.entries(teamDrivers).forEach(([team, [d1, d2]]) => {
      if (!d1 || !d2 || !(d1 in resultMap) || !(d2 in resultMap)) return;
      const p1 = resultMap[d1];
      const p2 = resultMap[d2];
      if (!drivers.get(d1).heads[d2]) drivers.get(d1).heads[d2] = 0;
      if (!drivers.get(d2).heads[d1]) drivers.get(d2).heads[d1] = 0;
      if (p1 < p2) drivers.get(d1).heads[d2] += 1;
      else if (p2 < p1) drivers.get(d2).heads[d1] += 1;
    });
  });

  function getPrimaryTeam(teams) {
    const freq = {};
    for (const t of teams) freq[t] = (freq[t] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }

  const allStats = Array.from(drivers.entries()).map(([name, data]) => {
    const { points, finishes, qualis, heads, teams } = data;
    const avgFinish = finishes.length ? (finishes.reduce((a, b) => a + b, 0) / finishes.length) : null;
    const avgQuali = qualis.length ? (qualis.reduce((a, b) => a + b, 0) / qualis.length) : null;

    const headOpponents = Object.keys(heads);
    const headWins = headOpponents.length ? Object.values(heads).reduce((a, b) => a + b, 0) : 0;

    const primaryTeam = getPrimaryTeam(teams);

    return {
      name,
      team: primaryTeam,
      teamHistory: teams,
      points,
      avgFinish,
      avgQuali,
      headWins,
    };
  });

  // Normalize & Weight
  const normalize = (arr, inverse = false) => {
    const vals = arr.map(v => (v ?? 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return arr.map(v => {
      if (v == null || max === min) return 0.5; // fallback
      const ratio = (v - min) / (max - min);
      return inverse ? 1 - ratio : ratio;
    });
  };

  const normalizedPoints = normalize(allStats.map(d => d.points));
  const normalizedQuali = normalize(allStats.map(d => d.avgQuali), true);
  const normalizedFinish = normalize(allStats.map(d => d.avgFinish), true);
  const normalizedHead = normalize(allStats.map(d => d.headWins));

  return allStats.map((d, i) => {
    const composite =
      normalizedPoints[i] * 0.4 +
      normalizedQuali[i] * 0.2 +
      normalizedFinish[i] * 0.25 +
      normalizedHead[i] * 0.15;

    return {
      ...d,
      normPoints: normalizedPoints[i],
      normQuali: normalizedQuali[i],
      normFinish: normalizedFinish[i],
      normHead: normalizedHead[i],
      composite,
    };
  });
}