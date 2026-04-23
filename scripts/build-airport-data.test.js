import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSVLine, isHardSurface, round4, buildRunwayMap, processAirports } from './build-airport-data.js';

// ── parseCSVLine ─────────────────────────────────────────────────────────────

test('parseCSVLine — basic comma split', () => {
  assert.deepEqual(parseCSVLine('a,b,c'), ['a', 'b', 'c']);
});

test('parseCSVLine — quoted field containing comma', () => {
  assert.deepEqual(parseCSVLine('"a,b",c'), ['a,b', 'c']);
});

test('parseCSVLine — escaped double-quote inside field', () => {
  assert.deepEqual(parseCSVLine('"say ""hello""",b'), ['say "hello"', 'b']);
});

test('parseCSVLine — empty field between commas', () => {
  assert.deepEqual(parseCSVLine('a,,c'), ['a', '', 'c']);
});

test('parseCSVLine — trailing comma produces empty last field', () => {
  assert.deepEqual(parseCSVLine('a,b,'), ['a', 'b', '']);
});

test('parseCSVLine — single field no comma', () => {
  assert.deepEqual(parseCSVLine('EGLL'), ['EGLL']);
});

// ── isHardSurface ────────────────────────────────────────────────────────────

const HARD = ['ASPH', 'asph', 'CONC', 'CON', 'BIT', 'BRI', 'MAC', 'HLA', 'ASPH-CONC', 'CONC/ASPH'];
const SOFT = ['GRS', 'GRASS', 'GRVL', 'GRV', 'TURF', 'DIRT', 'WATER', 'SAND', 'ICE', ''];

for (const s of HARD) {
  test(`isHardSurface('${s}') → true`, () => assert.equal(isHardSurface(s), true));
}
for (const s of SOFT) {
  test(`isHardSurface('${s}') → false`, () => assert.equal(isHardSurface(s), false));
}

// ── round4 ───────────────────────────────────────────────────────────────────

test('round4 — trims excess precision', () => {
  assert.equal(round4(51.47750091552734), 51.4775);
});

test('round4 — rounds up correctly at 5th decimal', () => {
  assert.equal(round4(1.23456), 1.2346);
});

test('round4 — negative coordinates', () => {
  assert.equal(round4(-33.94619), -33.9462);
});

test('round4 — integer input', () => {
  assert.equal(round4(100), 100);
});

