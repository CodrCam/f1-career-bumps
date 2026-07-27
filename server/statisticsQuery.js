const finite = (value) => {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : null;
};

const mean = (values) => {
  const samples = values.filter(Number.isFinite);
  return samples.length
    ? samples.reduce((total, value) => total + value, 0) / samples.length
    : null;
};

const deviation = (values) => {
  const samples = values.filter(Number.isFinite);
  if (samples.length < 2) return null;
  const average = mean(samples);
  return Math.sqrt(
    samples.reduce((total, value) => total + ((value - average) ** 2), 0)
      / samples.length,
  );
};

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const statusIsFailure = (status = '') => (
  /dnf|dns|dsq|retired|not classified/i.test(status)
);

const metric = ({
  label,
  shortLabel = label,
  unit,
  decimals,
  direction = 'desc',
  methodology,
  calculation,
  value,
  sampleSize,
}) => ({
  label,
  shortLabel,
  unit,
  decimals,
  direction,
  methodology,
  calculation,
  value,
  sampleSize,
});

export const STATISTICS_METRICS = {
  points: metric({
    label: 'Championship points',
    shortLabel: 'Points',
    unit: 'points',
    decimals: 0,
    methodology: 'championship-points',
    calculation: 'Sum of official race and sprint points in the selected rounds.',
    value: (results) => results.reduce(
      (total, result) => total + Number(result.points ?? 0) + Number(result.sprintPoints ?? 0),
      0,
    ),
    sampleSize: (results) => results.length,
  }),
  race_points: metric({
    label: 'Race points',
    unit: 'points',
    decimals: 0,
    methodology: 'race-points',
    calculation: 'Sum of official Grand Prix points in the selected rounds; sprint points are excluded.',
    value: (results) => results.reduce(
      (total, result) => total + Number(result.points ?? 0),
      0,
    ),
    sampleSize: (results) => results.length,
  }),
  sprint_points: metric({
    label: 'Sprint points',
    unit: 'points',
    decimals: 0,
    methodology: 'sprint-points',
    calculation: 'Sum of official sprint points in the selected rounds.',
    value: (results) => results.reduce(
      (total, result) => total + Number(result.sprintPoints ?? 0),
      0,
    ),
    sampleSize: (results) => results.filter(
      (result) => finite(result.sprintPosition) !== null,
    ).length,
  }),
  wins: metric({
    label: 'Race wins',
    shortLabel: 'Wins',
    unit: 'wins',
    decimals: 0,
    methodology: 'race-wins',
    calculation: 'Count of official Grand Prix classifications in first place.',
    value: (results) => results.filter((result) => finite(result.position) === 1).length,
    sampleSize: (results) => results.length,
  }),
  podiums: metric({
    label: 'Race podiums',
    shortLabel: 'Podiums',
    unit: 'podiums',
    decimals: 0,
    methodology: 'podiums',
    calculation: 'Count of official Grand Prix classifications in positions one through three.',
    value: (results) => results.filter((result) => {
      const position = finite(result.position);
      return position !== null && position <= 3;
    }).length,
    sampleSize: (results) => results.length,
  }),
  starts: metric({
    label: 'Race starts',
    shortLabel: 'Starts',
    unit: 'starts',
    decimals: 0,
    methodology: 'race-starts',
    calculation: 'Count of driver entries in the selected official race classifications.',
    value: (results) => results.length,
    sampleSize: (results) => results.length,
  }),
  average_finish: metric({
    label: 'Average race finish',
    shortLabel: 'Average finish',
    unit: 'position',
    decimals: 2,
    direction: 'asc',
    methodology: 'average-finish',
    calculation: 'Arithmetic mean of numeric Grand Prix classification positions.',
    value: (results) => mean(results.map((result) => finite(result.position))),
    sampleSize: (results) => results.filter(
      (result) => finite(result.position) !== null,
    ).length,
  }),
  average_grid: metric({
    label: 'Average grid position',
    shortLabel: 'Average grid',
    unit: 'position',
    decimals: 2,
    direction: 'asc',
    methodology: 'average-grid',
    calculation: 'Arithmetic mean of numeric starting-grid positions.',
    value: (results) => mean(results.map((result) => finite(result.grid))),
    sampleSize: (results) => results.filter((result) => finite(result.grid) !== null).length,
  }),
  average_qualifying: metric({
    label: 'Average qualifying position',
    shortLabel: 'Average qualifying',
    unit: 'position',
    decimals: 2,
    direction: 'asc',
    methodology: 'average-qualifying',
    calculation: 'Arithmetic mean of official qualifying positions in comparable sessions.',
    value: (results) => mean(results.map((result) => finite(result.qualifying))),
    sampleSize: (results) => results.filter(
      (result) => finite(result.qualifying) !== null,
    ).length,
  }),
  points_per_start: metric({
    label: 'Points per start',
    unit: 'points/start',
    decimals: 2,
    methodology: 'points-per-start',
    calculation: 'Official race and sprint points divided by selected race starts.',
    value: (results) => results.length
      ? results.reduce(
        (total, result) => total + Number(result.points ?? 0)
          + Number(result.sprintPoints ?? 0),
        0,
      ) / results.length
      : null,
    sampleSize: (results) => results.length,
  }),
  reliability: metric({
    label: 'Reliability',
    unit: '%',
    decimals: 0,
    methodology: 'reliability',
    calculation: 'Share of selected race entries not labeled DNF, DNS, DSQ, retired, or not classified.',
    value: (results) => results.length
      ? ((results.length - results.filter(
        (result) => statusIsFailure(result.status),
      ).length) / results.length) * 100
      : null,
    sampleSize: (results) => results.length,
  }),
  dnfs: metric({
    label: 'Non-finishes',
    shortLabel: 'DNFs',
    unit: 'non-finishes',
    decimals: 0,
    direction: 'asc',
    methodology: 'non-finishes',
    calculation: 'Count of selected entries labeled DNF, DNS, DSQ, retired, or not classified.',
    value: (results) => results.filter((result) => statusIsFailure(result.status)).length,
    sampleSize: (results) => results.length,
  }),
  positions_gained: metric({
    label: 'Net positions gained',
    unit: 'positions',
    decimals: 0,
    methodology: 'positions-gained',
    calculation: 'Sum of starting-grid position minus classified finishing position.',
    value: (results) => {
      const samples = results.map((result) => finite(result.gridDelta)).filter(Number.isFinite);
      return samples.length ? samples.reduce((total, value) => total + value, 0) : null;
    },
    sampleSize: (results) => results.filter(
      (result) => finite(result.gridDelta) !== null,
    ).length,
  }),
  consistency: metric({
    label: 'Finishing consistency',
    shortLabel: 'Consistency',
    unit: 'position σ',
    decimals: 2,
    direction: 'asc',
    methodology: 'finish-consistency',
    calculation: 'Population standard deviation of numeric Grand Prix classification positions.',
    value: (results) => deviation(results.map((result) => finite(result.position))),
    sampleSize: (results) => results.filter(
      (result) => finite(result.position) !== null,
    ).length,
  }),
  best_finish: metric({
    label: 'Best race finish',
    shortLabel: 'Best finish',
    unit: 'position',
    decimals: 0,
    direction: 'asc',
    methodology: 'best-finish',
    calculation: 'Lowest numeric Grand Prix classification position in the selected rounds.',
    value: (results) => {
      const samples = results.map((result) => finite(result.position)).filter(Number.isFinite);
      return samples.length ? Math.min(...samples) : null;
    },
    sampleSize: (results) => results.filter(
      (result) => finite(result.position) !== null,
    ).length,
  }),
};

