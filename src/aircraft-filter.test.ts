import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aircraftKey, filterEnabledAircraft } from './aircraft-filter.js';
import type { Aircraft } from './aircraft-db.js';

function makeAircraft(type_name: string, airframe_name: string, flight_type: 'passenger' | 'cargo' = 'passenger'): Aircraft {
  return {
    icao_type: 'TEST',
    type_name,
    airframe_name,
    flight_type,
    simulator: ['msfs2024'],
    range_nm: 3000,
    min_runway_m: 2000,
    cruise_kts: 450,
    category: 'narrowbody',
    simbrief_type: 'TEST',
    simbrief_airframe_id: '',
  };
}

// ── aircraftKey ───────────────────────────────────────────────────────────────

test('aircraftKey — combines type_name and airframe_name with colon', () => {
  const ac = makeAircraft('Boeing 737-800', 'PMDG');
  assert.equal(aircraftKey(ac), 'Boeing 737-800:PMDG');
});

test('aircraftKey — same type_name different airframe produces distinct keys', () => {
  const fbw = makeAircraft('Airbus A320neo', 'FlyByWire');
  const ini = makeAircraft('Airbus A320neo', 'iniBuilds');
  assert.notEqual(aircraftKey(fbw), aircraftKey(ini));
});

test('aircraftKey — same airframe different type_name produces distinct keys', () => {
  const a350_900  = makeAircraft('Airbus A350-900',  'iniBuilds');
  const a350_1000 = makeAircraft('Airbus A350-1000', 'iniBuilds');
  assert.notEqual(aircraftKey(a350_900), aircraftKey(a350_1000));
});

test('aircraftKey — simbrief_airframe_id distinguishes otherwise identical entries', () => {
  const a = { ...makeAircraft('Boeing 737-800', 'PMDG'), simbrief_airframe_id: 'sb-1' };
  const b = { ...makeAircraft('Boeing 737-800', 'PMDG'), simbrief_airframe_id: 'sb-2' };
  assert.notEqual(aircraftKey(a), aircraftKey(b));
});

// ── filterEnabledAircraft ─────────────────────────────────────────────────────

test('filterEnabledAircraft — empty disabled set returns full list', () => {
  const ac = [makeAircraft('Boeing 737-800', 'PMDG'), makeAircraft('Airbus A320neo', 'FlyByWire')];
  assert.deepEqual(filterEnabledAircraft(ac, new Set()), ac);
});

test('filterEnabledAircraft — disabled key removes that aircraft', () => {
  const a = makeAircraft('Boeing 737-800', 'PMDG');
  const b = makeAircraft('Airbus A320neo', 'FlyByWire');
  const result = filterEnabledAircraft([a, b], new Set([aircraftKey(a)]));
  assert.deepEqual(result, [b]);
});

test('filterEnabledAircraft — all disabled returns empty list', () => {
  const a = makeAircraft('Boeing 737-800', 'PMDG');
  const b = makeAircraft('Airbus A320neo', 'FlyByWire');
  const result = filterEnabledAircraft([a, b], new Set([aircraftKey(a), aircraftKey(b)]));
  assert.equal(result.length, 0);
});

test('filterEnabledAircraft — unknown key in disabled set is ignored', () => {
  const ac = [makeAircraft('Boeing 737-800', 'PMDG')];
  const result = filterEnabledAircraft(ac, new Set(['nonexistent:key']));
  assert.deepEqual(result, ac);
});

test('filterEnabledAircraft — disabled key must match exactly (no partial match)', () => {
  const ac = [makeAircraft('Boeing 737-800', 'PMDG')];
  const result = filterEnabledAircraft(ac, new Set(['Boeing 737-800']));
  assert.deepEqual(result, ac);
});

test('aircraftKey — all entries in aircraft.json produce unique keys', () => {
  const all = JSON.parse(readFileSync(new URL('../data/aircraft.json', import.meta.url), 'utf8')) as Aircraft[];
  const keys = all.map(aircraftKey);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.equal(dupes.length, 0, `duplicate keys: ${dupes.join(', ')}`);
});
