export const AVAILABLE_SEASONS = [2026, 2025];
export const CURRENT_SEASON = 2026;

export const getSeasonFromParam = (seasonYear) => {
  const parsed = Number(seasonYear);
  return AVAILABLE_SEASONS.includes(parsed) ? parsed : CURRENT_SEASON;
};

export const getSeasonPath = (year, section = 'drivers') => `/${year}/${section}`;
