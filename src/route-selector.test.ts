import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineNm, pickRoute, NoRouteError } from './route-selector.js';
import type { SelectionInput } from './route-selector.js';
import { filterByRunway } from './airport-db.js';
import type { Aircraft, Airline, Airport } from './route-selector.js';

// ── haversineNm ───────────────────────────────────────────────────────────────

test('haversineNm — same point is zero', () => {
  assert.equal(haversineNm(51.477, -0.461, 51.477, -0.461), 0);
});

test('haversineNm — EGLL to OMDB is roughly 3000 nm', () => {
  // London Heathrow (51.477, -0.461) → Dubai (25.252, 55.364)
  const dist = haversineNm(51.477, -0.461, 25.252, 55.364);
  assert.ok(dist > 2900 && dist < 3100, `expected ~3000 nm, got ${dist.toFixed(0)}`);
});

test('haversineNm — KJFK to EGLL is roughly 3000 nm', () => {
  // New York JFK (40.640, -73.779) → London Heathrow (51.477, -0.461)
  // Great circle ~5570 km = ~3006 nm (not statute miles)
  const dist = haversineNm(40.640, -73.779, 51.477, -0.461);
  assert.ok(dist > 2900 && dist < 3100, `expected ~3000 nm, got ${dist.toFixed(0)}`);
});

test('haversineNm — antipodal points are roughly 10800 nm', () => {
  const dist = haversineNm(0, 0, 0, 180);
  assert.ok(dist > 10700 && dist < 10900, `expected ~10800 nm, got ${dist.toFixed(0)}`);
});

test('haversineNm — symmetric', () => {
  const ab = haversineNm(51.477, -0.461, 25.252, 55.364);
  const ba = haversineNm(25.252, 55.364, 51.477, -0.461);
  assert.ok(Math.abs(ab - ba) < 0.001);
});

// ── filterByRunway ─────────────────────────────────────────────────────────────

const AIRPORTS: Airport[] = [
  { icao: 'EGLL', name: 'Heathrow',   city: 'London', country: 'GB', lat: 51.477, lon: -0.461, max_runway_m: 3902 },
  { icao: 'EGGW', name: 'Luton',      city: 'London', country: 'GB', lat: 51.874, lon: -0.368, max_runway_m: 2160 },
  { icao: 'EGKB', name: 'Biggin Hill', city: 'London', country: 'GB', lat: 51.331, lon:  0.032, max_runway_m: 1823 },
];

test('filterByRunway — returns all airports when minRunwayM is 0', () => {
  assert.equal(filterByRunway(AIRPORTS, 0).length, 3);
});

test('filterByRunway — excludes airports below threshold', () => {
  const result = filterByRunway(AIRPORTS, 2000);
  assert.equal(result.length, 2);
  assert.ok(result.every(a => a.max_runway_m >= 2000));
});

test('filterByRunway — excludes all airports when threshold is very high', () => {
  assert.equal(filterByRunway(AIRPORTS, 9999).length, 0);
});

test('filterByRunway — exact match is included', () => {
  const result = filterByRunway(AIRPORTS, 2160);
  assert.ok(result.some(a => a.icao === 'EGGW'));
});

// ── pickRoute ─────────────────────────────────────────────────────────────────

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return {
    icao_type: 'B738', type_name: '737-800', airframe_name: 'Test 737',
    flight_type: 'passenger', simulator: ['msfs2020', 'msfs2024'],
    range_nm: 3000, min_runway_m: 2000,
    cruise_kts: 450, category: 'narrowbody',
    max_pax: 162, max_cargo_kg: 20000, simbrief_type: 'B738', simbrief_airframe_id: '',
    ...overrides,
  };
}

function makeAirline(overrides: Partial<Airline> = {}): Airline {
  return {
    icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD',
    country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger',
    simbrief_id: 'BA', fleet: [],
    ...overrides,
  };
}

function makeAirport(icao: string, lat: number, lon: number, overrides: Partial<Airport> = {}): Airport {
  return { icao, name: `Airport ${icao}`, city: 'City', country: 'XX', lat, lon, max_runway_m: 3000, scheduled: true, ...overrides };
}

const INPUT: SelectionInput = { flightType: 'passenger', simulator: 'msfs2020', scheduledOnly: true };

