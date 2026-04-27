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

const VALID_REGIONS: Record<Region, 1>      = { europe: 1, namerica: 1, asia: 1, africa: 1, pacific: 1, sam: 1, caribbean: 1 };
const VALID_TYPES:   Record<AirlineType, 1> = { passenger: 1, cargo: 1, both: 1 };

let _cache: Airline[] | null = null;

export function validate(data: unknown): Airline[] {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('airlines.json: expected non-empty array');
  for (const item of data) {
    if (typeof item.icao !== 'string'
     || !/^[A-Z]{3}$/.test(item.icao)
     || typeof item.iata !== 'string' || (item.iata !== '' && !/^[A-Z0-9]{2}$/.test(item.iata))
     || typeof item.name !== 'string'
     || typeof item.callsign !== 'string'
     || typeof item.country !== 'string'
     || !(item.region in VALID_REGIONS)
     || !Array.isArray(item.hub)
     || !(item.type in VALID_TYPES)
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
