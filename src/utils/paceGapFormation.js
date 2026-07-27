const ADJACENT_GAP_LIMITS = Object.freeze({
  best: {
    lap: 0.35,
    sector1: 0.12,
    sector2: 0.12,
    sector3: 0.12,
  },
  average: {
    lap: 0.5,
    sector1: 0.18,
    sector2: 0.18,
    sector3: 0.18,
  },
});

export const getPaceGapFormation = (
  rows,
  {
    metric = 'lap',
    treatment = 'best',
    minimum = 3,
    maximum = 5,
  } = {},
) => {
  const candidates = Array.isArray(rows)
    ? rows.filter((row) => Number.isFinite(row?.gap)).slice(0, maximum)
    : [];
  const guaranteedCount = Math.min(minimum, candidates.length);
  const formation = candidates.slice(0, guaranteedCount);
  const gapLimit = ADJACENT_GAP_LIMITS[treatment]?.[metric]
    ?? ADJACENT_GAP_LIMITS.best.lap;

  for (let index = guaranteedCount; index < candidates.length; index += 1) {
    const driver = candidates[index];
    const previous = candidates[index - 1];
    if ((driver.gap - previous.gap) > gapLimit) break;
    formation.push(driver);
  }

  return formation;
};

export const getEquivalentGapMeters = ({
  gapSeconds,
  lapTimeSeconds,
  circuitLengthMeters,
}) => {
  const gap = Number(gapSeconds);
  const lapTime = Number(lapTimeSeconds);
  const circuitLength = Number(circuitLengthMeters);

  if (
    !Number.isFinite(gap)
    || gap < 0
    || !Number.isFinite(lapTime)
    || lapTime <= 0
    || !Number.isFinite(circuitLength)
    || circuitLength <= 0
  ) {
    return null;
  }

  return gap * (circuitLength / lapTime);
};

export const formatEquivalentGapMeters = (distance) => {
  const value = Number(distance);
  if (!Number.isFinite(value) || value < 0) return null;
  return `${value.toFixed(1)} m`;
};
