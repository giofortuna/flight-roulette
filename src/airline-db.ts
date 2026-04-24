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

function validate(data: unknown): Airline[] {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('airlines.json: expected non-empty array');
  for (const item of data) {
    if (typeof item.icao !== 'string'
     || typeof item.region !== 'string'
     || typeof item.type !== 'string'
     || !Array.isArray(item.hub))
      throw new Error(`airlines.json: invalid entry "${item.icao}"`);
  }
  return data as Airline[];
}

export async function loadAirlines(): Promise<Airline[]> {
  if (_cache) return _cache;
  const res = await fetch(new URL('../data/airlines.json', import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load airline data: ${res.status}`);
  _cache = validate(await res.json());
  return _cache;
}
