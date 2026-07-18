import { getTeamKeyByName } from '../data/seasonGrid.js';

const getLatestFiniteValue = (values = []) => (
  [...values].reverse().find((value) => Number.isFinite(value))
);

export const getLatestConstructorStandings = (chartData) => {
  const standings = (chartData?.datasets ?? [])
    .map((dataset) => ({
      label: dataset.label,
      position: getLatestFiniteValue(dataset.data),
      points: getLatestFiniteValue(dataset.points),
      teamKey: getTeamKeyByName(dataset.label),
    }))
    .filter(({ position, teamKey }) => Number.isFinite(position) && teamKey)
    .sort((a, b) => a.position - b.position);

  return standings.map((standing, index) => ({
    ...standing,
    gapToAhead: index === 0 || !Number.isFinite(standing.points)
      ? null
      : standings[index - 1].points - standing.points,
    gapToLeader: index === 0 || !Number.isFinite(standing.points)
      ? 0
      : standings[0].points - standing.points,
    leadOverNext: index === 0 && Number.isFinite(standings[1]?.points)
      ? standing.points - standings[1].points
      : null,
  }));
};

export const getLatestDriverStandings = (chartData) => {
  const standings = (chartData?.datasets ?? [])
    .map((dataset) => ({
      code: dataset.label?.split(/\s+/).at(-1)?.slice(0, 3).toUpperCase(),
      label: dataset.label,
      points: getLatestFiniteValue(dataset.data),
      team: dataset.team,
      teamKey: getTeamKeyByName(dataset.team),
    }))
    .filter(({ points, teamKey }) => Number.isFinite(points) && teamKey)
    .sort((a, b) => b.points - a.points);

  return standings.map((standing, index) => ({
    ...standing,
    championshipPosition: index + 1,
    gapToAhead: index === 0
      ? null
      : standings[index - 1].points - standing.points,
    gapToLeader: index === 0
      ? 0
      : standings[0].points - standing.points,
    leadOverNext: index === 0 && Number.isFinite(standings[1]?.points)
      ? standing.points - standings[1].points
      : null,
  }));
};
