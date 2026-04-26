import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFlight } from './flight-planner.js';
import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';

const AIRLINE: Airline = {
  icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD',
  country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger',
  simbrief_id: 'BA', fleet: [],
};

const AIRCRAFT: Aircraft = {
  icao_type: 'B738', type_name: '737-800', airframe_name: 'Test',
  flight_type: 'passenger', simulator: ['msfs2020'],
  range_nm: 3000, min_runway_m: 2000,
  cruise_kts: 450, category: 'narrowbody',
  max_pax: 162, max_cargo_kg: 20000, simbrief_type: 'B738', simbrief_airframe_id: '',
};

const DISTANCE_NM = 200;

test('planFlight — block_time_min is always > 0', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
  assert.ok(plan.block_time_min > 0);
});

test('planFlight — block_time_min is (distance/cruise_kts)*60 + 30, rounded', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
  const expected = Math.round((DISTANCE_NM / AIRCRAFT.cruise_kts) * 60 + 30);
  assert.equal(plan.block_time_min, expected);
});

test('planFlight — distance_nm echoes the input', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
  assert.equal(plan.distance_nm, DISTANCE_NM);
});

test('planFlight — flight_number starts with airline ICAO', () => {
  for (let i = 0; i < 20; i++) {
    const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
    assert.ok(plan.flight_number.startsWith(AIRLINE.icao), `got ${plan.flight_number}`);
  }
});

test('planFlight — flight_number suffix is a 3-digit number in [100, 999]', () => {
  for (let i = 0; i < 20; i++) {
    const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
    const suffix = Number(plan.flight_number.slice(AIRLINE.icao.length));
    assert.ok(suffix >= 100 && suffix <= 999, `suffix ${suffix} out of range`);
  }
});
