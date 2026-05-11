import type { Aircraft } from './aircraft-db.js';

export function aircraftKey(a: Aircraft): string {
  return `${a.type_name}:${a.airframe_name}`;
}

export function filterEnabledAircraft(all: Aircraft[], disabled: Set<string>): Aircraft[] {
  return disabled.size === 0 ? all : all.filter(a => !disabled.has(aircraftKey(a)));
}
