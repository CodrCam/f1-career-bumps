const DRIVER_BRAND_LOGOS = {
  'alexander albon': 'alexander-albon.png',
  'charles leclerc': 'charles-leclerc.png',
  'carlos sainz': 'carlos-sainz.png',
  'esteban ocon': 'esteban-ocon.png',
  'fernando alonso': 'fernando-alonso.png',
  'franco colapinto': 'franco-colapinto.svg',
  'gabriel bortoleto': 'gabriel-bortoleto.png',
  'george russell': 'george-russell.png',
  'isack hadjar': 'isack-hadjar.png',
  'jack doohan': 'jack-doohan.png',
  'kimi antonelli': 'kimi-antonelli.png',
  'lance stroll': 'lance-stroll.png',
  'lando norris': 'lando-norris.png',
  'lewis hamilton': 'lewis-hamilton.png',
  'liam lawson': 'liam-lawson.png',
  'max verstappen': 'max-verstappen.png',
  'nico hulkenberg': 'nico-hulkenberg.png',
  'oliver bearman': 'oliver-bearman.png',
  'oscar piastri': 'oscar-piastri.png',
  'pierre gasly': 'pierre-gasly.png',
  'sergio perez': 'sergio-perez.png',
  'valtteri bottas': 'valtteri-bottas.png',
  'yuki tsunoda': 'yuki-tsunoda.png',
};

const normalizeDriverName = (driver = '') => String(driver)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/^alex albon$/, 'alexander albon')
  .replace(/^andrea kimi antonelli$/, 'kimi antonelli');

export const getDriverBrandLogo = (driver) => {
  const file = DRIVER_BRAND_LOGOS[normalizeDriverName(driver)];
  return file ? `driver-logos/${file}` : null;
};

