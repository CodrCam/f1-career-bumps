import { getTeamKeyByName } from '../data/seasonGrid.js';

const getLatestFiniteValue = (values = []) => (
  [...values].reverse().find((value) => Number.isFinite(value))
);

export const getLatestConstructorStandings = (chartData) => (
  (chartData?.datasets ?? [])
    .map((dataset) => ({
      label: dataset.label,
      position: getLatestFiniteValue(dataset.data),
      teamKey: getTeamKeyByName(dataset.label),
    }))
    .filter(({ position, teamKey }) => Number.isFinite(position) && teamKey)
    .sort((a, b) => a.position - b.position)
);

export const getLatestDriverStandings = (chartData) => (
  (chartData?.datasets ?? [])
    .map((dataset) => ({
      code: dataset.label?.split(/\s+/).at(-1)?.slice(0, 3).toUpperCase(),
      label: dataset.label,
      points: getLatestFiniteValue(dataset.data),
      teamKey: getTeamKeyByName(dataset.team),
    }))
    .filter(({ points, teamKey }) => Number.isFinite(points) && teamKey)
    .sort((a, b) => b.points - a.points)
);
