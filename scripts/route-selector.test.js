import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineNm } from '../dist/route-selector.js';
import { filterByRunway } from '../dist/airport-db.js';

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

const AIRPORTS = [
  { icao: 'EGLL', name: 'Heathrow',  city: 'London',  country: 'GB', lat: 51.477, lon: -0.461, max_runway_m: 3902 },
  { icao: 'EGGW', name: 'Luton',     city: 'London',  country: 'GB', lat: 51.874, lon: -0.368, max_runway_m: 2160 },
  { icao: 'EGKB', name: 'Biggin Hill', city: 'London', country: 'GB', lat: 51.331, lon: 0.032,  max_runway_m: 1823 },
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
