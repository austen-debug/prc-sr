const CACHE_TTL_SECONDS = 20 * 60;
const WINDOW_HOURS = 24;
const WINDOW_SECONDS = WINDOW_HOURS * 60 * 60;
const CACHE_KEY = 'https://prc-dash.internal/cache/sat-arrivals-v3-next-24';
const CENTRAL_TIME_ZONE = 'America/Chicago';

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function parseScheduleValue(value) {
  if (!value) return null;

  const normalized = String(value).replace(' ', 'T');
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  if (!value) return '';

  const date = parseScheduleValue(value);

  if (!date) {
    const parts = String(value).split(' ');
    return parts.length > 1 ? parts[1].slice(0, 5) : String(value);
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CENTRAL_TIME_ZONE
  });
}

function centralDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CENTRAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatWindowDateTime(seconds) {
  const timestamp = Number(seconds || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

  const dateKey = centralDateKey(date);
  const todayKey = centralDateKey(now);
  const tomorrowKey = centralDateKey(tomorrow);

  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CENTRAL_TIME_ZONE
  });

  if (dateKey === todayKey) return `Today ${time}`;
  if (dateKey === tomorrowKey) return `Tomorrow ${time}`;

  const day = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: CENTRAL_TIME_ZONE
  });

  return `${day} ${time}`;
}

function formatWindowLabel(startSeconds, endSeconds) {
  return `${formatWindowDateTime(startSeconds)} – ${formatWindowDateTime(endSeconds)}`;
}

function normalizeStatus(flight) {
  const rawStatus = String(flight.status || '').toLowerCase();
  const arrDelay = Number(flight.arr_delayed || flight.delayed || 0);

  if (rawStatus.includes('cancel')) return 'CANCELED';
  if (rawStatus === 'landed') return 'ARRIVED';
  if (arrDelay > 0) return 'DELAYED';
  if (rawStatus === 'active') return 'EN ROUTE';
  if (rawStatus === 'scheduled') return 'ON TIME';

  return rawStatus ? rawStatus.toUpperCase() : 'UNKNOWN';
}

function chooseEstimatedValue(flight) {
  return flight.arr_estimated || flight.arr_actual || flight.arr_time || flight.arr_estimated_utc || flight.arr_actual_utc || '';
}

function normalizedTimestamp(value) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;

  // AirLabs timestamps are normally Unix seconds. This guard keeps the app safe if a provider ever returns milliseconds.
  return timestamp > 9999999999 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
}

function normalizeArrival(flight) {
  const scheduledValue = flight.arr_time || flight.arr_time_utc || '';
  const estimatedValue = chooseEstimatedValue(flight);
  const arrivalTimestamp = normalizedTimestamp(flight.arr_time_ts || flight.arr_estimated_ts || flight.arr_actual_ts || 0);
  const estimatedTimestamp = normalizedTimestamp(flight.arr_estimated_ts || flight.arr_actual_ts || flight.arr_time_ts || 0);
  const displayTimestamp = estimatedTimestamp || arrivalTimestamp;

  return {
    flight: flight.flight_iata || flight.cs_flight_iata || flight.flight_icao || '',
    airline: flight.airline_iata || flight.airline_icao || '',
    operatingFlight: flight.cs_flight_iata || flight.flight_iata || flight.flight_icao || '',
    origin: flight.dep_iata || flight.dep_icao || '',
    scheduled: formatWindowDateTime(arrivalTimestamp) || formatTime(scheduledValue),
    estimated: formatWindowDateTime(estimatedTimestamp) || formatTime(estimatedValue),
    scheduledRaw: formatTime(scheduledValue),
    estimatedRaw: formatTime(estimatedValue),
    gate: flight.arr_gate || '',
    terminal: flight.arr_terminal || '',
    baggage: flight.arr_baggage || '',
    status: normalizeStatus(flight),
    rawStatus: flight.status || '',
    arrivalTimestamp,
    estimatedTimestamp,
    displayTimestamp,
    delayMinutes: Number(flight.arr_delayed || flight.delayed || 0)
  };
}

function flightWindowTimestamp(arrival) {
  return Number(arrival.estimatedTimestamp || arrival.arrivalTimestamp || arrival.displayTimestamp || 0);
}