export const STATISTICS_METRIC_OPTIONS = Object.entries(STATISTICS_METRICS).map(
  ([id, definition]) => ({
    id,
    label: definition.label,
    direction: definition.direction,
    unit: definition.unit,
    methodology: definition.methodology,
  }),
);

const hasMetric = (id) => Object.hasOwn(STATISTICS_METRICS, id);

const metricPatterns = [
  ['points_per_start', /points?\s*(?:per|\/)\s*(?:start|race)/],
  ['average_qualifying', /average\s+(?:qualifying|quali)|qualifying\s+average/],
  ['average_grid', /average\s+grid|grid\s+average/],
  ['average_finish', /average\s+(?:finish|finishing)|finishing\s+average/],
  ['positions_gained', /positions?\s+gained|grid\s+(?:gain|delta)|places?\s+gained/],
  ['sprint_points', /sprint\s+points?/],
  ['race_points', /race\s+points?|grand\s+prix\s+points?/],
  ['reliability', /reliab|finish\s+rate/],
  ['consistency', /consisten|standard\s+deviation|variation/],
  ['best_finish', /best\s+(?:race\s+)?finish|highest\s+finish/],
  ['dnfs', /\bdnfs?\b|non[\s-]?finishes?|retirements?/],
  ['podiums', /podiums?|top\s+three/],
  ['wins', /\bwins?\b|victories/],
  ['starts', /\bstarts?\b|races?\s+entered/],
  ['points', /\bpoints?\b|championship/],
];

