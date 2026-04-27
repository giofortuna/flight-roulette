import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';
import type { DepartureTimeMode, DeparturePeriod } from './types.js';

export interface FlightPlan {
  distance_nm: number;
  block_time_min: number;
  flight_number: string;
  std_ms: number; // UTC epoch ms; use new Date(std_ms) to get correct date + time
}

// Local-time minute ranges [start, exclusive_end) for each period, stepped to 5 min.
// Night wraps midnight: 22:00–05:55 expressed as 22*60 to 30*60 (= 06:00 next day).
const PERIOD_MINUTES: Record<DeparturePeriod, [number, number]> = {
  morning:   [6 * 60,  12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening:   [18 * 60, 22 * 60],
  night:     [22 * 60, 30 * 60],
};

const FIVE_MIN_MS = 5 * 60 * 1000;

export function generateStd(
  mode: DepartureTimeMode,
  period?: DeparturePeriod,
): number {
  if (mode === 'now+45') {
    return Math.round((Date.now() + 45 * 60 * 1000) / FIVE_MIN_MS) * FIVE_MIN_MS;
  }

  if (mode === 'period') {
    const [start, end] = PERIOD_MINUTES[period ?? 'morning'];
    const slots = (end - start) / 5;
    const localMin = start + Math.floor(Math.random() * slots) * 5;
    const d = new Date();
    d.setHours(Math.floor(localMin / 60) % 24, localMin % 60, 0, 0);
    return Math.round(d.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS;
  }

  // random: random UTC hour/min on today's UTC date
  const d = new Date();
  d.setUTCHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 12) * 5, 0, 0);
  return d.getTime();
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
  const std_ms = generateStd(stdMode, stdPeriod);
  return { distance_nm: distanceNm, block_time_min, flight_number, std_ms };
}
