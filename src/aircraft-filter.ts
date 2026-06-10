import type { Aircraft } from './aircraft-db.js';

export function aircraftKey(a: Aircraft): string {
  // The airframe id distinguishes custom entries that share a display name.
  // Appended only when non-empty: curated ids are all "" today, and adding a
  // segment unconditionally would invalidate users' stored disabled keys.
  const base = `${a.type_name}:${a.airframe_name}`;
  return a.simbrief_airframe_id ? `${base}:${a.simbrief_airframe_id}` : base;
}

export function filterEnabledAircraft(all: Aircraft[], disabled: Set<string>): Aircraft[] {
  return disabled.size === 0 ? all : all.filter(a => !disabled.has(aircraftKey(a)));
}
