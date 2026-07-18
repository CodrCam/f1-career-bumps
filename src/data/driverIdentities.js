const DRIVER_MARKS = {
  2025: {
    'alexander albon': ['Alexander Albon', 'alexander-albon.webp', 23, 'Williams'],
    'fernando alonso': ['Fernando Alonso', 'fernando-alonso.webp', 14, 'Aston Martin'],
    'kimi antonelli': ['Kimi Antonelli', 'kimi-antonelli.webp', 12, 'Mercedes'],
    'oliver bearman': ['Oliver Bearman', 'oliver-bearman.webp', 87, 'Haas F1 Team'],
    'gabriel bortoleto': ['Gabriel Bortoleto', 'gabriel-bortoleto.webp', 5, 'Kick Sauber'],
    'franco colapinto': ['Franco Colapinto', 'franco-colapinto.webp', 43, 'Alpine'],
    'jack doohan': ['Jack Doohan', 'jack-doohan.webp', 7, 'Alpine'],
    'pierre gasly': ['Pierre Gasly', 'pierre-gasly.webp', 10, 'Alpine'],
    'isack hadjar': ['Isack Hadjar', 'isack-hadjar.webp', 6, 'Racing Bulls'],
    'lewis hamilton': ['Lewis Hamilton', 'lewis-hamilton.webp', 44, 'Ferrari'],
    'nico hulkenberg': ['Nico Hulkenberg', 'nico-hulkenberg.webp', 27, 'Kick Sauber'],
    'liam lawson': ['Liam Lawson', 'liam-lawson.webp', 30, 'Racing Bulls'],
    'charles leclerc': ['Charles Leclerc', 'charles-leclerc.webp', 16, 'Ferrari'],
    'lando norris': ['Lando Norris', 'lando-norris.webp', 4, 'McLaren'],
    'esteban ocon': ['Esteban Ocon', 'esteban-ocon.webp', 31, 'Haas F1 Team'],
    'oscar piastri': ['Oscar Piastri', 'oscar-piastri.webp', 81, 'McLaren'],
    'george russell': ['George Russell', 'george-russell.webp', 63, 'Mercedes'],
    'carlos sainz': ['Carlos Sainz', 'carlos-sainz.webp', 55, 'Williams'],
    'lance stroll': ['Lance Stroll', 'lance-stroll.webp', 18, 'Aston Martin'],
    'yuki tsunoda': ['Yuki Tsunoda', 'yuki-tsunoda.webp', 22, 'Red Bull Racing'],
    'max verstappen': ['Max Verstappen', 'max-verstappen.webp', 1, 'Red Bull Racing'],
  },
  2026: {
    'alexander albon': ['Alexander Albon', 'alexander-albon.webp', 23, 'Williams'],
    'fernando alonso': ['Fernando Alonso', 'fernando-alonso.webp', 14, 'Aston Martin'],
    'kimi antonelli': ['Kimi Antonelli', 'kimi-antonelli.webp', 12, 'Mercedes'],
    'oliver bearman': ['Oliver Bearman', 'oliver-bearman.webp', 87, 'Haas F1 Team'],
    'gabriel bortoleto': ['Gabriel Bortoleto', 'gabriel-bortoleto.webp', 5, 'Audi'],
    'franco colapinto': ['Franco Colapinto', 'franco-colapinto.webp', 43, 'Alpine'],
    'pierre gasly': ['Pierre Gasly', 'pierre-gasly.webp', 10, 'Alpine'],
    'isack hadjar': ['Isack Hadjar', 'isack-hadjar.webp', 6, 'Red Bull Racing'],
    'lewis hamilton': ['Lewis Hamilton', 'lewis-hamilton.webp', 44, 'Ferrari'],
    'nico hulkenberg': ['Nico Hulkenberg', 'nico-hulkenberg.webp', 27, 'Audi'],
    'liam lawson': ['Liam Lawson', 'liam-lawson.webp', 30, 'Racing Bulls'],
    'arvid lindblad': ['Arvid Lindblad', 'arvid-lindblad.webp', 41, 'Racing Bulls'],
    'charles leclerc': ['Charles Leclerc', 'charles-leclerc.webp', 16, 'Ferrari'],
    'lando norris': ['Lando Norris', 'lando-norris.webp', 1, 'McLaren'],
    'esteban ocon': ['Esteban Ocon', 'esteban-ocon.webp', 31, 'Haas F1 Team'],
    'oscar piastri': ['Oscar Piastri', 'oscar-piastri.webp', 81, 'McLaren'],
    'sergio perez': ['Sergio Perez', 'sergio-perez.webp', 11, 'Cadillac'],
    'george russell': ['George Russell', 'george-russell.webp', 63, 'Mercedes'],
    'carlos sainz': ['Carlos Sainz', 'carlos-sainz.webp', 55, 'Williams'],
    'lance stroll': ['Lance Stroll', 'lance-stroll.webp', 18, 'Aston Martin'],
    'max verstappen': ['Max Verstappen', 'max-verstappen.webp', 3, 'Red Bull Racing'],
    'valtteri bottas': ['Valtteri Bottas', 'valtteri-bottas.webp', 77, 'Cadillac'],
  },
};

const normalizeDriverName = (driver = '') => String(driver)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/^alex albon$/, 'alexander albon')
  .replace(/^andrea kimi antonelli$/, 'kimi antonelli');

export const getDriverMarkConfig = (driver, seasonYear = 2026) => {
  const season = Number(seasonYear) >= 2026 ? 2026 : 2025;
  const identity = DRIVER_MARKS[season][normalizeDriverName(driver)];
  if (!identity) return null;

  const [label, file, number, team] = identity;
  return {
    file,
    label,
    number,
    path: `driver-marks/${season}/${file}`,
    season,
    team,
  };
};

export const getSeasonDriverMarks = (seasonYear = 2026) => {
  const season = Number(seasonYear) >= 2026 ? 2026 : 2025;
  return Object.values(DRIVER_MARKS[season]).map(([label]) => (
    getDriverMarkConfig(label, season)
  ));
};
