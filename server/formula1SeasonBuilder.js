const F1_BASE_URL = 'https://www.formula1.com';
const F1_RESULTS_BASE_URL = `${F1_BASE_URL}/en/results`;

const MONTHS = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const SESSION_ALIASES = {
  'practice/1': 'practice_1_results',
  'practice/2': 'practice_2_results',
  'practice/3': 'practice_3_results',
  'sprint-qualifying': 'sprint_qualifying_results',
  'sprint-shootout': 'sprint_qualifying_results',
  'sprint-grid': 'sprint_grid',
  sprint: 'sprint_results',
  'sprint-results': 'sprint_results',
  qualifying: 'qualifying_results',
  'starting-grid': 'starting_grid',
  'pit-stop-summary': 'pit_stops',
  'fastest-laps': 'fastest_laps',
  'race-result': 'race_results',
};

const SESSION_LABELS = {
  'practice/1': 'Practice 1',
  'practice/2': 'Practice 2',
  'practice/3': 'Practice 3',
  'sprint-qualifying': 'Sprint Qualifying',
  'sprint-shootout': 'Sprint Shootout',
  'sprint-grid': 'Sprint Grid',
  sprint: 'Sprint',
  'sprint-results': 'Sprint',
  qualifying: 'Qualifying',
  'starting-grid': 'Starting Grid',
  'pit-stop-summary': 'Pit Stop Summary',
  'fastest-laps': 'Fastest Laps',
  'race-result': 'Race Result',
};

const SESSION_ORDER = [
  'practice/1',
  'practice/2',
  'practice/3',
  'sprint-qualifying',
  'sprint-shootout',
  'sprint-grid',
  'sprint',
  'sprint-results',
  'qualifying',
  'starting-grid',
  'pit-stop-summary',
  'fastest-laps',
  'race-result',
];

const FALLBACK_SESSION_PATHS = [
  'practice/1',
  'practice/2',
  'practice/3',
  'sprint-qualifying',
  'sprint-grid',
  'sprint-results',
  'qualifying',
  'starting-grid',
  'pit-stop-summary',
  'fastest-laps',
  'race-result',
];

const COMPATIBILITY_DEFAULTS = {
  practice_1_results: [],
  practice_2_results: [],
  practice_3_results: [],
  sprint_qualifying_results: [],
  sprint_grid: [],
  sprint_results: [],
  qualifying_results: [],
  starting_grid: [],
  pit_stops: [],
  fastest_laps: [],
  race_results: [],
};

const responseCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toAbsoluteUrl = (href) => href.startsWith('http') ? href : `${F1_BASE_URL}${href}`;

