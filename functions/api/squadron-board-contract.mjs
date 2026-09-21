// The Squadron projection is intentionally independent of the general records API.
// Never forward raw records, arbitrary JSON fields, staff, notes, locations or history.
const count = value => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new Error('Invalid operational count.');
  return Math.floor(number);
};
const text = value => String(value ?? '').trim();
const dateMs = value => {
  const result = Date.parse(text(value));
  return Number.isFinite(result) ? result : null;
};
const yes = value => value === true || value === 'true' || value === 1 || value === '1';
const airport = bus => !text(bus.bus_type) || text(bus.bus_type).toLowerCase() === 'airport';
const stateOf = dorm => ['empty','open','closed'].includes(text(dorm.state).toLowerCase()) ? text(dorm.state).toLowerCase() : 'empty';

export function projectSquadronBoard({weekGroup='',dorms=[],buses=[],finalAirport='',nowMs=Date.now()}={}) {
  const group = text(weekGroup);
  const at = new Date(nowMs).toISOString();
  if (!group) return Object.freeze({week_group:null,as_of:at,updated_at:null,
    metrics:{arrived:0,expected:0,latest_confirmed_arrival:null,final_airport_arrival:null},
    traffic:{level:'unavailable',dispatched_last_hour:0,uncertain_dispatches:0},active_buses:[],dorms:[]});
  const ownDorms = dorms.filter(row => text(row.week_group) === group);
  const ownBuses = buses.filter(row => text(row.week_group) === group);
  const airportBuses = ownBuses.filter(airport);
  const arrived = airportBuses.filter(bus => text(bus.status).toLowerCase() === 'arrived');
  const lastArrivalMs = arrived.map(bus => dateMs(bus.arrived_at)).filter(ms => ms !== null && ms <= nowMs + 300000);
  const from = nowMs - 3600000;
  let uncertain = 0;
  let dispatched = 0;
  for (const bus of airportBuses) {
    const departed = dateMs(bus.departed_at);
    if (departed === null || departed > nowMs + 300000) {
      // An active bus without a valid dispatch timestamp could be inbound now.
      const recentArrival = dateMs(bus.arrived_at);
      if (['active','otw'].includes(text(bus.status).toLowerCase()) || (recentArrival !== null && recentArrival >= from)) uncertain++;
      continue;
    }
    if (departed >= from && departed <= nowMs) dispatched++;
  }
  const trafficLevel = uncertain ? 'unavailable' : dispatched >= 3 ? 'heavy' : dispatched === 2 ? 'medium' : 'slow';
  const activeBuses = ownBuses.filter(bus => ['active','otw'].includes(text(bus.status).toLowerCase()))
    .map(bus => ({bus_id:text(bus.bus_id),bus_type:airport(bus)?'airport':'local',
      status:text(bus.status).toLowerCase(),otw_count:count(bus.otw_count),
      departed_at:dateMs(bus.departed_at)===null?null:text(bus.departed_at)}))
    .sort((a,b)=>text(a.departed_at).localeCompare(text(b.departed_at)));
  const allowedDorms = ownDorms.map(dorm => ({
    squadron:text(dorm.sdq),dorm_name:text(dorm.dorm_name),state:stateOf(dorm),
    phase:text(dorm.phase),current_load:count(dorm.current_load),max_load:count(dorm.max_load),
    opened_at:dateMs(dorm.opened_at)===null?null:text(dorm.opened_at),
    closed_timer:text(dorm.closed_timer),female:text(dorm.sex).toLowerCase()==='female',
    band:yes(dorm.band),space_force:yes(dorm.space_force)||yes(dorm.is_space_force),
    display_order:Number.isFinite(Number(dorm.display_order))?Number(dorm.display_order):999
  })).sort((a,b)=>a.display_order-b.display_order||a.squadron.localeCompare(b.squadron)||a.dorm_name.localeCompare(b.dorm_name));
  const timestamps = [...ownDorms,...ownBuses].map(row=>dateMs(row.updated_at)).filter(ms=>ms!==null && ms<=nowMs+300000);
  return Object.freeze({week_group:group,as_of:at,updated_at:timestamps.length?new Date(Math.max(...timestamps)).toISOString():null,
    metrics:{arrived:arrived.reduce((sum,bus)=>sum+count(bus.otw_count),0),
      expected:ownDorms.reduce((sum,dorm)=>sum+count(dorm.max_load),0),
      latest_confirmed_arrival:lastArrivalMs.length?new Date(Math.max(...lastArrivalMs)).toISOString():null,
      final_airport_arrival:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(finalAirport))?text(finalAirport):null},
    traffic:{level:trafficLevel,dispatched_last_hour:dispatched,uncertain_dispatches:uncertain},
    active_buses:activeBuses,dorms:allowedDorms});
}
