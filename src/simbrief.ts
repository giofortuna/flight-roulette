import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';
import type { Payload } from './payload-gen.js';

export interface DispatchOptions {
  useRandomPayload: boolean;
}

// TODO(#18): verify pax/cargo params against SimBrief documentation (undocumented as of writing)
export function buildSimbriefUrl(
  route: SelectedRoute,
  plan: FlightPlan,
  payload: Payload,
  options: DispatchOptions,
): string {
  const params = new URLSearchParams({
    orig:   route.departure.icao,
    dest:   route.destination.icao,
    type:   route.aircraft.simbrief_type,
    fltnum: plan.flight_number,
    units:  'KGS',
  });
  if (route.airline.simbrief_id) params.set('airline', route.airline.simbrief_id);

  if (options.useRandomPayload) {
    if (payload.pax !== null) params.set('pax', String(payload.pax));
    params.set('cargo', String(payload.cargo_kg / 1000));
  }

  return `https://www.simbrief.com/system/dispatch.php?${params.toString()}`;
}
