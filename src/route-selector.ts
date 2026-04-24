import type { FlightType, Simulator } from './types.js';
import { loadAircraft } from './aircraft-db.js';
import type { Aircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';
import type { Airline } from './airline-db.js';
import { loadAll, filterByRunway } from './airport-db.js';
import type { Airport } from './airport-db.js';

export type { Aircraft, Airline, Airport };

export interface SelectionInput {
  flightType: FlightType;
  simulator: Simulator;
}

export interface SelectedRoute {
  airline: Airline;
  aircraft: Aircraft;
  departure: Airport;
  destination: Airport;
  distanceNm: number;
}

export class NoRouteError extends Error {
  constructor(reason: string) {
    super(`Could not find a valid route: ${reason}`);
    this.name = 'NoRouteError';
  }
}

// Haversine formula — returns distance in nautical miles
export function haversineNm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MAX_DEPARTURE_ATTEMPTS = 10;
const RANGE_RELAXATION = 1.2;

export async function selectRoute(input: SelectionInput): Promise<SelectedRoute> {
  const [allAircraft, allAirlines, allAirports] = await Promise.all([
    loadAircraft(),
    loadAirlines(),
    loadAll(),
  ]);

  const airlines = allAirlines.filter(a =>
    a.type === input.flightType || a.type === 'both'
  );
  const aircraft = allAircraft.filter(a =>
    a.flight_type === input.flightType && a.simulator.includes(input.simulator)
  );

  if (aircraft.length === 0)
    throw new NoRouteError(`no aircraft available for ${input.flightType} / ${input.simulator}`);
  if (airlines.length === 0)
    throw new NoRouteError(`no airlines available for flight type ${input.flightType}`);

  const pickedAircraft = pickRandom(aircraft);
  const pickedAirline = pickRandom(airlines);
  const eligibleAirports = filterByRunway(allAirports, pickedAircraft.min_runway_m);

  if (eligibleAirports.length < 2)
    throw new NoRouteError('not enough airports meet runway requirement');

  for (let relaxed = 0; relaxed <= 1; relaxed++) {
    const rangeNm = pickedAircraft.range_nm * (relaxed ? RANGE_RELAXATION : 1);

    for (let attempt = 0; attempt < MAX_DEPARTURE_ATTEMPTS; attempt++) {
      const departure = pickRandom(eligibleAirports);
      const candidates = eligibleAirports
        .filter(a => a.icao !== departure.icao)
        .map(a => ({ airport: a, distNm: haversineNm(departure.lat, departure.lon, a.lat, a.lon) }))
        .filter(({ distNm }) => distNm <= rangeNm);

      if (candidates.length === 0) continue;

      const { airport: destination, distNm } = pickRandom(candidates);
      const distanceNm = Math.round(distNm);

      return { airline: pickedAirline, aircraft: pickedAircraft, departure, destination, distanceNm };
    }
  }

  throw new NoRouteError('exhausted all attempts — no valid departure/destination pair found');
}
