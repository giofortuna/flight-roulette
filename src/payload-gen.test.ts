import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePayload } from './payload-gen.js';
import type { Aircraft } from './aircraft-db.js';

const AIRCRAFT: Aircraft = {
  icao_type: 'B738', type_name: '737-800', airframe_name: 'Test',
  flight_type: 'passenger', simulator: ['msfs2020'],
  range_nm: 3000, min_runway_m: 2000,
  cruise_ft: 35000, cruise_kts: 450, category: 'narrowbody',
  max_pax: 162, max_cargo_kg: 20000, simbrief_type: 'B738', simbrief_airframe_id: '',
};

test('generatePayload — passenger: pax within load-factor range [45%, 95%] of max_pax', () => {
  for (let i = 0; i < 100; i++) {
    const { pax } = generatePayload(AIRCRAFT, 'passenger');
    const min = Math.round(0.45 * AIRCRAFT.max_pax);
    const max = Math.round(0.95 * AIRCRAFT.max_pax);
    assert.ok(pax !== null && pax >= min && pax <= max, `pax ${pax} out of [${min}, ${max}]`);
  }
});

test('generatePayload — passenger: cargo_kg within [0, max_cargo_kg]', () => {
  for (let i = 0; i < 100; i++) {
    const { cargo_kg } = generatePayload(AIRCRAFT, 'passenger');
    assert.ok(cargo_kg >= 0 && cargo_kg <= AIRCRAFT.max_cargo_kg);
  }
});

test('generatePayload — cargo: pax is null', () => {
  for (let i = 0; i < 20; i++) {
    const { pax } = generatePayload(AIRCRAFT, 'cargo');
    assert.equal(pax, null);
  }
});

test('generatePayload — cargo: cargo_kg within [0, max_cargo_kg]', () => {
  for (let i = 0; i < 100; i++) {
    const { cargo_kg } = generatePayload(AIRCRAFT, 'cargo');
    assert.ok(cargo_kg >= 0 && cargo_kg <= AIRCRAFT.max_cargo_kg);
  }
});
