import type { Aircraft } from './aircraft-db.js';
import type { Simulator, FlightType } from './types.js';
import { aircraftKey } from './aircraft-filter.js';

const STORAGE_KEY = 'disp-custom-aircraft';

const VALID_FLIGHT_TYPES = new Set<FlightType>(['passenger', 'cargo']);
const VALID_SIMULATORS   = new Set<Simulator>(['msfs2020', 'msfs2024', 'xplane12']);
const VALID_CATEGORIES   = new Set<Aircraft['category']>(['narrowbody', 'widebody', 'regional', 'turboprop']);

export function loadCustomAircraft(): Aircraft[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(stored); }
  catch { return []; }
  if (!Array.isArray(parsed)) return [];
  // Re-validate each entry so malformed storage (manual edits, schema drift)
  // can never reach route selection
  const valid: Aircraft[] = [];
  for (const entry of parsed) {
    try { valid.push(validateCustomEntry(entry as Record<string, unknown>)); }
    catch { /* drop invalid entry */ }
  }
  return valid;
}

export function saveCustomAircraft(entries: Aircraft[]): void {
  if (entries.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export function validateCustomEntry(data: Record<string, unknown>): Aircraft {
  const { type_name, airframe_name, simbrief_type, simbrief_airframe_id,
          flight_type, simulator, range_nm, min_runway_m, cruise_kts, category } = data;

  if (typeof type_name !== 'string' || !type_name.trim())
    throw new Error('Type name is required');
  if (typeof airframe_name !== 'string' || !airframe_name.trim())
    throw new Error('Addon name is required');
  if (typeof simbrief_type !== 'string' || !simbrief_type.trim())
    throw new Error('SimBrief type code is required');
  if (typeof flight_type !== 'string' || !VALID_FLIGHT_TYPES.has(flight_type as FlightType))
    throw new Error('Invalid flight type');
  if (!Array.isArray(simulator) || simulator.length === 0
   || !simulator.every(s => typeof s === 'string' && VALID_SIMULATORS.has(s as Simulator)))
    throw new Error('At least one simulator must be selected');
  if (!Number.isFinite(range_nm) || (range_nm as number) <= 0)
    throw new Error('Range must be a positive number');
  if (!Number.isFinite(min_runway_m) || (min_runway_m as number) < 0)
    throw new Error('Min runway must be 0 or greater');
  if (!Number.isFinite(cruise_kts) || (cruise_kts as number) <= 0)
    throw new Error('Cruise speed must be a positive number');
  if (typeof category !== 'string' || !VALID_CATEGORIES.has(category as Aircraft['category']))
    throw new Error('Invalid category');

  return {
    icao_type:           (simbrief_type as string).trim().toUpperCase(),
    type_name:           (type_name as string).trim(),
    airframe_name:       (airframe_name as string).trim(),
    flight_type:         flight_type as FlightType,
    simulator:           simulator as Simulator[],
    range_nm:            range_nm as number,
    min_runway_m:        min_runway_m as number,
    cruise_kts:          cruise_kts as number,
    category:            category as Aircraft['category'],
    simbrief_type:       (simbrief_type as string).trim().toUpperCase(),
    simbrief_airframe_id: typeof simbrief_airframe_id === 'string' ? simbrief_airframe_id.trim() : '',
  };
}

export function addCustomAircraft(entry: Aircraft, takenKeys?: ReadonlySet<string>): void {
  const entries = loadCustomAircraft();
  const key = aircraftKey(entry);
  if (takenKeys?.has(key) || entries.some(e => aircraftKey(e) === key))
    throw new Error('An aircraft with this type name and addon already exists');
  entries.push(entry);
  saveCustomAircraft(entries);
}

export function removeCustomAircraftAt(index: number): void {
  const entries = loadCustomAircraft();
  entries.splice(index, 1);
  saveCustomAircraft(entries);
}