const exactMatch = (value, candidates) => {
  const normalized = normalizeText(value);
  return candidates.find((candidate) => normalizeText(candidate) === normalized);
};

const keysOutside = (value, allowed) => (
  value && typeof value === 'object'
    ? Object.keys(value).filter((key) => !allowed.includes(key))
    : []
);

export class StatisticsQueryError extends Error {
  constructor(issues) {
    super('The statistics query did not pass validation.');
    this.name = 'StatisticsQueryError';
    this.statusCode = 400;
    this.issues = issues;
  }
}

export const validateStatisticsQuery = (candidate, directory) => {
  const issues = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new StatisticsQueryError(['Query must be a JSON object.']);
  }

  const unknown = keysOutside(candidate, [
    'season',
    'subject',
    'metrics',
    'filters',
    'groupBy',
    'sort',
    'limit',
  ]);
  if (unknown.length) issues.push(`Unknown query fields: ${unknown.join(', ')}.`);

  const season = Number(candidate.season ?? directory.data.year);
  if (season !== Number(directory.data.year)) {
    issues.push(`Season must match the loaded ${directory.data.year} dataset.`);
  }

  const subject = candidate.subject ?? 'drivers';
  if (subject !== 'drivers') issues.push('Only the drivers subject is currently supported.');

  const requestedMetrics = Array.isArray(candidate.metrics)
    ? [...new Set(candidate.metrics.map(String))]
    : [];
  if (!requestedMetrics.length || requestedMetrics.length > 3) {
    issues.push('Choose between one and three metrics.');
  }
  requestedMetrics.forEach((entry) => {
    if (!hasMetric(entry)) issues.push(`Unsupported metric: ${entry}.`);
  });

  const filters = candidate.filters && typeof candidate.filters === 'object'
    && !Array.isArray(candidate.filters)
    ? candidate.filters
    : {};
  const unknownFilters = keysOutside(filters, ['roundFrom', 'roundTo', 'team', 'driverIds']);
  if (unknownFilters.length) {
    issues.push(`Unknown filters: ${unknownFilters.join(', ')}.`);
  }

  const maxRound = Math.max(1, Number(directory.data.throughRound) || 1);
  const roundFrom = filters.roundFrom === null || filters.roundFrom === undefined
    ? 1
    : Number(filters.roundFrom);
  const roundTo = filters.roundTo === null || filters.roundTo === undefined
    ? maxRound
    : Number(filters.roundTo);
  if (!Number.isInteger(roundFrom) || roundFrom < 1 || roundFrom > 99) {
    issues.push('Starting round must be an integer between 1 and 99.');
  }
  if (!Number.isInteger(roundTo) || roundTo < 1 || roundTo > 99) {
    issues.push('Ending round must be an integer between 1 and 99.');
  }
  if (roundFrom > roundTo) issues.push('Starting round cannot be after ending round.');

  const teams = directory.data.teams ?? [];
  const team = filters.team ? exactMatch(filters.team, teams) : null;
  if (filters.team && !team) issues.push(`Unknown team: ${String(filters.team)}.`);

  const driverIds = Array.isArray(filters.driverIds)
    ? [...new Set(filters.driverIds.map(String))]
    : [];
  if (driverIds.length > 6) issues.push('Choose no more than six drivers.');
  const availableIds = new Set(directory.data.drivers.map((driver) => driver.id));
  driverIds.forEach((id) => {
    if (!availableIds.has(id)) issues.push(`Unknown driver: ${id}.`);
  });

  const groupBy = Array.isArray(candidate.groupBy) ? candidate.groupBy.map(String) : ['driver'];
  if (groupBy.length !== 1 || groupBy[0] !== 'driver') {
    issues.push('Driver is the only supported grouping.');
  }

  const primaryMetric = requestedMetrics[0];
  const sortInput = Array.isArray(candidate.sort) ? candidate.sort[0] : null;
  const sortMetric = String(sortInput?.metric ?? primaryMetric);
  if (primaryMetric && sortMetric !== primaryMetric) {
    issues.push('The primary metric must also be the sort metric.');
  }
  const defaultDirection = hasMetric(primaryMetric)
    ? STATISTICS_METRICS[primaryMetric].direction
    : 'desc';
  const direction = sortInput?.direction ?? defaultDirection;
  if (!['asc', 'desc'].includes(direction)) {
    issues.push('Sort direction must be asc or desc.');
  }

  const limit = Number(candidate.limit ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    issues.push('Result limit must be an integer between 1 and 20.');
  }

  if (issues.length) throw new StatisticsQueryError(issues);

  return {
    season,
    subject: 'drivers',
    metrics: requestedMetrics,
    filters: {
      roundFrom,
      roundTo,
      team,
      driverIds,
    },
    groupBy: ['driver'],
    sort: [{
      metric: primaryMetric,
      direction,
    }],
    limit,
  };
};

