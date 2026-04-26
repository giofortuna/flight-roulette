import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './airport-db.js';

function makeAirport(overrides: Record<string, unknown> = {}) {
  return {
    icao: 'EGLL', name: 'Heathrow Airport', city: 'London', country: 'GB',
    lat: 51.477, lon: -0.461, max_runway_m: 3902,
    ...overrides,
  };
}

test('validate — accepts valid array', () => {
  const result = validate([makeAirport()], 'europe');
  assert.equal(result.length, 1);
  assert.equal(result[0].icao, 'EGLL');
});

test('validate — throws on empty array', () => {
  assert.throws(() => validate([], 'europe'), /expected non-empty array/);
});

test('validate — throws on non-array', () => {
  assert.throws(() => validate({}, 'europe'), /expected non-empty array/);
});

test('validate — throws on non-string icao', () => {
  assert.throws(() => validate([makeAirport({ icao: 42 })], 'europe'), /invalid entry/);
});

test('validate — throws on non-string name', () => {
  assert.throws(() => validate([makeAirport({ name: null })], 'europe'), /invalid entry/);
});

test('validate — throws on non-string city', () => {
  assert.throws(() => validate([makeAirport({ city: null })], 'europe'), /invalid entry/);
});

test('validate — throws on non-string country', () => {
  assert.throws(() => validate([makeAirport({ country: null })], 'europe'), /invalid entry/);
});

test('validate — throws when lat is NaN or Infinity', () => {
  assert.throws(() => validate([makeAirport({ lat: NaN })],      'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ lat: Infinity })], 'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ lat: '51.4' })],   'europe'), /invalid entry/);
});

test('validate — throws when lon is NaN or Infinity', () => {
  assert.throws(() => validate([makeAirport({ lon: NaN })],      'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ lon: Infinity })], 'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ lon: '-0.46' })],  'europe'), /invalid entry/);
});

test('validate — throws when max_runway_m is NaN, Infinity, or negative', () => {
  assert.throws(() => validate([makeAirport({ max_runway_m: NaN })],      'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ max_runway_m: Infinity })], 'europe'), /invalid entry/);
  assert.throws(() => validate([makeAirport({ max_runway_m: -1 })],       'europe'), /invalid entry/);
});

test('validate — accepts max_runway_m of zero', () => {
  assert.doesNotThrow(() => validate([makeAirport({ max_runway_m: 0 })], 'europe'));
});

test('validate — accepts optional scheduled field as boolean or absent', () => {
  assert.doesNotThrow(() => validate([makeAirport({ scheduled: true })],  'europe'));
  assert.doesNotThrow(() => validate([makeAirport({ scheduled: false })], 'europe'));
  assert.doesNotThrow(() => validate([makeAirport()], 'europe'));
});

test('validate — error message includes region name', () => {
  assert.throws(() => validate([], 'namerica'), /namerica/);
  assert.throws(() => validate([makeAirport({ lat: NaN })], 'asia'), /asia/);
});
