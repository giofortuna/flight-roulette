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

export async function loadAircraft(): Promise<Aircraft[]> {
  if (_cache) return _cache;
  const res = await fetch(new URL('../data/aircraft.json', import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load aircraft data: ${res.status}`);
  _cache = await res.json() as Aircraft[];
  return _cache;
}
