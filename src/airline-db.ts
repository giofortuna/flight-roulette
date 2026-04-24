import type { AirlineType, Region } from './types.js';
export type { AirlineType, Region };

export interface Airline {
  icao: string;
  iata: string;
  name: string;
  callsign: string;
  country: string;
  region: Region;
  hub: string[];
  type: AirlineType;
  simbrief_id: string;
  fleet: string[];
}

let _cache: Airline[] | null = null;

function validate(data: unknown): Airline[] {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('airlines.json: expected non-empty array');
  for (const item of data) {
    if (typeof item.icao !== 'string'
     || typeof item.iata !== 'string'
     || typeof item.name !== 'string'
     || typeof item.callsign !== 'string'
     || typeof item.country !== 'string'
     || typeof item.region !== 'string'
     || !Array.isArray(item.hub)
     || typeof item.type !== 'string'
     || typeof item.simbrief_id !== 'string'
     || !Array.isArray(item.fleet))
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
