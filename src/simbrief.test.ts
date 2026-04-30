import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSimbriefUrl } from './simbrief.js';
import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';

const ROUTE: SelectedRoute = {
  airline:  { icao: 'BAW', iata: 'BA', name: 'British Airways', callsign: 'SPEEDBIRD', country: 'GB', region: 'europe', hub: ['EGLL'], type: 'passenger', simbrief_id: 'BAW', fleet: [] },
  aircraft: { icao_type: 'B738', type_name: '737-800', airframe_name: 'Test', flight_type: 'passenger', simulator: ['msfs2020'], range_nm: 3000, min_runway_m: 2000, cruise_kts: 450, category: 'narrowbody', simbrief_type: 'B738', simbrief_airframe_id: '' },
  departure:   { icao: 'EGLL', name: 'Heathrow',  city: 'London',    country: 'GB', lat: 51.477, lon: -0.461, max_runway_m: 3902 },
  destination: { icao: 'EHAM', name: 'Amsterdam', city: 'Amsterdam', country: 'NL', lat: 52.308, lon:  4.764, max_runway_m: 3800 },
  distanceNm: 200,
};

// 2026-04-27 14:30 UTC
const STD_MS = Date.UTC(2026, 3, 27, 14, 30);
const PLAN: FlightPlan = { distance_nm: 200, block_time_min: 57, flight_number: 'BAW442', std_ms: STD_MS };

function parseUrl(url: string) {
  const [base, qs] = url.split('?');
  return { base, params: new URLSearchParams(qs) };
}

test('buildSimbriefUrl — base URL is correct', () => {
  const { base } = parseUrl(buildSimbriefUrl(ROUTE, PLAN));
  assert.equal(base, 'https://www.simbrief.com/system/dispatch.php');
});

test('buildSimbriefUrl — required params always present', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN));
  assert.equal(params.get('orig'),    'EGLL');
  assert.equal(params.get('dest'),    'EHAM');
  assert.equal(params.get('type'),    'B738');
  assert.equal(params.get('airline'), 'BAW');
  assert.equal(params.get('fltnum'),  'BAW442');
  assert.equal(params.get('fl'),      null);
  assert.equal(params.get('route'),   null);
  assert.equal(params.get('units'),   'KGS');
});

test('buildSimbriefUrl — pax and cargo params are never included', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN));
  assert.equal(params.get('pax'),   null);
  assert.equal(params.get('cargo'), null);
});

test('buildSimbriefUrl — airline param omitted when simbrief_id is empty', () => {
  const routeNoId = { ...ROUTE, airline: { ...ROUTE.airline, simbrief_id: '' } };
  const { params } = parseUrl(buildSimbriefUrl(routeNoId, PLAN));
  assert.equal(params.get('airline'), null);
});

test('buildSimbriefUrl — date param reflects UTC date and time of std_ms', () => {
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, PLAN));
  // STD_MS = 2026-04-27 14:30 UTC → "27 Apr 2026 - 14:30"
  assert.equal(params.get('date'), '27 Apr 2026 - 14:30');
});

test('buildSimbriefUrl — single-digit day is zero-padded', () => {
  const plan = { ...PLAN, std_ms: Date.UTC(2026, 3, 5, 8, 0) }; // 2026-04-05 08:00 UTC
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, plan));
  assert.equal(params.get('date'), '05 Apr 2026 - 08:00');
});

test('buildSimbriefUrl — date rolls back correctly when UTC is previous day', () => {
  // 2026-04-27 01:55 local (UTC+5) = 2026-04-26 20:55 UTC
  const plan = { ...PLAN, std_ms: Date.UTC(2026, 3, 26, 20, 55) };
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, plan));
  assert.equal(params.get('date'), '26 Apr 2026 - 20:55');
});

test('buildSimbriefUrl — midnight UTC is formatted as 00:00', () => {
  const plan = { ...PLAN, std_ms: Date.UTC(2026, 3, 27, 0, 0) };
  const { params } = parseUrl(buildSimbriefUrl(ROUTE, plan));
  assert.equal(params.get('date'), '27 Apr 2026 - 00:00');
});
