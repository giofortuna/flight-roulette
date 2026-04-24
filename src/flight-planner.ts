import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';
import type { Airport } from './airport-db.js';
import { haversineNm } from './route-selector.js';

export interface FlightPlan {
  distance_nm: number;
  block_time_min: number;
  cruise_fl: number;
  flight_number: string;
}

export function planFlight(
  airline: Airline,
  aircraft: Aircraft,
  departure: Airport,
  destination: Airport,
): FlightPlan {
  const distance_nm = Math.round(haversineNm(departure.lat, departure.lon, destination.lat, destination.lon));
  const block_time_min = Math.round((distance_nm / aircraft.cruise_kts) * 60 + 30);
  const cruise_fl = Math.floor(aircraft.cruise_ft / 100);
  const flight_number = airline.icao + String(100 + Math.floor(Math.random() * 900));
  return { distance_nm, block_time_min, cruise_fl, flight_number };
}
