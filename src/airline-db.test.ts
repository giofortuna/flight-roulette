import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './airline-db.js';

function makeAirline(overrides: Record<string, unknown> = {}) {
  return {
    icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD',
    country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger',
    simbrief_id: 'BAW', fleet: [],
    ...overrides,
  };
}

test('validate — accepts valid array', () => {
  const result = validate([makeAirline()]);
  assert.equal(result.length, 1);
  assert.equal(result[0].icao, 'BAW');
});

test('validate — throws on empty array', () => {
  assert.throws(() => validate([]), /expected non-empty array/);
});

test('validate — throws on non-array', () => {
  assert.throws(() => validate({}), /expected non-empty array/);
});

test('validate — throws on invalid region', () => {
  assert.throws(
    () => validate([makeAirline({ region: 'middleeast' })]),
    /invalid entry/,
  );
});

test('validate — throws on invalid type', () => {
  assert.throws(
    () => validate([makeAirline({ type: 'charter' })]),
    /invalid entry/,
  );
});

test('validate — throws when hub is not an array', () => {
  assert.throws(
    () => validate([makeAirline({ hub: 'EGLL' })]),
    /invalid entry/,
  );
});

test('validate — throws on invalid iata format', () => {
  assert.throws(() => validate([makeAirline({ iata: '--' })]),   /invalid entry/); // sentinel from data
  assert.throws(() => validate([makeAirline({ iata: 'BAW' })]), /invalid entry/); // 3 chars
  assert.throws(() => validate([makeAirline({ iata: 'ba' })]),  /invalid entry/); // lowercase
  assert.throws(() => validate([makeAirline({ iata: 'B' })]),   /invalid entry/); // 1 char
});

test('validate — accepts valid iata values', () => {
  assert.doesNotThrow(() => validate([makeAirline({ iata: '' })]));   // no IATA code
  assert.doesNotThrow(() => validate([makeAirline({ iata: 'BA' })])); // 2 letters
  assert.doesNotThrow(() => validate([makeAirline({ iata: '5X' })])); // digit + letter (UPS)
});

test('validate — throws when icao is not 3 uppercase letters', () => {
  assert.throws(() => validate([makeAirline({ icao: 'BA' })]),    /invalid entry/);
  assert.throws(() => validate([makeAirline({ icao: 'BAWA' })]),  /invalid entry/);
  assert.throws(() => validate([makeAirline({ icao: 'ba1' })]),   /invalid entry/);
  assert.throws(() => validate([makeAirline({ icao: '' })]),      /invalid entry/);
});

test('validate — accepts all valid region values', () => {
  const regions = ['europe', 'namerica', 'asia', 'africa', 'pacific', 'sam', 'caribbean'];
  for (const region of regions)
    assert.doesNotThrow(() => validate([makeAirline({ region })]), `region "${region}" should be valid`);
});

test('validate — accepts all valid type values', () => {
  for (const type of ['passenger', 'cargo', 'both'])
    assert.doesNotThrow(() => validate([makeAirline({ type })]), `type "${type}" should be valid`);
});
