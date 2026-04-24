import type { FlightType } from './types.js';
import type { Aircraft } from './aircraft-db.js';

export interface Payload {
  pax: number | null;  // null for cargo flights
  cargo_kg: number;
}

export function generatePayload(aircraft: Aircraft, flightType: FlightType): Payload {
  const cargo_kg = Math.round(Math.random() * aircraft.max_cargo_kg);
  if (flightType === 'cargo') {
    return { pax: null, cargo_kg };
  }
  const pax = Math.round((0.45 + Math.random() * 0.5) * aircraft.max_pax);
  return { pax, cargo_kg };
}
