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

test('planFlight — std_ms is a UTC epoch timestamp on a 5-min boundary', () => {
  const plan = planFlight(AIRLINE, AIRCRAFT, DISTANCE_NM);
  assert.ok(typeof plan.std_ms === 'number' && plan.std_ms > 0);
  assert.equal(plan.std_ms % (5 * 60 * 1000), 0);
});

// ── generateStd ───────────────────────────────────────────────────────────────

function assertValidStdMs(ms: number, label: string): void {
  assert.ok(typeof ms === 'number' && ms > 0, `${label}: not a positive number`);
  assert.equal(ms % (5 * 60 * 1000), 0, `${label}: not on a 5-min boundary`);
}

test('generateStd — random returns a 5-min boundary epoch', () => {
  for (let i = 0; i < 50; i++) assertValidStdMs(generateStd('random'), 'random');
});

test('generateStd — now+45 returns a 5-min boundary epoch', () => {
  assertValidStdMs(generateStd('now+45'), 'now+45');
});

test('generateStd — now+45 is within 10 minutes of expected UTC time', () => {
  const fiveMin = 5 * 60 * 1000;
  const before = Date.now();
  const ms = generateStd('now+45');
  const expected = Math.round((before + 45 * 60 * 1000) / fiveMin) * fiveMin;
  assert.ok(Math.abs(ms - expected) <= fiveMin, `expected ~${expected}, got ${ms}`);
});

const PERIOD_LOCAL_RANGES: Record<DeparturePeriod, [number, number]> = {
  morning:   [6 * 60,  12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening:   [18 * 60, 22 * 60],
  night:     [22 * 60, 30 * 60], // 30*60 wraps past midnight to 06:00
};

test('generateStd — period mode returns time within the correct local window', () => {
  const periods: DeparturePeriod[] = ['morning', 'afternoon', 'evening', 'night'];
  for (const period of periods) {
    for (let i = 0; i < 30; i++) {
      const ms = generateStd('period', period);
      assertValidStdMs(ms, `period:${period}`);
      const d = new Date(ms);
      const localMin = d.getHours() * 60 + d.getMinutes();
      const [start, end] = PERIOD_LOCAL_RANGES[period];
      const inRange = end <= 24 * 60
        ? localMin >= start && localMin < end
        : localMin >= start || localMin < end - 24 * 60;
      assert.ok(inRange, `period:${period} — local ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} outside window`);
    }
  }
});

test('generateStd — period mode defaults to morning when period is undefined', () => {
  for (let i = 0; i < 20; i++) {
    const d = new Date(generateStd('period'));
    const localMin = d.getHours() * 60 + d.getMinutes();
    assert.ok(localMin >= 6 * 60 && localMin < 12 * 60,
      `expected morning, got local ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`);
  }
});
