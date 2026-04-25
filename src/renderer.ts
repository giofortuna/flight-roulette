import type { Simulator } from './types.js';
import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';
import type { Payload } from './payload-gen.js';
import { COUNTRY_NAMES } from './country-names.js';

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export interface GeneratedFlight {
  route: SelectedRoute;
  plan: FlightPlan;
  payload: Payload;
  simbriefUrl: string;
  simulator: Simulator;
}

type FlapSize = 'xl' | 'lg' | 'md' | 'sm';

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing DOM element: #${id}`);
  return e;
}

function setBlankTiles(target: HTMLElement, count: number, size: FlapSize): void {
  target.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}`;
    target.appendChild(span);
  }
}

// Fixed-width number field: blank-pads numStr to numWidth tiles. Width never changes regardless of value length.
function setFlapsNumber(target: HTMLElement, numStr: string, numWidth: number, size: FlapSize): void {
  target.innerHTML = '';
  const upper = numStr.toUpperCase();
  const pad = Math.max(0, numWidth - upper.length);
  for (let i = 0; i < pad; i++) {
    const blank = document.createElement('span');
    blank.className = `flap-char flap-${size}`;
    target.appendChild(blank);
  }
  for (const ch of upper) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}`;
    span.textContent = ch;
    target.appendChild(span);
  }
}

// Fixed-width tile row: all characters (including spaces → blank tiles) rendered flat.
// Uniform 2px gap between every tile. Trims with "..." if text exceeds minTiles.
function setFlapsMin(target: HTMLElement, text: string, size: FlapSize, minTiles: number, amber = false): void {
  target.innerHTML = '';
  const upper = text.toUpperCase();
  const chars = upper.length > minTiles
    ? [...upper.slice(0, minTiles - 1), '…']  // … in the last slot
    : [...upper];

  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    if (ch !== ' ') span.textContent = ch;
    target.appendChild(span);
  }
  for (let i = chars.length; i < minTiles; i++) {
    const blank = document.createElement('span');
    blank.className = `flap-char flap-${size}`;
    target.appendChild(blank);
  }
}

function setFlaps(target: HTMLElement, text: string, size: FlapSize, amber = false): void {
  target.innerHTML = '';
  const upper = text.toUpperCase();
  const words = upper.split(' ');
  words.forEach((word, wi) => {
    const group = document.createElement('span');
    group.className = 'flap-word';
    for (const ch of word) {
      const span = document.createElement('span');
      span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
      span.textContent = ch;
      group.appendChild(span);
    }
    target.appendChild(group);
    if (wi < words.length - 1) {
      const gap = document.createElement('span');
      gap.className = `flap-gap flap-gap-${size}`;
      target.appendChild(gap);
    }
  });
}

// Distance: number part padded to 6 chars (covers up to "15,000" for future widebodies)
const DIST_WIDTH    = 6;
// Block time: always exactly "XX+XX" = 5 chars
const BLK_WIDTH     = 5;
// Pax: max 3 digits (covers 999 pax)
const PAX_WIDTH     = 3;
// Cargo: covers up to "999,999" KG = 7 chars
const CARGO_WIDTH   = 7;
// Airline: fills the full card section interior at max-width 860px
// (820px card − 36px section padding = 784px; ⌊784/25⌋ = 31 lg tiles = 773px)
const AIRLINE_TILES = 31;

const BLANK = '—';

export function renderBlank(): void {
  setBlankTiles(el('card-fltnum'),    6, 'xl');
  setFlapsMin(el('card-airline'),    '', 'lg', AIRLINE_TILES);
  setBlankTiles(el('card-dep-icao'),  4,  'xl');
  setFlapsMin(el('card-dep-city'),   '', 'lg', 12);
  el('card-dep-name').textContent    = '';
  el('card-dep-country').textContent = '';
  setBlankTiles(el('card-dest-icao'), 4,  'xl');
  setFlapsMin(el('card-dest-city'),  '', 'lg', 12);
  el('card-dest-name').textContent    = '';
  el('card-dest-country').textContent = '';
  setFlapsNumber(el('card-distance'),  '00,000', DIST_WIDTH, 'md');
  setFlapsNumber(el('card-blocktime'), '00+00',  BLK_WIDTH,  'md');
  el('card-aircraft-type').textContent  = '';
  el('card-aircraft-frame').textContent = '';
  setFlapsNumber(el('card-pax'),   '000',     PAX_WIDTH,   'lg');
  el('card-pax-max').textContent  = '';
  setFlapsNumber(el('card-cargo'), '000,000', CARGO_WIDTH, 'lg');
  el('card-cargo-max').textContent = '';
  (el('btn-dispatch') as HTMLAnchorElement).href = '#';
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderFlight(flight: GeneratedFlight): void {
  const { route, plan, payload } = flight;

  setFlaps(el('card-fltnum'),  plan.flight_number,  'xl');
  setFlapsMin(el('card-airline'), route.airline.name, 'lg', AIRLINE_TILES);
  // card-std: populated by issue #34 (STD departure time)

  setFlaps(el('card-dep-icao'),    route.departure.icao,    'xl');
  setFlapsMin(el('card-dep-city'),   route.departure.city,    'lg', 12);
  el('card-dep-name').textContent    = route.departure.name;
  el('card-dep-country').textContent = countryName(route.departure.country);

  setFlaps(el('card-dest-icao'),    route.destination.icao,    'xl');
  setFlapsMin(el('card-dest-city'),  route.destination.city,   'lg', 12);
  el('card-dest-name').textContent    = route.destination.name;
  el('card-dest-country').textContent = countryName(route.destination.country);

  const distStr = plan.distance_nm.toLocaleString('en-US');
  const blkH = Math.floor(plan.block_time_min / 60);
  const blkM = plan.block_time_min % 60;
  const blkStr = `${String(blkH).padStart(2, '0')}+${String(blkM).padStart(2, '0')}`;
  setFlapsNumber(el('card-distance'),  distStr, DIST_WIDTH, 'md');
  setFlapsNumber(el('card-blocktime'), blkStr,  BLK_WIDTH,  'md');

  el('card-aircraft-type').textContent  = route.aircraft.type_name;
  el('card-aircraft-frame').textContent = route.aircraft.airframe_name;

  setFlapsNumber(el('card-pax'), String(payload.pax ?? 0), PAX_WIDTH, 'lg');
  el('card-pax-max').textContent = `/ ${route.aircraft.max_pax} MAX`;

  setFlapsNumber(el('card-cargo'), payload.cargo_kg.toLocaleString('en-US'), CARGO_WIDTH, 'lg');
  el('card-cargo-max').textContent = `/ ${route.aircraft.max_cargo_kg.toLocaleString('en-US')} KG MAX`;

  (el('btn-dispatch') as HTMLAnchorElement).href = flight.simbriefUrl;
  el('btn-dispatch').classList.remove('is-disabled');
  el('btn-dispatch').removeAttribute('aria-disabled');

  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderLoading(): void {
  el('flight-card').classList.add('is-loading');
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
  el('status-msg').classList.add('hidden');
}

export function renderEmpty(message: string): void {
  const msg = el('status-msg');
  msg.textContent = message;
  msg.classList.remove('hidden');
  el('flight-card').classList.remove('is-loading');
}
