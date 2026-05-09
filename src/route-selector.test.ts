import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineNm, pickRoute, NoRouteError, findDestinationFor, findDepartureForDest, buildRerollAircraftPool } from './route-selector.js';
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
    simbrief_type: 'B738', simbrief_airframe_id: '',
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

const INPUT: SelectionInput = { flightTypes: ['passenger'], simulator: 'msfs2020', scheduledOnly: true };

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
  const cargoInput: SelectionInput = { flightTypes: ['cargo'], simulator: 'msfs2020', scheduledOnly: true };
  const route = pickRoute(cargoInput, [makeAircraft({ flight_type: 'cargo' })], [makeAirline({ type: 'both' })], [NEAR_A, NEAR_B]);
  assert.equal(route.airline.type, 'both');
});

test('pickRoute — flightTypes with both passenger and cargo picks from combined aircraft pool', () => {
  const bothInput: SelectionInput = { flightTypes: ['passenger', 'cargo'], simulator: 'msfs2020', scheduledOnly: true };
  // Only a cargo aircraft available — should still find a route
  const route = pickRoute(bothInput, [makeAircraft({ flight_type: 'cargo' })], [makeAirline({ type: 'cargo' })], [NEAR_A, NEAR_B]);
  assert.equal(route.aircraft.flight_type, 'cargo');
});

