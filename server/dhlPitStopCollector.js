const DHL_BASE_URL = 'https://inmotion.dhl';
const DHL_CURRENT_PATH = '/en/formula-1/fastest-pit-stop-award';
const DHL_ARCHIVE_PATH = '/en/formula-1/fastest-pit-stop-award/overview';

const decodeHtml = (value = '') => value
  .replace(/&nbsp;|\u00a0/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const stripHtml = (value = '') => decodeHtml(value.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const getAttribute = (html, name) => {
  const match = html.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
};

const fetchText = async (url, fetchImpl) => {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; slipstream-f1-analytics/1.0)',
      accept: 'text/html,application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`DHL ${url} failed with HTTP ${response.status}`);
  }

  return response.text();
};

export const getDhlSeasonPageUrl = (
  year,
  currentYear = new Date().getFullYear(),
) => (
  Number(year) >= Number(currentYear)
    ? `${DHL_BASE_URL}${DHL_CURRENT_PATH}`
    : `${DHL_BASE_URL}${DHL_ARCHIVE_PATH}`
);

export const parseDhlEventInventory = (html) => {
  const sectionTags = html.match(/<section\b[^>]*>/gi) ?? [];
  const eventSection = sectionTags.find((tag) => (
    getAttribute(tag, 'data-type') === 'pit_stop'
    && getAttribute(tag, 'data-statistic') === 'event_info'
  ));

  if (!eventSection) {
    throw new Error('DHL pit-stop event feed was not found on the season page.');
  }

  const dataPath = getAttribute(eventSection, 'data-url');
  const elementId = dataPath?.split('/').filter(Boolean).at(-1);
  if (!dataPath || !elementId) {
    throw new Error('DHL pit-stop event feed did not expose a data endpoint.');
  }

  const inputPattern = new RegExp(
    `<input\\b[^>]*name=["']f1-award-form-${elementId}["'][^>]*>[\\s\\S]*?<\\/label>`,
    'gi',
  );
  const events = (html.match(inputPattern) ?? []).map((block, index) => {
    const input = block.match(/<input\b[^>]*>/i)?.[0] ?? '';
    const label = block.match(/<label\b[^>]*>([\s\S]*?)<\/label>/i)?.[1] ?? '';

    return {
      round: index + 1,
      eventId: Number(getAttribute(input, 'value')),
      circuit: stripHtml(label),
    };
  }).filter((event) => Number.isInteger(event.eventId));

  if (events.length === 0) {
    throw new Error('DHL pit-stop event feed did not list any races.');
  }

  return { dataPath, events };
};

const parseDhlTableRows = (html = '') => {
  const rowBlocks = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

  return rowBlocks.map((row) => (
    (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(stripHtml)
  )).filter((cells) => cells.length >= 6).map((cells) => ({
    position: Number(cells[0]),
    team: cells[1],
    driver: cells[2],
    service_time_seconds: Number(cells[3]),
    lap: Number(cells[4]),
    points: Number(cells[5]),
  })).filter((stop) => (
    Number.isFinite(stop.service_time_seconds)
    && Number.isInteger(stop.lap)
  ));
};

export const parseDhlPitStopResponse = (payload, fallbackRound = null) => {
  const tableStops = parseDhlTableRows(payload?.htmlList?.table);
  const chartStops = Array.isArray(payload?.data?.chart) ? payload.data.chart : [];
  const chartByStop = new Map(chartStops.map((stop) => [
    [
      stop.team,
      stop.lastName,
      Number(stop.lap),
      Number(stop.duration).toFixed(3),
    ].join('|').toLowerCase(),
    stop,
  ]));

  const stops = tableStops.map((stop) => {
    const chartStop = chartByStop.get([
      stop.team,
      stop.driver,
      stop.lap,
      stop.service_time_seconds.toFixed(3),
    ].join('|').toLowerCase());

    return {
      ...stop,
      driver_number: chartStop?.driverNr ?? null,
      driver_code: chartStop?.tla ?? null,
      driver_full_name: chartStop
        ? `${chartStop.firstName} ${chartStop.lastName}`
        : null,
      irregular: Boolean(chartStop?.irregular),
      notes: chartStop?.notes ?? '',
      source_id: chartStop?.id ?? null,
    };
  });

  return {
    round: Number(payload?.data?.sort ?? fallbackRound),
    event_id: payload?.data?.event_id ?? null,
    grand_prix: payload?.data?.list_item_title ?? null,
    stops,
  };
};

export const collectDhlPitStopSeason = async (
  year,
  {
    completedRounds = null,
    fetchImpl = fetch,
    currentYear = new Date().getFullYear(),
  } = {},
) => {
  const pageUrl = getDhlSeasonPageUrl(year, currentYear);
  const pageHtml = await fetchText(pageUrl, fetchImpl);
  const { dataPath, events } = parseDhlEventInventory(pageHtml);
  const roundLimit = Number.isInteger(completedRounds)
    ? Math.min(completedRounds, events.length)
    : events.length;
  const races = [];

  for (const event of events.slice(0, roundLimit)) {
    const endpoint = new URL(dataPath, DHL_BASE_URL);
    endpoint.searchParams.set('event', String(event.eventId));

    const text = await fetchText(endpoint.href, fetchImpl);
    const race = parseDhlPitStopResponse(JSON.parse(text), event.round);
    if (race.stops.length > 0) races.push(race);
  }

  return {
    year: Number(year),
    source: 'DHL Fastest Pit Stop Award',
    source_url: pageUrl,
    collected_at: new Date().toISOString(),
    races,
  };
};

export const mergeDhlPitStopsIntoSeason = (season, dhlSeason) => {
  const dhlByRound = new Map(
    (dhlSeason?.races ?? []).map((race) => [Number(race.round), race]),
  );

  return {
    ...season,
    races: (season?.races ?? []).map((race) => {
      const dhlRace = dhlByRound.get(Number(race.round));
      if (!dhlRace) return race;

      return {
        ...race,
        dhl_pit_stops: dhlRace.stops,
        pit_stop_sources: {
          pit_lane_time: 'Formula1.com Pit Stop Summary',
          service_time: dhlSeason.source,
          dhl_event_id: dhlRace.event_id,
          dhl_source_url: dhlSeason.source_url,
        },
      };
    }),
    dhlPitStopUpdatedAt: dhlSeason?.collected_at,
  };
};
