import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';

export interface FlightPlan {
  distance_nm: number;
  block_time_min: number;
  flight_number: string;
}

export function planFlight(
  airline: Airline,
  aircraft: Aircraft,
  distanceNm: number,
): FlightPlan {
  const block_time_min = Math.round((distanceNm / aircraft.cruise_kts) * 60 + 30);
  const flight_number = airline.icao + String(100 + Math.floor(Math.random() * 900));
  return { distance_nm: distanceNm, block_time_min, flight_number };
}
