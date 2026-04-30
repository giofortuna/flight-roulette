import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Format: "27 Apr 2026 - 08:13" (UTC date + UTC time); URLSearchParams encodes spaces as +
function simbriefDateStr(stdMs: number): string {
  const d     = new Date(stdMs);
  const day   = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTHS[d.getUTCMonth()];
  const year  = d.getUTCFullYear();
  const h     = String(d.getUTCHours()).padStart(2, '0');
  const m     = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} - ${h}:${m}`;
}

export function buildSimbriefUrl(route: SelectedRoute, plan: FlightPlan): string {
  const params = new URLSearchParams({
    orig:   route.departure.icao,
    dest:   route.destination.icao,
    type:   route.aircraft.simbrief_type,
    fltnum: plan.flight_number,
    units:  'KGS',
  });
  if (route.airline.simbrief_id) params.set('airline', route.airline.simbrief_id);
  params.set('date', simbriefDateStr(plan.std_ms));
  return `https://www.simbrief.com/system/dispatch.php?${params.toString()}`;
}
