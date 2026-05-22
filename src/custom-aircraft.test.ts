import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomEntry } from './custom-aircraft.js';

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type_name:            'Boeing 737-800',
    airframe_name:        'PMDG',
    simbrief_type:        'B738',
    simbrief_airframe_id: '',
    flight_type:          'passenger',
    simulator:            ['msfs2024'],
    range_nm:             3500,
    min_runway_m:         1800,
    cruise_kts:           450,
    category:             'narrowbody',
    ...overrides,
  };
}

it('validateCustomEntry — accepts valid entry', () => {
  const result = validateCustomEntry(makeEntry());
  assert.equal(result.type_name, 'Boeing 737-800');
  assert.equal(result.airframe_name, 'PMDG');
  assert.equal(result.icao_type, 'B738');
  assert.equal(result.simbrief_type, 'B738');
});

it('validateCustomEntry — uppercases icao_type and simbrief_type', () => {
  const result = validateCustomEntry(makeEntry({ simbrief_type: 'b738' }));
  assert.equal(result.icao_type, 'B738');
  assert.equal(result.simbrief_type, 'B738');
});

it('validateCustomEntry — trims whitespace from string fields', () => {
  const result = validateCustomEntry(makeEntry({ type_name: '  Boeing 737-800  ', simbrief_type: ' b738 ' }));
  assert.equal(result.type_name, 'Boeing 737-800');
  assert.equal(result.simbrief_type, 'B738');
});

it('validateCustomEntry — throws on missing type_name', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ type_name: '' })), /Type name/);
});

it('validateCustomEntry — throws on missing airframe_name', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ airframe_name: '' })), /Addon name/);
});

it('validateCustomEntry — throws on missing simbrief_type', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ simbrief_type: '' })), /SimBrief type/);
});

it('validateCustomEntry — throws on invalid flight_type', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ flight_type: 'helicopter' })), /flight type/);
});

it('validateCustomEntry — accepts passenger and cargo flight types', () => {
  assert.doesNotThrow(() => validateCustomEntry(makeEntry({ flight_type: 'passenger' })));
  assert.doesNotThrow(() => validateCustomEntry(makeEntry({ flight_type: 'cargo' })));
});

it('validateCustomEntry — throws when simulator is empty array', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ simulator: [] })), /simulator/);
});

it('validateCustomEntry — throws on invalid simulator value', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ simulator: ['xplane10'] })), /simulator/);
});

it('validateCustomEntry — accepts msfs2020 and msfs2024', () => {
  assert.doesNotThrow(() => validateCustomEntry(makeEntry({ simulator: ['msfs2020', 'msfs2024'] })));
});

it('validateCustomEntry — throws when range_nm is zero', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ range_nm: 0 })), /Range/);
});

it('validateCustomEntry — throws when range_nm is NaN', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ range_nm: NaN })), /Range/);
});

it('validateCustomEntry — throws when cruise_kts is zero', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ cruise_kts: 0 })), /Cruise/);
});

it('validateCustomEntry — throws when min_runway_m is negative', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ min_runway_m: -1 })), /Min runway/);
});

it('validateCustomEntry — accepts min_runway_m of zero', () => {
  assert.doesNotThrow(() => validateCustomEntry(makeEntry({ min_runway_m: 0 })));
});

it('validateCustomEntry — throws on invalid category', () => {
  assert.throws(() => validateCustomEntry(makeEntry({ category: 'jumbo' })), /category/);
});

it('validateCustomEntry — accepts all valid categories', () => {
  for (const category of ['narrowbody', 'widebody', 'regional', 'turboprop'])
    assert.doesNotThrow(() => validateCustomEntry(makeEntry({ category })));
});

it('validateCustomEntry — simbrief_airframe_id defaults to empty string when absent', () => {
  const data = makeEntry();
  delete data.simbrief_airframe_id;
  const result = validateCustomEntry(data);
  assert.equal(result.simbrief_airframe_id, '');
});
