import type { Region } from './types.js';

export interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  max_runway_m: number;
}

// Must stay in sync with the same table in scripts/build-airport-data.js
const PREFIX_REGION: Record<string, Region> = {
  'B': 'europe',
  'E': 'europe',
  'L': 'europe',
  'U': 'europe',
  'C': 'namerica',
  'K': 'namerica',
  'M': 'namerica',
  'P': 'namerica',
  'S': 'sam',
  'T': 'sam',
  'D': 'africa',
  'F': 'africa',
  'G': 'africa',
  'H': 'africa',
  'O': 'asia',
  'R': 'asia',
  'V': 'asia',
  'W': 'asia',
  'Z': 'asia',
  'N': 'pacific',
  'Y': 'pacific',
};

const _cache = new Map<Region, Airport[]>();

function validate(data: unknown, region: Region): Airport[] {
  if (!Array.isArray(data))
    throw new Error(`airports-${region}.json: expected array`);
  for (const item of data) {
    if (typeof item.icao !== 'string'
     || typeof item.name !== 'string'
     || typeof item.city !== 'string'
     || typeof item.country !== 'string'
     || typeof item.lat !== 'number'
     || typeof item.lon !== 'number'
     || typeof item.max_runway_m !== 'number')
      throw new Error(`airports-${region}.json: invalid entry "${item.icao}"`);
  }
  return data as Airport[];
}

export async function loadRegion(region: Region): Promise<Airport[]> {
  const cached = _cache.get(region);
  if (cached) return cached;
  const res = await fetch(new URL(`../data/airports-${region}.json`, import.meta.url).href);
  if (!res.ok) throw new Error(`Failed to load airports-${region}.json: ${res.status}`);
  const airports = validate(await res.json(), region);
  _cache.set(region, airports);
  return airports;
}

export async function loadAll(): Promise<Airport[]> {
  // 'caribbean' has no airport file — T-prefix airports are mapped to 'sam' by the build script
  const regions: Region[] = ['europe', 'namerica', 'asia', 'africa', 'pacific', 'sam'];
  const chunks = await Promise.all(regions.map(loadRegion));
  return chunks.flat();
}

export function filterByRunway(airports: Airport[], minRunwayM: number): Airport[] {
  return airports.filter(a => a.max_runway_m >= minRunwayM);
}

export function icaoToRegion(icao: string): Region | undefined {
  return PREFIX_REGION[icao[0]];
}
