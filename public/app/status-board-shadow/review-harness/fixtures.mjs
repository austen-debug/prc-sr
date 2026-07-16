export const STATUS_BOARD_REVIEW_FIXTURE = Object.freeze({
  id: 'B2-P3A-H001',
  weekGroup: 'WG-REVIEW',
  capturedAt: '2026-07-16T01:30:00Z',
  lastSynchronizedAt: '2026-07-16T01:29:45Z',
  metrics: Object.freeze([
    Object.freeze({ label: 'Arrived', value: '857', supportingText: 'Confirmed arrivals' }),
    Object.freeze({ label: 'Expected', value: '911', supportingText: 'Dorm capacity' }),
    Object.freeze({ label: 'Last Arrival', value: '20:44', supportingText: 'Derived confirmed arrival' }),
    Object.freeze({ label: 'Local Time', value: '20:46', supportingText: 'Central Time' })
  ]),
  buses: Object.freeze([
    Object.freeze({ id: 'review-bus-12', label: 'Review Bus 12', status: 'active', total: 48, female: 10, naturalization: 3, spaceForce: 4, departureTime: '20:20', arrivalTime: '—' }),
    Object.freeze({ id: 'review-local-1', label: 'Review Local 1', status: 'arrived', total: 8, female: 2, naturalization: 0, spaceForce: 0, departureTime: '—', arrivalTime: '20:31' })
  ]),
  dorms: Object.freeze([
    Object.freeze({ id: 'review-a1', name: 'Review A1', state: 'empty', load: 0, capacity: 52, location: 'Auditorium 1' }),
    Object.freeze({ id: 'review-a2', name: 'Review A2', state: 'open', load: 41, capacity: 52, location: 'Auditorium 2', timer: '42:15' }),
    Object.freeze({ id: 'review-a3', name: 'Review A3', state: 'open', load: 52, capacity: 52, location: 'Auditorium 3', timer: '52:07', spaceForce: true }),
    Object.freeze({ id: 'review-b1', name: 'Review B1', state: 'closed', load: 50, capacity: 50, location: 'Auditorium 4', timer: '38:40', sex: 'female' }),
    Object.freeze({ id: 'review-b2', name: 'Review B2', state: 'closed', load: 49, capacity: 50, location: 'Auditorium 5', timer: '61:10', overtime: true })
  ])
});

export const REVIEW_CONNECTION_STATES = Object.freeze([
  Object.freeze({ id: 'current', label: 'Current', message: 'Operational data is current.', readOnly: false }),
  Object.freeze({ id: 'stale', label: 'Stale · read only', message: 'Another tab changed operational data. Last confirmed information remains visible while refresh is required.', readOnly: true }),
  Object.freeze({ id: 'offline', label: 'Offline · read only', message: 'Network connectivity is unavailable. Last confirmed information remains visible and writes are disabled.', readOnly: true })
]);
