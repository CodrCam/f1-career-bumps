const TEAM_IDENTITIES = {
  alpine: {
    label: 'Alpine',
    file: 'alpine.webp',
    color: '#f48fb1',
  },
  'aston-martin': {
    label: 'Aston Martin',
    file: 'aston-martin.webp',
    color: '#18a999',
  },
  audi: {
    label: 'Audi',
    file: 'audi.webp',
    color: '#f50537',
  },
  cadillac: {
    label: 'Cadillac',
    file: 'cadillac.webp',
    color: '#d4af37',
  },
  ferrari: {
    label: 'Ferrari',
    file: 'ferrari.webp',
    color: '#ef1a2d',
  },
  haas: {
    label: 'Haas F1 Team',
    file: 'haas.webp',
    color: '#e4e8ec',
  },
  'kick-sauber': {
    label: 'Kick Sauber',
    file: 'kick-sauber.webp',
    color: '#00e701',
  },
  mclaren: {
    label: 'McLaren',
    file: 'mclaren.webp',
    color: '#ff8700',
  },
  mercedes: {
    label: 'Mercedes',
    file: 'mercedes.webp',
    color: '#00d2be',
  },
  'racing-bulls': {
    label: 'Racing Bulls',
    file: 'racing-bulls.webp',
    color: '#8da2ff',
  },
  'red-bull-racing': {
    label: 'Red Bull Racing',
    file: 'red-bull-racing.webp',
    color: '#6f8cff',
  },
  williams: {
    label: 'Williams',
    file: 'williams.webp',
    color: '#47a7ff',
  },
};

const normalizeTeamName = (team = '') => String(team)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const resolveTeamKey = (team, logoSeason) => {
  const normalized = normalizeTeamName(team);

  if (/\bracing bulls?\b|\bvisa cash app rb\b|\bvcarb\b/.test(normalized)) {
    return 'racing-bulls';
  }
  if (/\bred bull\b/.test(normalized)) return 'red-bull-racing';
  if (/\baston martin\b/.test(normalized)) return 'aston-martin';
  if (/\bsauber\b|\bstake\b|\bkick\b/.test(normalized)) {
    return logoSeason >= 2026 ? 'audi' : 'kick-sauber';
  }
  if (/\bmercedes\b/.test(normalized)) return 'mercedes';
  if (/\bferrari\b/.test(normalized)) return 'ferrari';
  if (/\bmc laren\b|\bmclaren\b/.test(normalized)) return 'mclaren';
  if (/\balpine\b/.test(normalized)) return 'alpine';
  if (/\bhaas\b/.test(normalized)) return 'haas';
  if (/\bwilliams\b/.test(normalized)) return 'williams';
  if (/\baudi\b/.test(normalized)) return 'audi';
  if (/\bcadillac\b/.test(normalized)) return 'cadillac';
  return null;
};

export const getTeamLogoConfig = (team, seasonYear = 2026) => {
  const logoSeason = Number(seasonYear) >= 2026 ? 2026 : 2025;
  const key = resolveTeamKey(team, logoSeason);
  const identity = TEAM_IDENTITIES[key];

  if (!identity) return null;
  if (logoSeason === 2025 && ['audi', 'cadillac'].includes(key)) return null;

  return {
    ...identity,
    key,
    season: logoSeason,
    path: `team-logos/${logoSeason}/${identity.file}`,
  };
};
