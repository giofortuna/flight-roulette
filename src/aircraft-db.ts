export type FlightType = 'passenger' | 'cargo';
export type Simulator = 'msfs2020' | 'msfs2024' | 'xplane12';

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
     || typeof item.range_nm !== 'number'
     || typeof item.min_runway_m !== 'number'
     || !Array.isArray(item.simulator))
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
