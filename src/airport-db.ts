import type { AirportRegion } from './types.js';

export interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  max_runway_m: number;
  scheduled?: boolean; // undefined in older JSON files → treated as true
}

const _cache = new Map<AirportRegion, Airport[]>();

export function validate(data: unknown, region: AirportRegion): Airport[] {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error(`airports-${region}.json: expected non-empty array`);
  for (const item of data) {
    if (typeof item.icao !== 'string'
     || typeof item.name !== 'string'
     || typeof item.city !== 'string'
     || typeof item.country !== 'string'
     || !Number.isFinite(item.lat)
     || !Number.isFinite(item.lon)
     || !Number.isFinite(item.max_runway_m)   || item.max_runway_m < 0
     || (item.scheduled !== undefined && typeof item.scheduled !== 'boolean'))
      throw new Error(`airports-${region}.json: invalid entry "${item.icao}"`);
  }
  return data as Airport[];
}

export async function loadRegion(region: AirportRegion): Promise<Airport[]> {
  const cached = _cache.get(region);
  if (cached) return cached;
  const res = await fetch(new URL(`../data/airports-${region}.json`, import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load airports-${region}.json: ${res.status}`);
  const airports = validate(await res.json(), region);
  _cache.set(region, airports);
  return airports;
}

// Record<AirportRegion, 1> enforces exhaustiveness: TypeScript errors here if AirportRegion gains a new member.
const ALL_REGIONS: Record<AirportRegion, 1> = {
  europe: 1, namerica: 1, asia: 1, africa: 1, pacific: 1, sam: 1,
};

export async function loadAll(): Promise<Airport[]> {
  // 'caribbean' has no airport file — T-prefix airports are mapped to 'sam' by the build script
  const chunks = await Promise.all((Object.keys(ALL_REGIONS) as AirportRegion[]).map(loadRegion));
  return chunks.flat();
}

export function filterByRunway(airports: Airport[], minRunwayM: number): Airport[] {
  return airports.filter(a => a.max_runway_m >= minRunwayM);
}
