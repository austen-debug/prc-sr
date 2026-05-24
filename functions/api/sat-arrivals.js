function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
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

function normalizeArrival(flight) {
  const scheduledValue = flight.arr_time || flight.arr_time_utc || '';
  const estimatedValue = flight.arr_estimated || flight.arr_actual || flight.arr_time || flight.arr_estimated_utc || flight.arr_actual_utc || '';

  return {
    flight: flight.flight_iata || flight.cs_flight_iata || flight.flight_icao || '',
    airline: flight.airline_iata || flight.airline_icao || '',
    origin: flight.dep_iata || flight.dep_icao || '',
    scheduled: formatTime(scheduledValue),
    estimated: formatTime(estimatedValue),
    gate: flight.arr_gate || '',
    terminal: flight.arr_terminal || '',
    baggage: flight.arr_baggage || '',
    status: normalizeStatus(flight),
    rawStatus: flight.status || '',
    arrivalTimestamp: Number(flight.arr_time_ts || flight.arr_estimated_ts || flight.arr_actual_ts || 0),
    delayMinutes: Number(flight.arr_delayed || flight.delayed || 0)
  };
}

export async function onRequestGet({ env }) {
  try {
    const apiKey = env.AIRLABS_API_KEY;

    if (!apiKey) {
      return jsonResponse({
        isOk: false,
        error: 'AIRLABS_API_KEY is not configured.'
      }, 500);
    }

    const url = new URL('https://airlabs.co/api/v9/schedules');
    url.searchParams.set('arr_iata', 'SAT');
    url.searchParams.set('limit', '100');
    url.searchParams.set('api_key', apiKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const payload = await response.json();

    if (!response.ok || payload.error) {
      return jsonResponse({
        isOk: false,
        error: payload?.error?.message || `AirLabs request failed with HTTP ${response.status}.`
      }, response.ok ? 502 : response.status);
    }

    const arrivals = (payload.response || [])
      .map(normalizeArrival)
      .filter(arrival => arrival.flight || arrival.origin)
      .sort((a, b) => (a.arrivalTimestamp || 0) - (b.arrivalTimestamp || 0));

    return jsonResponse({
      isOk: true,
      airport: 'SAT',
      source: 'AirLabs',
      lastUpdated: new Date().toISOString(),
      note: 'AirLabs schedules return live/current schedule coverage and may not include every arrival for the full calendar day on all plans.',
      arrivals
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Unable to load SAT arrivals.'
    }, 500);
  }
}