test('pickRoute — throws NoRouteError when flightTypes does not match any aircraft', () => {
  const cargoInput: SelectionInput = { flightTypes: ['cargo'], simulator: 'msfs2020', scheduledOnly: true };
  assert.throws(
    () => pickRoute(cargoInput, [makeAircraft({ flight_type: 'passenger' })], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — throws NoRouteError when no airlines match flightTypes', () => {
  const cargoInput: SelectionInput = { flightTypes: ['cargo'], simulator: 'msfs2020', scheduledOnly: true };
  assert.throws(
    () => pickRoute(cargoInput, [makeAircraft({ flight_type: 'cargo' })], [makeAirline({ type: 'passenger' })], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — airline type matches aircraft type when both flight types selected', () => {
  const bothInput: SelectionInput = { flightTypes: ['passenger', 'cargo'], simulator: 'msfs2020', scheduledOnly: true };
  // One passenger aircraft + one cargo aircraft; one passenger airline + one cargo airline
  const passengerAircraft = makeAircraft({ flight_type: 'passenger' });
  const cargoAircraft     = makeAircraft({ flight_type: 'cargo', icao_type: 'B77F' });
  const passengerAirline  = makeAirline({ icao: 'BAW', type: 'passenger' });
  const cargoAirline      = makeAirline({ icao: 'FDX', type: 'cargo' });
  // Run many times to confirm airline always matches aircraft
  for (let i = 0; i < 50; i++) {
    const route = pickRoute(bothInput, [passengerAircraft, cargoAircraft], [passengerAirline, cargoAirline], [NEAR_A, NEAR_B]);
    assert.ok(
      route.airline.type === 'both' || route.airline.type === route.aircraft.flight_type,
      `airline type ${route.airline.type} should be 'both' or match aircraft flight_type ${route.aircraft.flight_type}`,
    );
  }
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
  assert.ok(route.distanceNm <= aircraft.range_nm * 0.80); // within strict ceiling
});

// ── block time filter ─────────────────────────────────────────────────────────

test('pickRoute — minBlockH excludes routes shorter than minimum hours', () => {
  // NEAR_A and NEAR_B are ~90nm apart: ~0.7h at 450kts; minBlockH=4 eliminates them
  assert.throws(
    () => pickRoute({ ...INPUT, minBlockH: 4 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — maxBlockH excludes routes longer than maximum hours', () => {
  // ~0.7h; maxBlockH=0.1 eliminates them
  assert.throws(
    () => pickRoute({ ...INPUT, maxBlockH: 0.1 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — route within block time window is found', () => {
  // ~90nm at 450kts ≈ 0.7h — within [0.5, 2]
  const route = pickRoute({ ...INPUT, minBlockH: 0.5, maxBlockH: 2 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]);
  assert.ok(route.distanceNm > 0);
});

// ── distance filter ───────────────────────────────────────────────────────────

test('pickRoute — minDistNm excludes routes shorter than minimum', () => {
  // NEAR_A and NEAR_B are ~90nm apart; minDistNm=500 eliminates them
  assert.throws(
    () => pickRoute({ ...INPUT, minDistNm: 500 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — maxDistNm excludes routes longer than maximum', () => {
  // ~90nm; maxDistNm=10 eliminates them
  assert.throws(
    () => pickRoute({ ...INPUT, maxDistNm: 10 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

test('pickRoute — route within distance window is found', () => {
  // ~90nm — within [50, 500]
  const route = pickRoute({ ...INPUT, minDistNm: 50, maxDistNm: 500 }, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B]);
  assert.ok(route.distanceNm >= 50 && route.distanceNm <= 500);
});

// ── findDestinationFor — distance filter ──────────────────────────────────────

test('findDestinationFor — minDistNm excludes destinations closer than minimum', () => {
  // NEAR_A → NEAR_B is ~90nm; minDistNm=500 returns null
  const result = findDestinationFor(NEAR_A, makeAircraft(), [NEAR_B], undefined, undefined, 500);
  assert.equal(result, null);
});

test('findDestinationFor — maxDistNm excludes destinations farther than maximum', () => {
  // ~90nm; maxDistNm=10 returns null
  const result = findDestinationFor(NEAR_A, makeAircraft(), [NEAR_B], undefined, undefined, undefined, 10);
  assert.equal(result, null);
});

test('findDestinationFor — route within distance window is found', () => {
  const result = findDestinationFor(NEAR_A, makeAircraft(), [NEAR_B], undefined, undefined, 50, 500);
  assert.ok(result !== null && result.distanceNm >= 50 && result.distanceNm <= 500);
});

// ── findDepartureForDest — distance filter ────────────────────────────────────

test('findDepartureForDest — minDistNm excludes departures closer than minimum', () => {
  const result = findDepartureForDest(NEAR_B, makeAircraft(), [NEAR_A], undefined, undefined, 500);
  assert.equal(result, null);
});

test('findDepartureForDest — maxDistNm excludes departures farther than maximum', () => {
  const result = findDepartureForDest(NEAR_B, makeAircraft(), [NEAR_A], undefined, undefined, undefined, 10);
  assert.equal(result, null);
});

test('findDepartureForDest — route within distance window is found', () => {
  const result = findDepartureForDest(NEAR_B, makeAircraft(), [NEAR_A], undefined, undefined, 50, 500);
  assert.ok(result !== null && result.distanceNm >= 50 && result.distanceNm <= 500);
});

// ── departure region filter ───────────────────────────────────────────────────

test('pickRoute — departure scoped to provided pool', () => {
  // NEAR_A is the only departure candidate; NEAR_B is destination-only
  const route = pickRoute(INPUT, [makeAircraft()], [makeAirline()], [NEAR_A, NEAR_B], [NEAR_A]);
  assert.equal(route.departure.icao, 'XAAA');
  assert.equal(route.destination.icao, 'XBBB');
});

test('pickRoute — throws NoRouteError when departure scope has no runway-eligible airports', () => {
  const tinyRunway = makeAirport('XTNY', 0, 0.5, { max_runway_m: 100 });
  assert.throws(
    () => pickRoute(INPUT, [makeAircraft({ min_runway_m: 2000 })], [makeAirline()], [NEAR_A, NEAR_B], [tinyRunway]),
    (err: unknown) => err instanceof NoRouteError,
  );
});

// ── buildRerollAircraftPool ───────────────────────────────────────────────────

test('buildRerollAircraftPool — cargo-only flightTypes blocks passenger aircraft even when airline is both', () => {
  const pax   = makeAircraft({ flight_type: 'passenger', icao_type: 'A320' });
  const cargo = makeAircraft({ flight_type: 'cargo',     icao_type: 'B77F' });
  const pool  = buildRerollAircraftPool([pax, cargo], ['cargo'], 'both', 'msfs2020', 'OTHER', 100, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'B77F');
});

test('buildRerollAircraftPool — cargo airline blocks passenger aircraft regardless of flightTypes', () => {
  const pax   = makeAircraft({ flight_type: 'passenger', icao_type: 'A320' });
  const cargo = makeAircraft({ flight_type: 'cargo',     icao_type: 'B77F' });
  const pool  = buildRerollAircraftPool([pax, cargo], ['passenger', 'cargo'], 'cargo', 'msfs2020', 'OTHER', 100, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'B77F');
});

test('buildRerollAircraftPool — both airline with both flightTypes returns all type-matching aircraft', () => {
  const pax   = makeAircraft({ flight_type: 'passenger', icao_type: 'A320' });
  const cargo = makeAircraft({ flight_type: 'cargo',     icao_type: 'B77F' });
  const pool  = buildRerollAircraftPool([pax, cargo], ['passenger', 'cargo'], 'both', 'msfs2020', 'OTHER', 100, 3000, 3000);
  assert.equal(pool.length, 2);
});

test('buildRerollAircraftPool — excludes current aircraft by icao_type', () => {
  const a1 = makeAircraft({ icao_type: 'A320' });
  const a2 = makeAircraft({ icao_type: 'B738' });
  const pool = buildRerollAircraftPool([a1, a2], ['passenger'], 'passenger', 'msfs2020', 'A320', 100, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'B738');
});

test('buildRerollAircraftPool — excludes aircraft whose range cannot cover the distance', () => {
  // range_nm 500 * 0.80 * 1.2 = 480nm; distance 500nm → excluded
  const shortRange = makeAircraft({ icao_type: 'SH01', range_nm: 500 });
  const longRange  = makeAircraft({ icao_type: 'LG01', range_nm: 5000 });
  const pool = buildRerollAircraftPool([shortRange, longRange], ['passenger'], 'passenger', 'msfs2020', 'OTHER', 500, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'LG01');
});

test('buildRerollAircraftPool — excludes aircraft whose min runway exceeds departure or destination', () => {
  const needs3500 = makeAircraft({ icao_type: 'BIG1', min_runway_m: 3500 });
  const needs2000 = makeAircraft({ icao_type: 'SML1', min_runway_m: 2000 });
  // departure max_runway_m = 3000, destination max_runway_m = 3000
  const pool = buildRerollAircraftPool([needs3500, needs2000], ['passenger'], 'passenger', 'msfs2020', 'OTHER', 100, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'SML1');
});

test('buildRerollAircraftPool — excludes aircraft not available for the selected simulator', () => {
  const msfs2024Only = makeAircraft({ icao_type: '2024', simulator: ['msfs2024'] });
  const bothSims     = makeAircraft({ icao_type: 'BOTH', simulator: ['msfs2020', 'msfs2024'] });
  const pool = buildRerollAircraftPool([msfs2024Only, bothSims], ['passenger'], 'passenger', 'msfs2020', 'OTHER', 100, 3000, 3000);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].icao_type, 'BOTH');
});

