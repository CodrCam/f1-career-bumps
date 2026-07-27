export const PIT_ANOMALY_ANALYSIS_VERSION = '1.0.0';

const finiteValues = (values) => values.filter(Number.isFinite);

const median = (values) => {
  const sorted = finiteValues(values).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const average = (values) => {
  const finite = finiteValues(values);
  return finite.length
    ? finite.reduce((sum, value) => sum + value, 0) / finite.length
    : null;
};

const standardDeviation = (values) => {
  const finite = finiteValues(values);
  if (finite.length < 2) return null;
  const mean = average(finite);
  return Math.sqrt(average(finite.map((value) => (value - mean) ** 2)));
};

const round = (value, places = 3) => {
  if (!Number.isFinite(value)) return null;
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
};

const buildBaseline = (values) => {
  const finite = finiteValues(values);
  const expected = median(finite);
  if (!Number.isFinite(expected)) return { expected: null, scale: null, sampleSize: 0 };

  const mad = median(finite.map((value) => Math.abs(value - expected)));
  const robustScale = Number.isFinite(mad) && mad > 0 ? mad * 1.4826 : null;
  const fallbackScale = standardDeviation(finite);

  return {
    expected: round(expected),
    scale: Math.max(0.05, robustScale ?? fallbackScale ?? 0.05),
    sampleSize: finite.length,
  };
};

const score = (value, baseline) => (
  Number.isFinite(value)
  && Number.isFinite(baseline.expected)
  && Number.isFinite(baseline.scale)
    ? round((value - baseline.expected) / baseline.scale, 2)
    : null
);

const normalizeNeutralization = (value) => {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z]+/g, '_');
  if (normalized.includes('virtual') || normalized.includes('vsc')) {
    return 'virtual_safety_car';
  }
  if (normalized.includes('safety_car')) return 'safety_car';
  return null;
};

const explanationFor = (classification, neutralization) => {
  if (classification === 'neutralized_quick_stop') {
    return {
      explanationStatus: 'confirmed',
      explanation: `The unusually quick full-lane time occurred while ${neutralization === 'virtual_safety_car' ? 'VSC' : 'the safety car'} was active. That context is confirmed; it does not establish a mechanical or strategic cause.`,
    };
  }

  if (classification === 'high_service_normal_transit') {
    return {
      explanationStatus: 'unexplained',
      explanation: 'Stationary service was unusually long while lane transit remained within the race distribution. Duration alone does not establish the cause.',
    };
  }

  if (classification === 'normal_service_high_transit') {
    return {
      explanationStatus: 'unexplained',
      explanation: 'Lane transit was unusually long while stationary service remained within the race distribution. Duration alone does not establish the cause.',
    };
  }

  if (classification === 'high_service_high_transit') {
    return {
      explanationStatus: 'unexplained',
      explanation: 'Both stationary service and lane transit were unusually long. Supporting evidence is required before assigning a cause.',
    };
  }

  return {
    explanationStatus: 'unexplained',
    explanation: 'This stop is within the measured race distribution; no explanation is assigned.',
  };
};

const classificationLabel = {
  high_service_normal_transit: 'High service / normal transit',
  normal_service_high_transit: 'Normal service / high transit',
  high_service_high_transit: 'High service / high transit',
  neutralized_quick_stop: 'Unusually quick under neutralization',
  normal: 'Within race distribution',
};

export const analyzePitStopRecords = (
  records,
  {
    highThreshold = 3.5,
    quickThreshold = -3.5,
    minimumSampleSize = 5,
  } = {},
) => {
  const groups = new Map();

  (records ?? []).forEach((record) => {
    const key = `${record.seasonYear ?? 'season'}:${record.round ?? 'race'}`;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  });

  return Array.from(groups.values()).flatMap((group) => {
    const matched = group.filter((record) => (
      Number.isFinite(record.serviceTime)
      && Number.isFinite(record.pitLaneTime)
      && Number.isFinite(record.transitTime)
    ));
    const baselines = {
      service: buildBaseline(matched.map((record) => record.serviceTime)),
      lane: buildBaseline(matched.map((record) => record.pitLaneTime)),
      transit: buildBaseline(matched.map((record) => record.transitTime)),
    };
    const sampleReady = matched.length >= minimumSampleSize;

    return group.map((record) => {
      const serviceScore = score(record.serviceTime, baselines.service);
      const laneScore = score(record.pitLaneTime, baselines.lane);
      const transitScore = score(record.transitTime, baselines.transit);
      const neutralization = normalizeNeutralization(record.neutralizationType);
      const highService = sampleReady && serviceScore >= highThreshold;
      const highTransit = sampleReady && transitScore >= highThreshold;
      const quickLane = sampleReady && laneScore <= quickThreshold;
      let anomalyType = 'normal';

      if (neutralization && quickLane) anomalyType = 'neutralized_quick_stop';
      else if (highService && highTransit) anomalyType = 'high_service_high_transit';
      else if (highService) anomalyType = 'high_service_normal_transit';
      else if (highTransit) anomalyType = 'normal_service_high_transit';

      const isAnomaly = anomalyType !== 'normal';
      const anomalyScore = isAnomaly
        ? Math.max(
          Math.abs(serviceScore ?? 0),
          Math.abs(laneScore ?? 0),
          Math.abs(transitScore ?? 0),
        )
        : 0;
      const explanation = explanationFor(anomalyType, neutralization);

      return {
        ...record,
        pitAnomalyVersion: PIT_ANOMALY_ANALYSIS_VERSION,
        expectedServiceTime: baselines.service.expected,
        expectedPitLaneTime: baselines.lane.expected,
        expectedTransitTime: baselines.transit.expected,
        serviceAnomalyScore: serviceScore,
        laneAnomalyScore: laneScore,
        transitAnomalyScore: transitScore,
        anomalyScore: round(anomalyScore, 2),
        anomalyType,
        anomalyLabel: classificationLabel[anomalyType],
        isAnomaly,
        ...explanation,
        evidence: [
          record.serviceSource && {
            kind: 'service_clock',
            source: record.serviceSource,
          },
          record.pitLaneSource && {
            kind: 'pit_lane_clock',
            source: record.pitLaneSource,
          },
          ...(record.raceControlEvidence ?? []),
        ].filter(Boolean),
      };
    });
  });
};

