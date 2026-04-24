import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';
import type { Payload } from './payload-gen.js';

export interface DispatchOptions {
  useRandomPayload: boolean;
}

// TODO: verify pax/cargo params against SimBrief documentation (undocumented as of writing)
export function buildSimbriefUrl(
  route: SelectedRoute,
  plan: FlightPlan,
  payload: Payload,
  options: DispatchOptions,
): string {
  const params = new URLSearchParams({
    orig:    route.departure.icao,
    dest:    route.destination.icao,
    type:    route.aircraft.simbrief_type,
    airline: route.airline.simbrief_id,
    fltnum:  plan.flight_number,
    fl:      String(plan.cruise_fl),
    route:   'AUTO',
    units:   'KGS',
  });

  if (options.useRandomPayload) {
    if (payload.pax !== null) params.set('pax', String(payload.pax));
    params.set('cargo', String(payload.cargo_kg));
  }

  return `https://www.simbrief.com/system/dispatch.php?${params.toString()}`;
}