function filterNext24Hours(arrivals, nowSeconds) {
  const windowStart = Number(nowSeconds || Math.floor(Date.now() / 1000));
  const windowEnd = windowStart + WINDOW_SECONDS;

  return arrivals
    .filter(arrival => {
      const timestamp = flightWindowTimestamp(arrival);
      return Number.isFinite(timestamp) && timestamp >= windowStart && timestamp <= windowEnd;
    })
    .sort((a, b) => flightWindowTimestamp(a) - flightWindowTimestamp(b));
}

function dedupeCodeshares(arrivals) {
  const byTrip = new Map();

  for (const arrival of arrivals) {
    const tripKey = [
      arrival.origin || 'UNK',
      arrival.displayTimestamp || arrival.arrivalTimestamp || arrival.estimatedTimestamp || 0,
      arrival.gate || '',
      arrival.terminal || '',
      arrival.operatingFlight || arrival.flight || ''
    ].join('|');

    const existing = byTrip.get(tripKey);

    if (!existing) {
      byTrip.set(tripKey, arrival);
      continue;
    }

    const existingIsOperating = existing.flight === existing.operatingFlight;
    const arrivalIsOperating = arrival.flight === arrival.operatingFlight;

    if (!existingIsOperating && arrivalIsOperating) {
      byTrip.set(tripKey, arrival);
    }
  }

  return Array.from(byTrip.values());
}

async function fetchAirLabsArrivals(apiKey) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowEndSeconds = nowSeconds + WINDOW_SECONDS;

  const url = new URL('https://airlabs.co/api/v9/schedules');
  url.searchParams.set('arr_iata', 'SAT');
  url.searchParams.set('limit', '100');
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw new Error(payload?.error?.message || `AirLabs request failed with HTTP ${response.status}.`);
  }

  const normalizedArrivals = dedupeCodeshares((payload.response || [])
    .map(normalizeArrival)
    .filter(arrival => arrival.flight || arrival.origin));

  const arrivals = filterNext24Hours(normalizedArrivals, nowSeconds);

  return {
    isOk: true,
    airport: 'SAT',
    source: 'AirLabs',
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    lastUpdated: new Date().toISOString(),
    windowHours: WINDOW_HOURS,
    windowStart: new Date(nowSeconds * 1000).toISOString(),
    windowEnd: new Date(windowEndSeconds * 1000).toISOString(),
    windowLabel: formatWindowLabel(nowSeconds, windowEndSeconds),
    hasMore: Boolean(payload.request?.has_more),
    totalItems: Number(payload.request?.total_items || normalizedArrivals.length || 0),
    returnedItems: arrivals.length,
    note: 'PRC DASH filters SAT arrivals to a rolling next-24-hours window and hides flights before the current time.',
    arrivals
  };
}

async function getCachedPayload() {
  const cache = caches.default;
  const cacheRequest = new Request(CACHE_KEY, { method: 'GET' });
  const cachedResponse = await cache.match(cacheRequest);

  if (!cachedResponse) return null;

  try {
    const payload = await cachedResponse.json();
    const windowEnd = new Date(payload.windowEnd || 0).getTime();

    if (!windowEnd || windowEnd <= Date.now()) {
      return null;
    }

    return payload;
  } catch (_) {
    return null;
  }
}

async function putCachedPayload(payload) {
  const cache = caches.default;
  const cacheRequest = new Request(CACHE_KEY, { method: 'GET' });
  const cacheResponse = jsonResponse(payload, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
  });

  await cache.put(cacheRequest, cacheResponse.clone());
}

export async function onRequestGet({ env }) {
  try {
    const cachedPayload = await getCachedPayload();

    if (cachedPayload) {
      return jsonResponse({
        ...cachedPayload,
        fromCache: true,
        servedAt: new Date().toISOString()
      });
    }

    const apiKey = env.AIRLABS_API_KEY;

    if (!apiKey) {
      return jsonResponse({
        isOk: false,
        error: 'AIRLABS_API_KEY is not configured.'
      }, 500);
    }

    const freshPayload = await fetchAirLabsArrivals(apiKey);
    await putCachedPayload(freshPayload);

    return jsonResponse({
      ...freshPayload,
      fromCache: false,
      servedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Unable to load SAT arrivals.'
    }, 500);
  }
}
