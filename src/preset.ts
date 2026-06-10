// Parsing/validation for the "Pre-Set Fields" panel (issue #35).
// Each parser returns null for blank input (field not locked) and throws
// PresetError with a user-facing message for malformed input.

export class PresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetError';
  }
}

const FIVE_MIN_MS = 5 * 60 * 1000;

// Airline ICAO prefix + 1-4 digits, e.g. BAW123. The prefix is used to lock
// the airline so the card stays consistent with the flight number.
export function parsePresetFlightNumber(raw: string): { flightNumber: string; airlineIcao: string } | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  const m = /^([A-Z]{3})(\d{1,4})$/.exec(s);
  if (!m) throw new PresetError('Flight number must be a 3-letter airline code plus 1-4 digits, e.g. BAW123');
  return { flightNumber: s, airlineIcao: m[1] };
}

export function parsePresetIcao(raw: string, label: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z0-9]{4}$/.test(s))
    throw new PresetError(`${label} must be a 4-character ICAO code, e.g. EGLL`);
  return s;
}

// "HH:MM" (from <input type="time">) → epoch ms of the next occurrence of
// that local time, rounded to 5 minutes like generateStd. A time within the
// last 5 minutes counts as now, not yesterday's flight.
export function parsePresetStd(raw: string, nowMs: number = Date.now()): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new PresetError('STD must be a time in HH:MM format');
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new PresetError('STD must be a valid time of day');
  const d = new Date(nowMs);
  d.setHours(h, min, 0, 0);
  if (d.getTime() < nowMs - FIVE_MIN_MS) d.setDate(d.getDate() + 1);
  return Math.round(d.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS;
}
