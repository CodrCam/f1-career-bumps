export const AVAILABLE_SEASONS = [2026, 2025];
export const CURRENT_SEASON = 2026;

export const DEFAULT_SEASON_SECTION = 'drivers';

export const SEASON_SECTIONS = {
  constructors: {
    label: 'Constructor Championship',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  drivers: {
    label: 'Driver Championship',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'driver-results': {
    label: 'Race Results',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'driver-stats': {
    label: 'Performance Stats',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'head-to-head': {
    label: 'Head to Head',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'sector-analysis': {
    label: 'Sector Times',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'pit-stop-analysis': {
    label: 'Pit Stop Analysis',
    supportedSeasons: AVAILABLE_SEASONS,
  },
  'race-story': {
    label: 'Race Story',
    supportedSeasons: [2026],
  },
};

export const getSeasonFromParam = (seasonYear) => {
  const parsed = Number(seasonYear);
  return AVAILABLE_SEASONS.includes(parsed) ? parsed : CURRENT_SEASON;
};

export const isSeasonSectionSupported = (year, section) => {
  const normalizedYear = getSeasonFromParam(year);
  const supportedSeasons = SEASON_SECTIONS[section]?.supportedSeasons;
  return Boolean(supportedSeasons?.includes(normalizedYear));
};

export const getSeasonSectionFromPath = (pathname) => {
  const section = pathname.match(/^\/\d{4}\/([^/]+)/)?.[1];
  return SEASON_SECTIONS[section] ? section : DEFAULT_SEASON_SECTION;
};

export const getSeasonPath = (year, section = DEFAULT_SEASON_SECTION) => {
  const normalizedYear = getSeasonFromParam(year);
  const normalizedSection = isSeasonSectionSupported(normalizedYear, section)
    ? section
    : DEFAULT_SEASON_SECTION;

  return `/${normalizedYear}/${normalizedSection}`;
};
