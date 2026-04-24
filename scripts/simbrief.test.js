import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSimbriefUrl } from '../dist/simbrief.js';

const ROUTE = {
  airline:  { icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD', country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger', simbrief_id: 'BA', fleet: [] },
  aircraft: { icao_type: 'B738', type_name: '737-800', airframe_name: 'Test', flight_type: 'passenger', simulator: ['msfs2020'], range_nm: 3000, min_runway_m: 2000, cruise_ft: 35000, cruise_kts: 450, category: 'M', max_pax: 162, max_cargo_kg: 20000, simbrief_type: 'B738', simbrief_airframe_id: '' },
  departure:   { icao: 'EGLL', name: 'Heathrow',  city: 'London',    country: 'GB', lat: 51.477, lon: -0.461, max_runway_m: 3902 },
  destination: { icao: 'EHAM', name: 'Amsterdam', city: 'Amsterdam', country: 'NL', lat: 52.308, lon:  4.764, max_runway_m: 3800 },
  distanceNm: 200,
};

const PLAN = { distance_nm: 200, block_time_min: 57, cruise_fl: 350, flight_number: 'BAW442' };
const PAYLOAD_PAX  = { pax: 130, cargo_kg: 5000 };
const PAYLOAD_CARGO = { pax: null, cargo_kg: 18000 };

function parseUrl(url) {
  const [base, qs] = url.split('?');
  return { base, params: new URLSearchParams(qs) };
}

test('buildSimbriefUrl — base URL is correct', () => {
  const { base } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, PAYLOAD_PAX, { useRandomPayload: false }));
  assert.equal(base, 'https://www.simbrief.com/system/dispatch.php');
});

test('buildSimbriefUrl — required params always present', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, PAYLOAD_PAX, { useRandomPayload: false }));
  assert.equal(params.get('orig'),    'EGLL');
  assert.equal(params.get('dest'),    'EHAM');
  assert.equal(params.get('type'),    'B738');
  assert.equal(params.get('airline'), 'BA');
  assert.equal(params.get('fltnum'),  'BAW442');
  assert.equal(params.get('fl'),      null);
  assert.equal(params.get('route'),   null);
  assert.equal(params.get('units'),   'KGS');
});

test('buildSimbriefUrl — useRandomPayload false omits pax and cargo', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, PAYLOAD_PAX, { useRandomPayload: false }));
  assert.equal(params.get('pax'),   null);
  assert.equal(params.get('cargo'), null);
});

test('buildSimbriefUrl — useRandomPayload true includes pax and cargo for passenger flight', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, PAYLOAD_PAX, { useRandomPayload: true }));
  assert.equal(params.get('pax'),   '130');
  assert.equal(params.get('cargo'), '5');
});

test('buildSimbriefUrl — useRandomPayload true omits pax for cargo flight (pax=null)', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, PAYLOAD_CARGO, { useRandomPayload: true }));
  assert.equal(params.get('pax'),   null);
  assert.equal(params.get('cargo'), '18');
});

test('buildSimbriefUrl — cargo with fractional tons is preserved as decimal', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, { pax: 100, cargo_kg: 5500 }, { useRandomPayload: true }));
  assert.equal(params.get('cargo'), '5.5');
});

test('buildSimbriefUrl — cargo below 1 ton is expressed as decimal', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN, { pax: 100, cargo_kg: 340 }, { useRandomPayload: true }));
  assert.equal(params.get('cargo'), '0.34');
});