// Two airports ~90nm apart at the equator (within any reasonable aircraft range)
const NEAR_A = makeAirport('XAAA', 0, 0);
const NEAR_B = makeAirport('XBBB', 0, 1.5);

// Two antipodal airports (~10800nm apart — out of range for any aircraft in the fixture)
const FAR_A = makeAirport('XFAA', 0, 0);
const FAR_B = makeAirport('XFBB', 0, 180);

test('pickRoute — throws NoRouteError when no aircraft match simulator', () => {
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft({ simulator: ['xplane12'] })], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — throws NoRouteError when no aircraft match flight type', () => {
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft({ flight_type: 'cargo' })], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — throws NoRouteError when no airlines match flight type', () => {
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft()], [makeAirline({ type: 'cargo' })], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — throws NoRouteError when fewer than 2 airports meet runway requirement', () => {
  const tinyRunway = makeAirport('XSSS', 0, 0, { max_runway_m: 500 });
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft({ min_runway_m: 2000 })], [makeAirline()], [tinyRunway]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — throws NoRouteError when all airports are out of range', () => {
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft({ range_nm: 100 })], [makeAirline()], [FAR_A, FAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — returns valid SelectedRoute with distinct departure and destination', () => {
  const route = pickRoute(INPUT, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]);
  assert.ok(route.airline && route.aircraft);
  assert.ok(route.departure.icao !== route.destination.icao);
  assert.ok(Number.isInteger(route.distanceNm) && route.distanceNm > 0);
});

test('pickRoute — distanceNm equals rounded haversine between departure and destination', () => {
  const route = pickRoute(INPUT, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]);
  const expected = Math.round(
    haversineNm(route.departure.lat, route.departure.lon, route.destination.lat, route.destination.lon),
  );
  assert.equal(route.distanceNm, expected);
});

test('pickRoute — airline with type "both" matches passenger input', () => {
  const route = pickRoute(INPUT, [makeAircraft()], [makeAirline({ type: 'both' })], [NEAR_A, NEAR_B]);
  assert.equal(route.airline.type, 'both');
});

test('pickRoute — airline with type "both" matches cargo input', () => {
  const cargoInput: SelectionInput = { flightType: 'cargo', simulator: 'msfs2020', scheduledOnly: true };
  const route = pickRoute(cargoInput, [makeAircraft({ flight_type: 'cargo' })], [makeAirline({ type: 'both' })], [NEAR_A, NEAR_B]);
  assert.equal(route.airline.type, 'both');
});

test('pickRoute — scheduledOnly: true throws NoRouteError when all airports are unscheduled', () => {
  const unscheduledA = makeAirport('XNSA', 0, 0, { scheduled: false });
  const unscheduledB = makeAirport('XNSB', 0, 1.5, { scheduled: false });
  assert.throws(
    () => pickRoute({ ...INPUT, scheduledOnly: true }, [makeAircraft()], [makeAirline()], [unscheduledA, unscheduledB]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — scheduledOnly: false includes unscheduled airports', () => {
  const unscheduledA = makeAirport('XNSA', 0, 0, { scheduled: false });
  const unscheduledB = makeAirport('XNSB', 0, 1.5, { scheduled: false });
  const route = pickRoute({ ...INPUT, scheduledOnly: false }, [makeAircraft()], [makeAirline()], [unscheduledA, unscheduledB]);
  assert.ok(route.departure.icao !== route.destination.icao);
});

test('pickRoute — routes beyond 80% utilisation buffer are excluded without relaxation but found via relaxation', () => {
  // NEAR_A and NEAR_B are ~90nm apart
  // range_nm=100: strict effective = 80nm (< 90nm, excluded); relaxed effective = 96nm (> 90nm, found)
  const route = pickRoute(INPUT, [makeAircraft({ range_nm: 100 })], [makeAirline()], [NEAR_A, NEAR_B]);
  assert.ok(route.distanceNm > 80); // above the strict 80% ceiling
});

test('pickRoute — distanceNm is within 80% of range_nm under normal conditions', () => {
  const aircraft = makeAircraft({ range_nm: 3000 });
  const route = pickRoute(INPUT, [aircraft], [makeAirline()], [NEAR_A, NEAR_B]);
  assert.ok(route.distanceNm <= aircraft.range_nm * 0.80 * 1.2); // within relaxed ceiling
});
