import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePresetFlightNumber, parsePresetIcao, parsePresetStd, PresetError } from './preset.js';

// ── parsePresetFlightNumber ───────────────────────────────────────────────────

test('parsePresetFlightNumber — blank input means not locked', () => {
  assert.equal(parsePresetFlightNumber(''), null);
  assert.equal(parsePresetFlightNumber('   '), null);
});

test('parsePresetFlightNumber — extracts airline code, uppercases and trims', () => {
  assert.deepEqual(parsePresetFlightNumber(' baw123 '), { flightNumber: 'BAW123', airlineIcao: 'BAW' });
});

test('parsePresetFlightNumber — accepts 1 to 4 digits', () => {
  assert.equal(parsePresetFlightNumber('DLH1')!.flightNumber, 'DLH1');
  assert.equal(parsePresetFlightNumber('DLH1234')!.flightNumber, 'DLH1234');
});

test('parsePresetFlightNumber — rejects malformed values', () => {
  for (const bad of ['123', 'BAWX123', 'BA123', 'BAW12345', 'BAW', 'BAW 123'])
    assert.throws(() => parsePresetFlightNumber(bad), PresetError);
});

// ── parsePresetIcao ───────────────────────────────────────────────────────────

test('parsePresetIcao — blank input means not locked', () => {
  assert.equal(parsePresetIcao('', 'Departure'), null);
});

test('parsePresetIcao — uppercases and trims', () => {
  assert.equal(parsePresetIcao(' eggw ', 'Departure'), 'EGGW');
});

test('parsePresetIcao — rejects wrong lengths and characters', () => {
  for (const bad of ['EGL', 'EGLLX', 'EG L', 'EG-L'])
    assert.throws(() => parsePresetIcao(bad, 'Departure'), PresetError);
});

test('parsePresetIcao — error message names the field', () => {
  assert.throws(() => parsePresetIcao('XX', 'Destination'), /Destination must be/);
});

// ── parsePresetStd ────────────────────────────────────────────────────────────

function localMs(h: number, m: number, dayOffset = 0): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.getTime();
}

test('parsePresetStd — blank input means not locked', () => {
  assert.equal(parsePresetStd(''), null);
});

test('parsePresetStd — future time today resolves to today', () => {
  const now = localMs(8, 0);
  assert.equal(parsePresetStd('16:50', now), localMs(16, 50));
});

test('parsePresetStd — past time rolls to tomorrow', () => {
  const now = localMs(18, 0);
  assert.equal(parsePresetStd('08:30', now), localMs(8, 30, 1));
});

test('parsePresetStd — a time within the 5-minute window counts as today', () => {
  const now = localMs(12, 2);
  assert.equal(parsePresetStd('12:00', now), localMs(12, 0));
});

test('parsePresetStd — rejects malformed and out-of-range times', () => {
  for (const bad of ['25:00', '12:60', '9:30', 'noon'])
    assert.throws(() => parsePresetStd(bad), PresetError);
});
