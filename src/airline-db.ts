import type { FlightType } from './aircraft-db.js';

export type Region = 'europe' | 'namerica' | 'asia' | 'africa' | 'pacific' | 'sam' | 'caribbean';

export interface Airline {
  icao: string;
  iata: string;
  name: string;
  callsign: string;
  country: string;
  region: Region;
  hub: string[];
  type: FlightType;
  simbrief_id: string;
  fleet: string[];
}

let _cache: Airline[] | null = null;

export async function loadAirlines(): Promise<Airline[]> {
  if (_cache) return _cache;
  const res = await fetch(new URL('../data/airlines.json', import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load airline data: ${res.status}`);
  _cache = await res.json() as Airline[];
  return _cache;
}
