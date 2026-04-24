import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';

export interface FlightPlan {
  distance_nm: number;
  block_time_min: number;
  cruise_fl: number;
  flight_number: string;
}

export function planFlight(
  airline: Airline,
  aircraft: Aircraft,
  distanceNm: number,
): FlightPlan {
  const distance_nm = distanceNm;
  const block_time_min = Math.round((distance_nm / aircraft.cruise_kts) * 60 + 30);
  const cruise_fl = Math.floor(aircraft.cruise_ft / 100);
  const flight_number = airline.icao + String(100 + Math.floor(Math.random() * 900));
  return { distance_nm, block_time_min, cruise_fl, flight_number };
}
