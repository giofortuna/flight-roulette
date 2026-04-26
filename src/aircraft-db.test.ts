import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './aircraft-db.js';

function makeAircraft(overrides: Record<string, unknown> = {}) {
  return {
    icao_type: 'B738', type_name: '737-800', airframe_name: 'Test 737',
    flight_type: 'passenger', simulator: ['msfs2020', 'msfs2024'],
    range_nm: 3000, min_runway_m: 2000,
    cruise_ft: 35000, cruise_kts: 450, category: 'narrowbody',
    max_pax: 162, max_cargo_kg: 20000,
    simbrief_type: 'B738', simbrief_airframe_id: '',
    ...overrides,
  };
}

test('validate — accepts valid array', () => {
  const result = validate([makeAircraft()]);
  assert.equal(result.length, 1);
  assert.equal(result[0].icao_type, 'B738');
});

test('validate — throws on empty array', () => {
  assert.throws(() => validate([]), /expected non-empty array/);
});

test('validate — throws on non-array', () => {
  assert.throws(() => validate({}), /expected non-empty array/);
});

test('validate — throws on invalid flight_type', () => {
  assert.throws(() => validate([makeAircraft({ flight_type: 'charter' })]), /invalid entry/);
});

test('validate — accepts all valid flight_type values', () => {
  for (const flight_type of ['passenger', 'cargo'])
    assert.doesNotThrow(() => validate([makeAircraft({ flight_type })]), `flight_type "${flight_type}" should be valid`);
});

test('validate — throws on invalid category', () => {
  assert.throws(() => validate([makeAircraft({ category: 'jumbo' })]), /invalid entry/);
});

test('validate — accepts all valid category values', () => {
  for (const category of ['narrowbody', 'widebody', 'regional', 'turboprop'])
    assert.doesNotThrow(() => validate([makeAircraft({ category })]), `category "${category}" should be valid`);
});

test('validate — throws on invalid simulator element', () => {
  assert.throws(() => validate([makeAircraft({ simulator: ['msfs2020', 'fsx'] })]), /invalid entry/);
});

test('validate — accepts all valid simulator values', () => {
  for (const sim of ['msfs2020', 'msfs2024', 'xplane12'])
    assert.doesNotThrow(() => validate([makeAircraft({ simulator: [sim] })]), `simulator "${sim}" should be valid`);
});

test('validate — throws when simulator is not an array', () => {
  assert.throws(() => validate([makeAircraft({ simulator: 'msfs2020' })]), /invalid entry/);
});
