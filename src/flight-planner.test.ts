import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFlight, generateStd } from './flight-planner.js';
import type { DeparturePeriod } from './types.js';
import type { Airline } from './airline-db.js';
import type { Aircraft } from './aircraft-db.js';

const AIRLINE: Airline = {
  icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD',
  country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger',
  simbrief_id: 'BAW', fleet: [],
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

test('planFlight — std_utc has valid hour and min', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
  assert.ok(plan.std_utc.hour >= 0 && plan.std_utc.hour <= 23);
  assert.ok(plan.std_utc.min  >= 0 && plan.std_utc.min  <= 55);
  assert.equal(plan.std_utc.min % 5, 0);
});

// ── generateStd ───────────────────────────────────────────────────────────────

function assertValidStd({ hour, min }: { hour: number; min: number }, label: string): void {
  assert.ok(hour >= 0 && hour <= 23, `${label}: hour ${hour} out of range`);
  assert.ok(min  >= 0 && min  <= 55, `${label}: min ${min} out of range`);
  assert.equal(min % 5, 0,           `${label}: min ${min} not a 5-min step`);
}

test('generateStd — random produces valid UTC hour and 5-min step', () => {
  for (let i = 0; i < 50; i++) assertValidStd(generateStd('random'), 'random');
});

test('generateStd — now+45 produces valid UTC hour and 5-min step', () => {
  assertValidStd(generateStd('now+45'), 'now+45');
});

test('generateStd — now+45 is within 10 minutes of expected UTC time', () => {
  const fiveMin = 5 * 60 * 1000;
  const before = Date.now();
  const result = generateStd('now+45');
  const after  = Date.now();
  const resultTotalMin = result.hour * 60 + result.min;
  const expectedMs = Math.round((before + 45 * 60 * 1000) / fiveMin) * fiveMin;
  const expectedTotalMin = Math.floor(expectedMs / 60000) % (24 * 60);
  // Allow ±10 min to account for rounding and midnight wrap comparisons
  const diff = Math.abs(resultTotalMin - expectedTotalMin);
  assert.ok(diff <= 10 || diff >= 24 * 60 - 10, `expected ~${expectedTotalMin} min, got ${resultTotalMin}`);
});

const PERIOD_LOCAL_RANGES: Record<DeparturePeriod, [number, number]> = {
  morning:   [6 * 60,  12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening:   [18 * 60, 22 * 60],
  night:     [22 * 60, 30 * 60], // 30*60 means wrap past midnight to 06:00
};

test('generateStd — period mode returns time within the correct local window', () => {
  const periods: DeparturePeriod[] = ['morning', 'afternoon', 'evening', 'night'];
  for (const period of periods) {
    for (let i = 0; i < 30; i++) {
      const std = generateStd('period', period);
      assertValidStd(std, `period:${period}`);
      // Convert UTC result back to local minutes to verify the window
      const d = new Date();
      d.setUTCHours(std.hour, std.min, 0, 0);
      const localMin = d.getHours() * 60 + d.getMinutes();
      const [start, end] = PERIOD_LOCAL_RANGES[period];
      const inRange = end <= 24 * 60
        ? localMin >= start && localMin < end
        : localMin >= start || localMin < end - 24 * 60; // night wraps midnight
      assert.ok(inRange, `period:${period} — local ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} outside window`);
    }
  }
});

test('generateStd — period mode defaults to morning when period is undefined', () => {
  for (let i = 0; i < 20; i++) {
    const std = generateStd('period');
    const d = new Date();
    d.setUTCHours(std.hour, std.min, 0, 0);
    const localMin = d.getHours() * 60 + d.getMinutes();
    assert.ok(localMin >= 6 * 60 && localMin < 12 * 60,
      `expected morning, got local ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`);
  }
});