test('round4 — zero', () => {
  assert.equal(round4(0), 0);
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const RUNWAY_ROWS = [
  // EGLL: two runways — pipeline should take the longer one (12008 ft)
  { airport_ident: 'EGLL', length_ft: '12008', surface: 'ASPH', closed: '0' },
  { airport_ident: 'EGLL', length_ft: '11800', surface: 'ASPH', closed: '0' },
  // KORD: concrete runway
  { airport_ident: 'KORD', length_ft: '13000', surface: 'CONC', closed: '0' },
  // YSSY: one grass (excluded), one asphalt (included) — takes the asphalt
  { airport_ident: 'YSSY', length_ft: '14000', surface: 'GRS',  closed: '0' },
  { airport_ident: 'YSSY', length_ft: '12800', surface: 'ASPH', closed: '0' },
  // WMKK: only a closed asphalt runway — excluded entirely
  { airport_ident: 'WMKK', length_ft: '14000', surface: 'ASPH', closed: '1' },
  // ZZZZ: gravel only — soft surface, excluded entirely
  { airport_ident: 'ZZZZ', length_ft: '9000',  surface: 'GRVL', closed: '0' },
];

const AIRPORT_ROWS = [
  { ident: 'EGLL', type: 'large_airport', name: 'Heathrow Airport',     municipality: 'London',       iso_country: 'GB', latitude_deg: '51.47750091', longitude_deg: '-0.46194199' },
  { ident: 'KORD', type: 'large_airport', name: "O'Hare International", municipality: 'Chicago',      iso_country: 'US', latitude_deg: '41.97860',    longitude_deg: '-87.90480'   },
  { ident: 'YSSY', type: 'large_airport', name: 'Sydney Airport',       municipality: 'Sydney',       iso_country: 'AU', latitude_deg: '-33.94610',   longitude_deg: '151.17700'   },
  { ident: 'LFPG', type: 'large_airport', name: 'Charles de Gaulle',    municipality: 'Paris',        iso_country: 'FR', latitude_deg: '49.00970',    longitude_deg: '2.54790'     }, // no runway record at all
  { ident: '00AK', type: 'small_airport', name: 'FAA local',            municipality: 'Anchorage',    iso_country: 'US', latitude_deg: '59.94',       longitude_deg: '-151.69'     }, // FAA code
  { ident: 'LTHP', type: 'heliport',     name: 'Istanbul Heliport',     municipality: 'Istanbul',     iso_country: 'TR', latitude_deg: '41.27',       longitude_deg: '28.73'       }, // wrong type
  { ident: 'WMKK', type: 'large_airport', name: 'KL International',     municipality: 'Kuala Lumpur', iso_country: 'MY', latitude_deg: '2.74557',     longitude_deg: '101.70999'   }, // closed runway only
  { ident: 'ZZZZ', type: 'large_airport', name: 'Gravel Strip',         municipality: 'Nowhere',      iso_country: 'AU', latitude_deg: '-25.0',       longitude_deg: '135.0'       }, // soft runway only
  { ident: 'AXYZ', type: 'large_airport', name: 'Unknown Prefix',       municipality: 'Unknown',      iso_country: 'XX', latitude_deg: '0.0',         longitude_deg: '0.0'         }, // prefix A not in table
];

// ── buildRunwayMap ────────────────────────────────────────────────────────────

test('buildRunwayMap — picks longest runway per airport', () => {
  const { runwayMap } = buildRunwayMap(RUNWAY_ROWS);
  assert.equal(runwayMap.get('EGLL'), Math.round(12008 * 0.3048));
});

test('buildRunwayMap — excludes closed runways', () => {
  const { runwayMap } = buildRunwayMap(RUNWAY_ROWS);
  assert.equal(runwayMap.has('WMKK'), false);
});

test('buildRunwayMap — excludes soft-surface runways, keeps hard one', () => {
  const { runwayMap } = buildRunwayMap(RUNWAY_ROWS);
  assert.ok(runwayMap.has('YSSY'));
  assert.equal(runwayMap.get('YSSY'), Math.round(12800 * 0.3048));
});

test('buildRunwayMap — allRunwayAirports includes airports with only soft/closed runways', () => {
  const { runwayMap, allRunwayAirports } = buildRunwayMap(RUNWAY_ROWS);
  assert.ok(allRunwayAirports.has('WMKK'));
  assert.ok(allRunwayAirports.has('ZZZZ'));
  assert.equal(runwayMap.has('WMKK'), false);
  assert.equal(runwayMap.has('ZZZZ'), false);
});

// ── processAirports ───────────────────────────────────────────────────────────

test('processAirports — valid airports land in the correct region', () => {
  const { regions } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.ok(regions.europe?.some(a => a.icao === 'EGLL'));
  assert.ok(regions.namerica?.some(a => a.icao === 'KORD'));
  assert.ok(regions.pacific?.some(a => a.icao === 'YSSY'));
});

test('processAirports — FAA code skipped as noIcao', () => {
  const { skipped } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.equal(skipped.noIcao, 1);
});

test('processAirports — heliport skipped as wrongType', () => {
  const { skipped } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.equal(skipped.wrongType, 1);
});

test('processAirports — unknown ICAO prefix skipped as unknownRegion', () => {
  const { skipped } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.equal(skipped.unknownRegion, 1); // AXYZ
});

test('processAirports — airport with no runway record at all skipped as noRunwayRecord', () => {
  const { skipped } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.equal(skipped.noRunwayRecord, 1); // LFPG
});

test('processAirports — airports with only soft/closed runways skipped as softRunwayOnly', () => {
  const { skipped } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  assert.equal(skipped.softRunwayOnly, 2); // WMKK, ZZZZ
});

test('processAirports — output record has correct shape with rounded coordinates', () => {
  const { regions } = processAirports(AIRPORT_ROWS, buildRunwayMap(RUNWAY_ROWS));
  const egll = regions.europe.find(a => a.icao === 'EGLL');
  assert.ok(egll);
  assert.equal(typeof egll.name, 'string');
  assert.equal(typeof egll.city, 'string');
  assert.equal(typeof egll.country, 'string');
  assert.equal(typeof egll.lat, 'number');
  assert.equal(typeof egll.lon, 'number');
  assert.equal(typeof egll.max_runway_m, 'number');
  // Coordinates must be rounded to at most 4 decimal places
  assert.ok((egll.lat.toString().split('.')[1] ?? '').length <= 4);
  assert.ok((egll.lon.toString().split('.')[1] ?? '').length <= 4);
});