const findDriverIds = (question, drivers) => {
  const haystack = ` ${normalizeText(question)} `;
  return drivers.filter((driver) => {
    const candidates = [driver.name, driver.id, driver.code].filter(Boolean);
    return candidates.some((candidate) => {
      const needle = normalizeText(candidate);
      return needle.length >= 3 && haystack.includes(` ${needle} `);
    });
  }).map((driver) => driver.id);
};

export const parseStatisticsQuestion = (
  question,
  directory,
  requestedSeason = directory.data.year,
) => {
  const value = String(question ?? '').trim();
  if (!value || value.length > 220) {
    throw new StatisticsQueryError([
      value ? 'Question must be 220 characters or fewer.' : 'Enter a statistics question.',
    ]);
  }

  const normalized = normalizeText(value);
  const seasonMatch = normalized.match(/\b(2025|2026)\b/);
  const season = Number(seasonMatch?.[1] ?? requestedSeason);
  const metricMatch = metricPatterns.find(([, pattern]) => pattern.test(normalized));
  const metricId = metricMatch?.[0] ?? 'points';
  const definition = STATISTICS_METRICS[metricId];
  const rangeMatch = normalized.match(
    /\brounds?\s+(\d{1,2})\s+(?:to|through|thru|-)\s+(?:round\s+)?(\d{1,2})\b/,
  );
  const sinceMatch = normalized.match(/\b(?:since|from)\s+round\s+(\d{1,2})\b/);
  const throughMatch = normalized.match(/\b(?:through|thru|until|to)\s+round\s+(\d{1,2})\b/);
  const afterMatch = normalized.match(/\bafter\s+round\s+(\d{1,2})\b/);
  const team = (directory.data.teams ?? []).find((candidate) => (
    normalized.includes(normalizeText(candidate))
  )) ?? null;
  const driverIds = findDriverIds(value, directory.data.drivers);
  const limitMatch = normalized.match(/\b(?:top|first)\s+(\d{1,2})\b/);
  const comparison = /\bcompare|versus|\bvs\b/.test(normalized);
  const limit = limitMatch
    ? Math.min(20, Math.max(1, Number(limitMatch[1])))
    : comparison && driverIds.length > 1
      ? driverIds.length
      : /\bwho\b|\bwhich driver\b|\bbest\b|\bmost\b|\bfewest\b|\bleast\b/.test(normalized)
        ? 1
        : 10;

  let direction = definition.direction;
  if (/\bworst\b|\bhighest average\b/.test(normalized)) {
    direction = definition.direction === 'asc' ? 'desc' : 'asc';
  }
  if (metricId === 'dnfs' && /\bmost\b/.test(normalized)) direction = 'desc';
  if (/\bfewest\b|\bleast\b|\blowest\b/.test(normalized)) direction = 'asc';
  if (/\bmost\b|\bhighest\b|\btop\b/.test(normalized) && metricId !== 'dnfs') {
    direction = definition.direction;
  }

  let confidence = metricMatch ? 0.68 : 0.38;
  if (driverIds.length || team) confidence += 0.14;
  if (rangeMatch || sinceMatch || throughMatch || afterMatch) confidence += 0.1;
  if (seasonMatch) confidence += 0.04;
  confidence = Math.min(0.99, confidence);

  const query = validateStatisticsQuery({
    season,
    subject: 'drivers',
    metrics: [metricId],
    filters: {
      roundFrom: rangeMatch
        ? Number(rangeMatch[1])
        : afterMatch
          ? Number(afterMatch[1]) + 1
          : sinceMatch
            ? Number(sinceMatch[1])
            : 1,
      roundTo: rangeMatch
        ? Number(rangeMatch[2])
        : throughMatch
          ? Number(throughMatch[1])
          : directory.data.throughRound,
      team,
      driverIds,
    },
    groupBy: ['driver'],
    sort: [{ metric: metricId, direction }],
    limit,
  }, directory);

  const notes = [
    metricMatch
      ? `Matched “${definition.label}” from the question.`
      : 'No explicit metric was found, so championship points were selected.',
    driverIds.length
      ? `${driverIds.length} named driver${driverIds.length === 1 ? '' : 's'} matched.`
      : team
        ? `Restricted the sample to ${team}.`
        : 'The full driver field is included.',
  ];

  return {
    query,
    interpretation: {
      mode: 'deterministic',
      confidence,
      notes,
    },
  };
};

