const CACHE_TTL_SECONDS = 20 * 60;
const CACHE_KEY = 'https://prc-dash.internal/cache/sat-arrivals-v2';

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

function formatTime(value) {
  if (!value) return '';

  const date = new Date(String(value).replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) {
    const parts = String(value).split(' ');
    return parts.length > 1 ? parts[1].slice(0, 5) : String(value);
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Chicago'
  });
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

function normalizeArrival(flight) {
  const scheduledValue = flight.arr_time || flight.arr_time_utc || '';
  const estimatedValue = chooseEstimatedValue(flight);

  return {
    flight: flight.flight_iata || flight.cs_flight_iata || flight.flight_icao || '',
    airline: flight.airline_iata || flight.airline_icao || '',
    operatingFlight: flight.cs_flight_iata || flight.flight_iata || flight.flight_icao || '',
    origin: flight.dep_iata || flight.dep_icao || '',
    scheduled: formatTime(scheduledValue),
    estimated: formatTime(estimatedValue),
    gate: flight.arr_gate || '',
    terminal: flight.arr_terminal || '',
    baggage: flight.arr_baggage || '',
    status: normalizeStatus(flight),
    rawStatus: flight.status || '',
    arrivalTimestamp: Number(flight.arr_time_ts || flight.arr_estimated_ts || flight.arr_actual_ts || 0),
    estimatedTimestamp: Number(flight.arr_estimated_ts || flight.arr_actual_ts || flight.arr_time_ts || 0),
    delayMinutes: Number(flight.arr_delayed || flight.delayed || 0)
  };
}

function dedupeCodeshares(arrivals) {
  const byTrip = new Map();

  for (const arrival of arrivals) {
    const tripKey = [
      arrival.origin || 'UNK',
      arrival.arrivalTimestamp || arrival.estimatedTimestamp || 0,
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

  const arrivals = dedupeCodeshares((payload.response || [])
    .map(normalizeArrival)
    .filter(arrival => arrival.flight || arrival.origin))
    .sort((a, b) => (a.arrivalTimestamp || a.estimatedTimestamp || 0) - (b.arrivalTimestamp || b.estimatedTimestamp || 0));

  return {
    isOk: true,
    airport: 'SAT',
    source: 'AirLabs',
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    lastUpdated: new Date().toISOString(),
    hasMore: Boolean(payload.request?.has_more),
    totalItems: Number(payload.request?.total_items || arrivals.length || 0),
    note: 'AirLabs schedules return live/current schedule coverage and may not include every arrival for the full calendar day on all plans.',
    arrivals
  };
}

async function getCachedPayload() {
  const cache = caches.default;
  const cacheRequest = new Request(CACHE_KEY, { method: 'GET' });
  const cachedResponse = await cache.match(cacheRequest);

  if (!cachedResponse) return null;

  try {
    return await cachedResponse.json();
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
