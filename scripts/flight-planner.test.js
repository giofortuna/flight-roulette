import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFlight } from '../dist/flight-planner.js';

const AIRLINE = {
  icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD',
  country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger',
  simbrief_id: 'BA', fleet: [],
};

const AIRCRAFT = {
  icao_type: 'B738', type_name: '737-800', airframe_name: 'Test',
  flight_type: 'passenger', simulator: ['msfs2020'],
  range_nm: 3000, min_runway_m: 2000,
  cruise_ft: 35000, cruise_kts: 450, category: 'M',
  max_pax: 162, max_cargo_kg: 20000, simbrief_type: 'B738', simbrief_airframe_id: '',
};

// EGLL → EHAM (~200nm)
const EGLL = { icao: 'EGLL', name: 'Heathrow', city: 'London', country: 'GB', lat: 51.477, lon: -0.461, max_runway_m: 3902 };
const EHAM = { icao: 'EHAM', name: 'Amsterdam', city: 'Amsterdam', country: 'NL', lat: 52.308, lon: 4.764, max_runway_m: 3800 };

test('planFlight — block_time_min is always > 0', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
  assert.ok(plan.block_time_min > 0);
});

test('planFlight — block_time_min includes 30-min buffer', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
  const rawMin = (plan.distance_nm / AIRCRAFT.cruise_kts) * 60;
  assert.ok(plan.block_time_min >= Math.round(rawMin + 30) - 1);
});

test('planFlight — cruise_fl matches aircraft.cruise_ft / 100', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
  assert.equal(plan.cruise_fl, Math.floor(AIRCRAFT.cruise_ft / 100));
});

test('planFlight — flight_number starts with airline ICAO', () => {
  for (let i = 0; i < 20; i++) {
    const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
    assert.ok(plan.flight_number.startsWith(AIRLINE.icao), `got ${plan.flight_number}`);
  }
});

test('planFlight — flight_number suffix is a 3-digit number in [100, 999]', () => {
  for (let i = 0; i < 20; i++) {
    const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
    const suffix = Number(plan.flight_number.slice(AIRLINE.icao.length));
    assert.ok(suffix >= 100 && suffix <= 999, `suffix ${suffix} out of range`);
  }
});

test('planFlight — distance_nm is a positive integer', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, EGLL, EHAM);
  assert.ok(Number.isInteger(plan.distance_nm) && plan.distance_nm > 0);
});