const formatMetricValue = (value, definition) => {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (definition.unit === 'position' && definition.decimals === 0) return `P${value}`;
  const formatted = Number(value).toFixed(definition.decimals);
  if (definition.unit === '%') return `${formatted}%`;
  return `${formatted} ${definition.unit}`;
};

const scopeLabel = (query, sample) => {
  const roundLabel = query.filters.roundFrom === query.filters.roundTo
    ? `round ${query.filters.roundFrom}`
    : `rounds ${query.filters.roundFrom}–${query.filters.roundTo}`;
  const parts = [
    String(query.season),
    roundLabel,
    query.filters.team,
    query.filters.driverIds.length
      ? `${query.filters.driverIds.length} selected drivers`
      : `${sample.driverCount} drivers`,
    `${sample.resultCount} race rows`,
  ];
  return parts.filter(Boolean).join(' · ');
};

const buildEvidence = (rows, query) => {
  const included = new Set(rows.slice(0, 5).map((row) => row.id));
  return rows
    .filter((row) => included.has(row.id))
    .flatMap((row) => row.results.map((result) => ({
      id: `${row.id}-${result.round}`,
      driverId: row.id,
      driver: row.entity,
      team: result.team,
      round: result.round,
      grandPrix: result.grandPrix,
      position: result.position,
      grid: result.grid,
      qualifying: result.qualifying,
      points: Number(result.points ?? 0) + Number(result.sprintPoints ?? 0),
      status: result.status,
      raceRoute: `/${query.season}/races/${result.round}`,
    })))
    .slice(0, 60);
};

