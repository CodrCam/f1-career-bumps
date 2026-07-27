export const TEAM_CAR_CONFIG = {
  mercedes: {
    name: 'Mercedes',
    shortName: 'MER',
    primary: '#d8dde0',
    secondary: '#111417',
    accent: '#00a19c',
    trim: '#ffffff',
    shape: 'low',
    pattern: 'spine',
  },
  ferrari: {
    name: 'Ferrari',
    shortName: 'FER',
    primary: '#e10600',
    secondary: '#f3f0e8',
    accent: '#181a1e',
    trim: '#ffd21f',
    shape: 'sharp',
    pattern: 'swoop',
  },
  mclaren: {
    name: 'McLaren',
    shortName: 'MCL',
    primary: '#ff8000',
    secondary: '#111318',
    accent: '#353940',
    trim: '#f4f6f7',
    shape: 'long',
    pattern: 'split',
  },
  redBull: {
    name: 'Red Bull Racing',
    shortName: 'RBR',
    primary: '#17224c',
    secondary: '#11131b',
    accent: '#ef1a2d',
    trim: '#f8d52d',
    shape: 'compact',
    pattern: 'bolt',
  },
  alpine: {
    name: 'Alpine',
    shortName: 'ALP',
    primary: '#147bd1',
    secondary: '#172034',
    accent: '#f48fb1',
    trim: '#ffffff',
    shape: 'long',
    pattern: 'alpine',
  },
  racingBulls: {
    name: 'Racing Bulls',
    shortName: 'VCARB',
    primary: '#f4f5f6',
    secondary: '#2443a7',
    accent: '#e10600',
    trim: '#f7d117',
    shape: 'sharp',
    pattern: 'swoop',
  },
  haas: {
    name: 'Haas',
    shortName: 'HAS',
    primary: '#f0f1f2',
    secondary: '#17191d',
    accent: '#e32636',
    trim: '#9ca3af',
    shape: 'compact',
    pattern: 'spine',
  },
  williams: {
    name: 'Williams',
    shortName: 'WIL',
    primary: '#1666d9',
    secondary: '#f4f6f8',
    accent: '#0b183f',
    trim: '#e3293b',
    shape: 'low',
    pattern: 'split',
  },
  audi: {
    name: 'Audi',
    shortName: 'AUD',
    primary: '#b8b9b6',
    secondary: '#131313',
    accent: '#f50537',
    trim: '#f0f0ec',
    shape: 'sharp',
    pattern: 'slash',
  },
  astonMartin: {
    name: 'Aston Martin',
    shortName: 'AMR',
    primary: '#07594f',
    secondary: '#102c2a',
    accent: '#c8df36',
    trim: '#e7f5ef',
    shape: 'long',
    pattern: 'spine',
  },
  cadillac: {
    name: 'Cadillac',
    shortName: 'CAD',
    primary: '#e5e7e8',
    secondary: '#121417',
    accent: '#ffffff',
    trim: '#d92835',
    shape: 'low',
    pattern: 'bolt',
  },
};

export const getTeamCarConfig = (teamKey, seasonYear = 2026) => {
  if (Number(seasonYear) < 2026 && teamKey === 'audi') {
    return {
      ...TEAM_CAR_CONFIG.audi,
      name: 'Kick Sauber',
      primary: '#0f1110',
      secondary: '#111513',
      accent: '#52e252',
      trim: '#b8ff4f',
      pattern: 'bolt',
    };
  }

  return TEAM_CAR_CONFIG[teamKey];
};

export const SEASON_2026_GRID = [
  { team: 'mercedes', drivers: ['George Russell', 'Kimi Antonelli'] },
  { team: 'ferrari', drivers: ['Charles Leclerc', 'Lewis Hamilton'] },
  { team: 'mclaren', drivers: ['Lando Norris', 'Oscar Piastri'] },
  { team: 'redBull', drivers: ['Max Verstappen', 'Isack Hadjar'] },
  { team: 'alpine', drivers: ['Pierre Gasly', 'Franco Colapinto'] },
  { team: 'racingBulls', drivers: ['Liam Lawson', 'Arvid Lindblad'] },
  { team: 'haas', drivers: ['Esteban Ocon', 'Oliver Bearman'] },
  { team: 'williams', drivers: ['Carlos Sainz', 'Alexander Albon'] },
  { team: 'audi', drivers: ['Nico Hulkenberg', 'Gabriel Bortoleto'] },
  { team: 'astonMartin', drivers: ['Fernando Alonso', 'Lance Stroll'] },
  { team: 'cadillac', drivers: ['Sergio Perez', 'Valtteri Bottas'] },
];

const DRIVER_TEAM_2026 = new Map(
  SEASON_2026_GRID.flatMap(({ team, drivers }) => (
    drivers.map((driver) => [driver.toLowerCase(), team])
  )),
);

export const getDriverTeamKey = (driverName, year = 2026) => {
  if (Number(year) !== 2026 || !driverName) return null;
  return DRIVER_TEAM_2026.get(driverName.toLowerCase()) ?? null;
};

export const DRIVER_CODE_NAMES_2026 = {
  ALB: 'Alexander Albon',
  ALO: 'Fernando Alonso',
  ANT: 'Kimi Antonelli',
  BEA: 'Oliver Bearman',
  BOT: 'Valtteri Bottas',
  BOR: 'Gabriel Bortoleto',
  COL: 'Franco Colapinto',
  GAS: 'Pierre Gasly',
  HAD: 'Isack Hadjar',
  HAM: 'Lewis Hamilton',
  HUL: 'Nico Hulkenberg',
  LAW: 'Liam Lawson',
  LEC: 'Charles Leclerc',
  LIN: 'Arvid Lindblad',
  NOR: 'Lando Norris',
  OCO: 'Esteban Ocon',
  PER: 'Sergio Perez',
  PIA: 'Oscar Piastri',
  RUS: 'George Russell',
  SAI: 'Carlos Sainz',
  STR: 'Lance Stroll',
  VER: 'Max Verstappen',
};

const TEAM_NAME_ALIASES = [
  [/\bmercedes\b/i, 'mercedes'],
  [/\bferrari\b/i, 'ferrari'],
  [/\bmclaren\b/i, 'mclaren'],
  [/\bred bull\b/i, 'redBull'],
  [/\balpine\b/i, 'alpine'],
  [/\bracing bulls?\b|\bvisa cash app rb\b|\bvc[a]?rb\b/i, 'racingBulls'],
  [/\bhaas\b/i, 'haas'],
  [/\bwilliams\b/i, 'williams'],
  [/\baudi\b|\bsauber\b|\bkick\b|\bstake\b/i, 'audi'],
  [/\baston martin\b/i, 'astonMartin'],
  [/\bcadillac\b/i, 'cadillac'],
];

export const getTeamKeyByName = (teamName = '') => (
  TEAM_NAME_ALIASES.find(([pattern]) => pattern.test(teamName))?.[1] ?? null
);
