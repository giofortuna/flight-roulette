import type { FlightType, Simulator } from './types.js';
export type { FlightType, Simulator };

const VALID_FLIGHT_TYPES: Record<FlightType, 1>          = { passenger: 1, cargo: 1 };
const VALID_CATEGORIES:   Record<Aircraft['category'], 1> = { narrowbody: 1, widebody: 1, regional: 1, turboprop: 1 };
const VALID_SIMULATORS:   Record<Simulator, 1>            = { msfs2020: 1, msfs2024: 1, xplane12: 1 };

export interface Aircraft {
  icao_type: string;
  type_name: string;
  airframe_name: string;
  flight_type: FlightType;
  simulator: Simulator[];
  range_nm: number;
  min_runway_m: number;
  cruise_ft: number;
  cruise_kts: number;
  category: 'narrowbody' | 'widebody' | 'regional' | 'turboprop';
  max_pax: number;
  max_cargo_kg: number;
  simbrief_type: string;
  simbrief_airframe_id: string;
}

let _cache: Aircraft[] | null = null;

function validate(data: unknown): Aircraft[] {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error('aircraft.json: expected non-empty array');
  for (const item of data) {
    if (typeof item.icao_type !== 'string'
     || typeof item.type_name !== 'string'
     || typeof item.airframe_name !== 'string'
     || !(item.flight_type in VALID_FLIGHT_TYPES)
     || !Array.isArray(item.simulator)
     || !(item.simulator as unknown[]).every(s => typeof s === 'string' && s in VALID_SIMULATORS)
     || typeof item.range_nm !== 'number'
     || typeof item.min_runway_m !== 'number'
     || typeof item.cruise_ft !== 'number'
     || typeof item.cruise_kts !== 'number'
     || !(item.category in VALID_CATEGORIES)
     || typeof item.max_pax !== 'number'
     || typeof item.max_cargo_kg !== 'number'
     || typeof item.simbrief_type !== 'string'
     || typeof item.simbrief_airframe_id !== 'string')
      throw new Error(`aircraft.json: invalid entry "${item.icao_type}"`);
  }
  return data as Aircraft[];
}

export async function loadAircraft(): Promise<Aircraft[]> {
  if (_cache) return _cache;
  const res = await fetch(new URL('../data/aircraft.json', import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load aircraft data: ${res.status}`);
  _cache = validate(await res.json());
  return _cache;
}