export const runStatisticsQuery = ({ input, directory }) => {
  if (!directory?.data?.drivers || !directory?.meta) {
    throw new StatisticsQueryError(['A published driver directory is required.']);
  }

  const resolved = input?.query
    ? {
      query: validateStatisticsQuery(input.query, directory),
      interpretation: {
        mode: 'structured',
        confidence: 1,
        notes: ['Filters were submitted directly through the structured query editor.'],
      },
    }
    : parseStatisticsQuestion(input?.question, directory, input?.season);
  const { query, interpretation } = resolved;
  const primaryMetric = query.metrics[0];
  const primaryDefinition = STATISTICS_METRICS[primaryMetric];
  const selectedDriverIds = new Set(query.filters.driverIds);

  const candidates = directory.data.drivers.flatMap((driver) => {
    if (selectedDriverIds.size && !selectedDriverIds.has(driver.id)) return [];
    const results = driver.results.filter((result) => (
      result.round >= query.filters.roundFrom
      && result.round <= query.filters.roundTo
      && (!query.filters.team || result.team === query.filters.team)
    ));
    if (!results.length) return [];

    const values = Object.fromEntries(query.metrics.map((metricId) => {
      const definition = STATISTICS_METRICS[metricId];
      const value = definition.value(results);
      return [metricId, {
        value,
        formatted: formatMetricValue(value, definition),
        unit: definition.unit,
        sampleSize: definition.sampleSize(results),
      }];
    }));

    return [{
      id: driver.id,
      entity: driver.name,
      code: driver.code,
      team: query.filters.team ?? results.at(-1)?.team ?? driver.team,
      resultCount: results.length,
      values,
      results,
    }];
  });

  const direction = query.sort[0].direction;
  candidates.sort((left, right) => {
    const leftValue = left.values[primaryMetric].value;
    const rightValue = right.values[primaryMetric].value;
    if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) {
      return left.entity.localeCompare(right.entity);
    }
    if (!Number.isFinite(leftValue)) return 1;
    if (!Number.isFinite(rightValue)) return -1;
    const delta = direction === 'asc'
      ? leftValue - rightValue
      : rightValue - leftValue;
    return delta || left.entity.localeCompare(right.entity);
  });

  const rows = candidates.slice(0, query.limit);
  const resultCount = candidates.reduce((total, row) => total + row.resultCount, 0);
  const roundSet = new Set(candidates.flatMap((row) => (
    row.results.map((result) => result.round)
  )));
  const sample = {
    driverCount: candidates.length,
    roundCount: roundSet.size,
    resultCount,
    roundFrom: query.filters.roundFrom,
    roundTo: query.filters.roundTo,
  };
  const leader = rows[0];
  const selectedOneDriver = query.filters.driverIds.length === 1;
  const headline = leader
    ? selectedOneDriver
      ? `${leader.entity}: ${leader.values[primaryMetric].formatted}`
      : `${leader.entity} leads the selected sample`
    : 'No published rows match this query';
  const summary = leader
    ? `${leader.entity} records ${leader.values[primaryMetric].formatted} for ${primaryDefinition.label.toLowerCase()} across ${leader.resultCount} selected race${leader.resultCount === 1 ? '' : 's'}.`
    : 'Change the season, round range, team, or driver filters and run the query again.';

  const caveats = [
    'Only published race classification rows in the selected season are calculated.',
  ];
  if (['average_finish', 'average_grid', 'average_qualifying', 'consistency', 'best_finish']
    .includes(primaryMetric)) {
    caveats.push('Rows without a numeric value for this metric are excluded from that calculation.');
  }
  if (query.filters.roundTo > directory.data.throughRound) {
    caveats.push(
      `The season is currently published through round ${directory.data.throughRound}; later requested rounds contribute no rows.`,
    );
  }
  if (directory.meta.warnings?.length) {
    caveats.push(...directory.meta.warnings.map((warning) => `Source warning: ${warning}.`));
  }

  const evidence = buildEvidence(rows, query);
  if (rows.reduce((total, row) => total + row.results.length, 0) > evidence.length) {
    caveats.push('Supporting evidence is capped at 60 rows; the calculation uses the complete selected sample.');
  }

  return {
    data: {
      answer: {
        headline,
        summary,
      },
      query,
      queryKey: JSON.stringify(query),
      interpretation,
      metric: {
        id: primaryMetric,
        label: primaryDefinition.label,
        shortLabel: primaryDefinition.shortLabel,
        unit: primaryDefinition.unit,
        direction,
        methodology: primaryDefinition.methodology,
      },
      rows: rows.map(({ results: _results, ...row }) => row),
      evidence,
      sample: {
        ...sample,
        label: scopeLabel(query, sample),
      },
      calculation: {
        metric: primaryMetric,
        definition: primaryDefinition.calculation,
        methodologyRoute: `/methodology#${primaryDefinition.methodology}`,
      },
      caveats,
      relatedRoutes: [
        ...(leader ? [{
          label: `${leader.entity} profile`,
          path: `/${query.season}/drivers/${leader.id}`,
        }] : []),
        {
          label: `${query.season} driver standings`,
          path: `/${query.season}/standings/drivers`,
        },
        ...(rows.length > 1 ? [{
          label: 'Compare the leading drivers',
          path: `/${query.season}/compare?a=${rows[0].id}&b=${rows[1].id}`,
        }] : []),
        {
          label: 'Read the calculation',
          path: `/methodology#${primaryDefinition.methodology}`,
        },
      ],
    },
    meta: {
      ...directory.meta,
      contentVersion: `query-${directory.meta.contentVersion}`,
      warnings: [...new Set(directory.meta.warnings ?? [])],
    },
  };
};
