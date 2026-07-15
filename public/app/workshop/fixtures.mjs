export const workshopFixtures = Object.freeze({
  metrics: Object.freeze([
    { label: 'Arrived', value: 857, supportingText: 'Confirmed arrivals' },
    { label: 'Expected', value: 911, supportingText: 'Dorm capacity projection' },
    { label: 'Active Buses', value: 1, state: 'warning', supportingText: 'En route to PRC' },
    { label: 'Awaiting Assignment', value: 18, state: 'stale', supportingText: 'Arrived minus loaded' }
  ]),
  dorms: Object.freeze([
    {
      id: 'dorm-321-a1', name: '321 A1', state: 'open', load: 42, capacity: 48,
      timer: '00:37:24', sex: 'female', location: 'Auditorium 2', assignedStaff: 'A1C Rivera',
      actions: [{ label: 'Open details', action: 'open-dorm', variant: 'secondary' }]
    },
    {
      id: 'dorm-322-b2', name: '322 B2', state: 'closed', load: 46, capacity: 48,
      timer: '00:54:08', spaceForce: true, location: 'PRC East', assignedStaff: 'SrA Patel'
    },
    {
      id: 'dorm-323-c3', name: '323 C3', state: 'empty', load: 0, capacity: 52,
      band: true, location: 'PRC West', assignedStaff: 'Unassigned'
    }
  ]),
  buses: Object.freeze([
    {
      id: 'bus-12', label: 'Bus 12', status: 'active', total: 51, female: 8,
      naturalization: 3, spaceForce: 4, departureTime: '21:15',
      actions: [{ label: 'Confirm arrival', action: 'confirm-bus', variant: 'primary' }]
    },
    {
      id: 'local-3', label: 'Local Arrival 3', status: 'arrived', total: 6, female: 1,
      naturalization: 0, spaceForce: 0, arrivalTime: '21:42'
    }
  ]),
  table: Object.freeze({
    caption: 'Airport Bus Log',
    columns: Object.freeze([
      { key: 'bus', label: 'Bus' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'OTW' },
      { key: 'female', label: 'Female' },
      { key: 'naturalization', label: 'NAT' },
      { key: 'spaceForce', label: 'Space Force' }
    ]),
    rows: Object.freeze([
      { bus: 'Bus 12', status: 'En route', total: 51, female: 8, naturalization: 3, spaceForce: 4 },
      { bus: 'Bus 11', status: 'Arrived', total: 49, female: 7, naturalization: 2, spaceForce: 0 },
      { bus: 'Local 3', status: 'Arrived', total: 6, female: 1, naturalization: 0, spaceForce: 0 }
    ])
  })
});
