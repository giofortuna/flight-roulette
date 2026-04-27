import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';
import type { DepartureTimeMode, DeparturePeriod } from './types.js';

export interface FlightPlan {
  distance_nm: number;
  block_time_min: number;
  flight_number: string;
  std_utc: { hour: number; min: number };
}

// Local-time minute ranges [start, exclusive_end) for each period, stepped to 5 min.
// Night wraps midnight: 22:00–05:55 expressed as 22*60 to 30*60 (= 06:00 next day).
const PERIOD_MINUTES: Record<DeparturePeriod, [number, number]> = {
  morning:   [6 * 60,  12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening:   [18 * 60, 22 * 60],
  night:     [22 * 60, 30 * 60],
};

export function generateStd(
  mode: DepartureTimeMode,
  period?: DeparturePeriod,
): { hour: number; min: number } {
  if (mode === 'now+45') {
    const fiveMin = 5 * 60 * 1000;
    const roundedMs = Math.round((Date.now() + 45 * 60 * 1000) / fiveMin) * fiveMin;
    const d = new Date(roundedMs);
    return { hour: d.getUTCHours(), min: d.getUTCMinutes() };
  }

  if (mode === 'period') {
    const [start, end] = PERIOD_MINUTES[period ?? 'morning'];
    const slots = (end - start) / 5;
    const localMin = start + Math.floor(Math.random() * slots) * 5;
    const d = new Date();
    d.setHours(Math.floor(localMin / 60) % 24, localMin % 60, 0, 0);
    return { hour: d.getUTCHours(), min: d.getUTCMinutes() };
  }

  // random
  return {
    hour: Math.floor(Math.random() * 24),
    min:  Math.floor(Math.random() * 12) * 5,
  };
}

export function planFlight(
  airline: Airline,
  aircraft: Aircraft,
  distanceNm: number,
  stdMode: DepartureTimeMode = 'random',
  stdPeriod?: DeparturePeriod,
): FlightPlan {
  const block_time_min = Math.round((distanceNm / aircraft.cruise_kts) * 60 + 30);
  const flight_number = airline.icao + String(100 + Math.floor(Math.random() * 900));
  const std_utc = generateStd(stdMode, stdPeriod);
  return { distance_nm: distanceNm, block_time_min, flight_number, std_utc };
}