const normalizeSessionPath = (value = '') => value
  .replace(/^\/+|\/+$/g, '')
  .replace(/^en\/results\/\d{4}\/races\/\d+\/[^/]+\//, '')
  .split(/[?#]/)[0]
  .toLowerCase();

const getSessionKey = (path) => {
  const normalized = normalizeSessionPath(path);
  return SESSION_ALIASES[normalized]
    ?? `${normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_results`;
};

const titleCase = (value = '') => value
  .replace(/[-_/]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const getSessionLabel = (path, fallback = '') => {
  const normalized = normalizeSessionPath(path);
  return SESSION_LABELS[normalized] || fallback || titleCase(normalized);
};

const fetchHtml = async (url, { optional = false, attempt = 1 } = {}) => {
  if (responseCache.has(url)) return responseCache.get(url);

  await sleep(150);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; slipstream-f1-analytics/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (response.status === 404 && optional) return null;

  if ((response.status === 429 || response.status >= 500) && attempt <= 5) {
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 1200;
    await sleep(waitMs);
    return fetchHtml(url, { optional, attempt: attempt + 1 });
  }

  if (!response.ok) {
    if (optional) return null;
    throw new Error(`Formula1.com ${url} failed with HTTP ${response.status}`);
  }

  const html = await response.text();
  responseCache.set(url, html);
  return html;
};

const decodeHtml = (value = '') => value
  .replace(/&nbsp;|\u00a0/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripHtml = (html = '') => decodeHtml(html.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const extractResultsTable = (html) => {
  if (!html) return null;

  const wrapperIndex = html.indexOf('id="results-table"');
  if (wrapperIndex === -1) return null;

  const tableStart = html.indexOf('<table', wrapperIndex);
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableStart === -1 || tableEnd === -1) return null;

  return html.slice(tableStart, tableEnd + '</table>'.length);
};

const extractCells = (rowHtml, tagName) => {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return Array.from(rowHtml.matchAll(regex)).map((match) => match[1]);
};

export const parseFormula1Table = (html) => {
  const table = extractResultsTable(html);
  if (!table) return null;

  const headerRow = table.match(/<thead\b[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/i)?.[1];
  const body = table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (!headerRow || !body) return null;

  const headers = extractCells(headerRow, 'th').map(stripHtml);
  const rows = Array.from(body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((match) => {
    const rawCells = extractCells(match[1], 'td');
    return {
      rawCells,
      values: rawCells.map(stripHtml),
    };
  });

  return { headers, rows };
};

const normalizeHeader = (value = '') => value
  .toLowerCase()
  .replace(/\./g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const HEADER_KEYS = {
  pos: 'position',
  position: 'position',
  no: 'car_number',
  number: 'car_number',
  driver: 'driver',
  team: 'team',
  car: 'team',
  laps: 'laps',
  lap: 'lap',
  stops: 'stop_number',
  'time of day': 'time_of_day',
  time: 'time',
  total: 'total',
  'time retired': 'time_or_status',
  'time gap': 'time_or_gap',
  pts: 'points',
  points: 'points',
  'avg speed': 'average_speed',
  q1: 'q1',
  q2: 'q2',
  q3: 'q3',
};

const getHeaderKey = (header) => HEADER_KEYS[normalizeHeader(header)]
  ?? normalizeHeader(header).replace(/\s+/g, '_');

const headerIndex = (headers, ...headerNames) => {
  const normalizedNames = headerNames.map(normalizeHeader);
  return headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
};

const getCell = (table, row, ...headerNames) => {
  const index = headerIndex(table.headers, ...headerNames);
  return index >= 0 ? row.values[index] ?? '' : '';
};

const parseDate = (value, year) => {
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3})$/);
  if (!match) return `${year}-01-01`;

  const [, day, month] = match;
  return `${year}-${MONTHS[month] ?? '01'}-${day.padStart(2, '0')}`;
};

const titleCaseSlug = (slug) => slug
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getRaceLinkInfo = (rawCell) => {
  const href = rawCell.match(/href=(["'])(.*?)\1/i)?.[2];
  const detail = href?.match(/\/races\/(\d+)\/([^/]+)\/race-result/i);
  if (!href || !detail) return null;

  return {
    href: decodeHtml(href),
    raceId: detail[1],
    slug: detail[2],
    name: titleCaseSlug(detail[2]),
  };
};

const getDriverIdentity = (value = '') => {
  const code = value.match(/\s+([A-Z]{3})$/u)?.[1];
  return {
    driver: code ? value.slice(0, -(code.length + 1)).trim() : value.trim(),
    driver_code: code,
  };
};

const parseNumber = (value) => {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : undefined;
};

const parseDurationSeconds = (value = '') => {
  const normalized = value.replace(/^[+]/, '').replace(/s$/i, '').trim();
  if (!normalized || /^(dnf|dns|dsq|nc)$/i.test(normalized)) return undefined;

  const parts = normalized.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return undefined;
};

const parseGenericRows = (table) => {
  if (!table) return [];

  const keys = table.headers.map(getHeaderKey);
  return table.rows.map((row) => {
    const record = {};

    row.values.forEach((value, index) => {
      const key = keys[index] || `column_${index + 1}`;
      record[key] = value;
    });

    if (record.driver) {
      Object.assign(record, getDriverIdentity(record.driver));
    }

    ['position', 'car_number', 'laps', 'lap', 'stop_number', 'points'].forEach((key) => {
      if (record[key] === undefined) return;
      const parsed = parseNumber(record[key]);
      if (parsed !== undefined) record[key] = parsed;
    });

    if (record.time) record.time_seconds = parseDurationSeconds(record.time);
    if (record.total) record.total_seconds = parseDurationSeconds(record.total);

    return record;
  });
};

const getStatus = (positionText, timeText) => {
  const upperTime = timeText.toUpperCase();
  const upperPosition = positionText.toUpperCase();

  if (upperTime.includes('DNF')) return 'DNF';
  if (upperTime.includes('DNS')) return 'DNS';
  if (upperTime.includes('DSQ')) return 'DSQ';
  if (upperPosition === 'NC' && !timeText.startsWith('+')) return upperTime || 'NC';
  return undefined;
};

const parsePoints = (value) => {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
};

const parsePosition = (positionText, index) => {
  const position = Number(positionText);
  return Number.isFinite(position) ? position : index + 1;
};

const getSessionTime = (table, row) => {
  const timeRetired = getCell(table, row, 'Time / Retired', 'Time / Gap', 'Time');
  if (timeRetired) return timeRetired;

  return ['Q3', 'Q2', 'Q1']
    .map((header) => getCell(table, row, header))
    .find(Boolean) ?? '';
};

const parseClassification = (table, sessionKey) => {
  if (!table) return [];

  return table.rows.map((row, index) => {
    const positionText = getCell(table, row, 'Pos.', 'Pos', 'Position');
    const timeText = getSessionTime(table, row);
    const status = getStatus(positionText, timeText);
    const identity = getDriverIdentity(getCell(table, row, 'Driver'));
    const result = {
      position: parsePosition(positionText, index),
      car_number: parseNumber(getCell(table, row, 'No.', 'No', 'Number')),
      ...identity,
      team: getCell(table, row, 'Team', 'Car'),
      points: sessionKey === 'race_results' || sessionKey === 'sprint_results'
        ? parsePoints(getCell(table, row, 'Pts.', 'Pts', 'Points'))
        : 0,
    };

    const laps = parseNumber(getCell(table, row, 'Laps'));
    if (laps !== undefined) result.laps = laps;

    if (timeText && !status) {
      result.time = timeText;
      result.time_seconds = parseDurationSeconds(timeText);
    }

    if (status) {
      result.status = status;
      result.time = null;
    }

    ['Q1', 'Q2', 'Q3'].forEach((qualifyingPart) => {
      const value = getCell(table, row, qualifyingPart);
      if (value) result[qualifyingPart.toLowerCase()] = value;
    });

    return result;
  }).filter((result) => result.driver && result.team);
};

const extractNotes = (html) => {
  if (!html) return [];

  return Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtml(match[1]))
    .filter((value) => /^note\b/i.test(value));
};

const getCircuit = (html, fallback) => {
  const tableIndex = html.indexOf('id="results-table"');
  const beforeTable = tableIndex >= 0 ? html.slice(0, tableIndex) : html;
  const paragraphs = Array.from(beforeTable.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);

  return paragraphs
    .filter((value) => !/\d{4}$/.test(value))
    .at(-1) ?? fallback;
};

export const extractFormula1SessionLinks = (html, raceInfo) => {
  if (!html) return [];

  const baseUrl = new URL(raceInfo.baseRaceUrl);
  const basePath = `${baseUrl.pathname.replace(/\/+$/, '')}/`;
  const links = new Map();
  const anchorRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = decodeHtml(match[2]);
    const label = stripHtml(match[3]);
    let url;

    try {
      url = new URL(href, F1_BASE_URL);
    } catch {
      continue;
    }

    if (!url.pathname.startsWith(basePath)) continue;

    const path = normalizeSessionPath(url.pathname.slice(basePath.length));
    if (!path || path.includes('/archive')) continue;

    if (!links.has(path)) {
      links.set(path, {
        path,
        key: getSessionKey(path),
        label: getSessionLabel(path, label),
        url: url.href,
      });
    }
  }

  if (!links.has('race-result')) {
    links.set('race-result', {
      path: 'race-result',
      key: 'race_results',
      label: 'Race Result',
      url: raceInfo.raceResultUrl,
    });
  }

  const order = new Map(SESSION_ORDER.map((path, index) => [path, index]));
  return Array.from(links.values()).sort((a, b) => {
    const aOrder = order.get(a.path) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.path) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.path.localeCompare(b.path);
  });
};

const getFallbackSessionLinks = (raceInfo) => FALLBACK_SESSION_PATHS.map((path) => ({
  path,
  key: getSessionKey(path),
  label: getSessionLabel(path),
  url: `${raceInfo.baseRaceUrl}/${path}`,
}));

const parseCompatibilityRows = (sessionKey, table) => {
  if ([
    'race_results',
    'qualifying_results',
    'sprint_results',
    'sprint_qualifying_results',
    'practice_1_results',
    'practice_2_results',
    'practice_3_results',
  ].includes(sessionKey)) {
    return parseClassification(table, sessionKey);
  }

  return parseGenericRows(table);
};

const buildSessionRecord = (link, html) => {
  const table = parseFormula1Table(html);
  const rows = parseGenericRows(table);

  return {
    key: link.key,
    path: link.path,
    label: link.label,
    source_url: link.url,
    headers: table?.headers.map(getHeaderKey) ?? [],
    row_count: rows.length,
    rows,
    notes: extractNotes(html),
  };
};

export const getFormula1SeasonRaceList = async (year) => {
  const html = await fetchHtml(`${F1_RESULTS_BASE_URL}/${year}/races`);
  const table = parseFormula1Table(html);
  if (!table) return [];

  return table.rows.map((row, index) => {
    const grandPrixIndex = headerIndex(table.headers, 'Grand Prix');
    const linkInfo = getRaceLinkInfo(row.rawCells[grandPrixIndex] ?? '');
    if (!linkInfo) return null;

    return {
      ...linkInfo,
      year,
      round: index + 1,
      date: parseDate(getCell(table, row, 'Date'), year),
      raceResultUrl: toAbsoluteUrl(linkInfo.href),
      baseRaceUrl: toAbsoluteUrl(linkInfo.href.replace(/\/race-result$/, '')),
    };
  }).filter(Boolean);
};

const loadRace = async (raceInfo) => {
  const raceHtml = await fetchHtml(raceInfo.raceResultUrl);
  const raceTable = parseFormula1Table(raceHtml);
  const raceResults = parseClassification(raceTable, 'race_results');

  if (raceResults.length === 0) {
    return {
      ...COMPATIBILITY_DEFAULTS,
      round: raceInfo.round,
      grand_prix: `${raceInfo.name} Grand Prix`,
      date: raceInfo.date,
      circuit: getCircuit(raceHtml, raceInfo.name),
      sessions: {},
      available_sessions: [],
      source_url: raceInfo.raceResultUrl,
      skipped_sessions: ['race-result'],
    };
  }

  const discoveredLinks = extractFormula1SessionLinks(raceHtml, raceInfo);
  const sessionLinks = discoveredLinks.length > 1 ? discoveredLinks : getFallbackSessionLinks(raceInfo);
  const compatibility = { ...COMPATIBILITY_DEFAULTS, race_results: raceResults };
  const sessions = {};
  const skippedSessions = [];

  for (const link of sessionLinks) {
    try {
      const html = link.path === 'race-result'
        ? raceHtml
        : await fetchHtml(link.url, { optional: true });

      if (!html) {
        skippedSessions.push(link.path);
        continue;
      }

      const record = buildSessionRecord(link, html);
      sessions[link.key] = record;

      const table = parseFormula1Table(html);
      const compatibilityRows = parseCompatibilityRows(link.key, table);
      if (Object.hasOwn(compatibility, link.key)) {
        compatibility[link.key] = compatibilityRows;
      }

      if (record.row_count === 0) skippedSessions.push(link.path);
    } catch (error) {
      skippedSessions.push(`${link.path}: ${error.message}`);
    }
  }

  return {
    ...compatibility,
    round: raceInfo.round,
    grand_prix: `${raceInfo.name} Grand Prix`,
    date: raceInfo.date,
    circuit: getCircuit(raceHtml, raceInfo.name),
    sessions,
    available_sessions: Object.values(sessions)
      .filter((session) => session.row_count > 0)
      .map((session) => session.key),
    source_manifest: Object.values(sessions).map((session) => ({
      key: session.key,
      label: session.label,
      path: session.path,
      rows: session.row_count,
      url: session.source_url,
    })),
    source_url: raceInfo.raceResultUrl,
    skipped_sessions: skippedSessions,
  };
};

const summarizeInventory = (races) => {
  const sessionCounts = {};

  races.forEach((race) => {
    Object.values(race.sessions ?? {}).forEach((session) => {
      if (session.row_count === 0) return;
      sessionCounts[session.key] = (sessionCounts[session.key] ?? 0) + 1;
    });
  });

  return {
    races: races.length,
    sessions: sessionCounts,
    session_types: Object.keys(sessionCounts).sort(),
  };
};

export const buildFormula1Race = async (year, round) => {
  const raceList = await getFormula1SeasonRaceList(year);
  const raceInfo = raceList.find((race) => race.round === Number(round));
  if (!raceInfo) throw new Error(`Formula1.com has no round ${round} for ${year}`);
  return loadRace(raceInfo);
};

export const buildFormula1Season = async (year) => {
  const raceList = await getFormula1SeasonRaceList(year);
  const races = [];
  const skipped = [];

  for (const raceInfo of raceList) {
    try {
      const race = await loadRace(raceInfo);
      if (race.race_results.length === 0) {
        skipped.push({
          race: raceInfo.name,
          reason: 'Race result table was empty',
          url: raceInfo.raceResultUrl,
        });
      } else {
        races.push(race);
      }
    } catch (error) {
      skipped.push({
        race: raceInfo.name,
        reason: error.message,
        url: raceInfo.raceResultUrl,
      });
    }
  }

  return {
    races,
    skipped,
    inventory: summarizeInventory(races),
    source: 'Formula1.com',
    sourceUrl: `${F1_RESULTS_BASE_URL}/${year}/races`,
    year,
    updatedAt: new Date().toISOString(),
  };
};

export const clearFormula1ResponseCache = () => responseCache.clear();
