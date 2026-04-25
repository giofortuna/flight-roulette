import type { Simulator } from './types.js';
import type { SelectedRoute } from './route-selector.js';
import type { FlightPlan } from './flight-planner.js';
import type { Payload } from './payload-gen.js';

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

// Fixed-width number field: blank-pads numStr to numWidth tiles, then a gap, then suffix tiles.
// Width never changes regardless of value length.
function setFlapsWithSuffix(target: HTMLElement, numStr: string, suffix: string, numWidth: number, size: FlapSize): void {
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
  const gap = document.createElement('span');
  gap.className = `flap-gap flap-gap-${size}`;
  target.appendChild(gap);
  for (const ch of suffix) {
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
// Airline: fills the full card section interior at max-width 860px
// (820px card − 36px section padding = 784px; ⌊784/25⌋ = 31 lg tiles = 773px)
const AIRLINE_TILES = 31;

const BLANK = '—';

export function renderBlank(): void {
  setBlankTiles(el('card-fltnum'),    6, 'xl');
  setFlapsMin(el('card-airline'),    '', 'lg', AIRLINE_TILES);
  setBlankTiles(el('card-dep-icao'),  4,  'xl');
  setFlapsMin(el('card-dep-city'),   '', 'lg', 12);
  setFlaps(el('card-dep-name'),       BLANK, 'sm');
  setFlaps(el('card-dep-country'),    BLANK, 'sm');
  setBlankTiles(el('card-dest-icao'), 4,  'xl');
  setFlapsMin(el('card-dest-city'),  '', 'lg', 12);
  setFlaps(el('card-dest-name'),      BLANK, 'sm');
  setFlaps(el('card-dest-country'),   BLANK, 'sm');
  setFlapsWithSuffix(el('card-distance'),  '', 'NM',  DIST_WIDTH, 'md');
  setFlapsWithSuffix(el('card-blocktime'), '', 'BLK', BLK_WIDTH,  'md');
  setFlaps(el('card-aircraft-type'),  BLANK, 'lg');
  setFlaps(el('card-aircraft-frame'), BLANK, 'sm');
  setFlaps(el('card-pax'),            BLANK, 'lg');
  el('card-pax-max').innerHTML  = '';
  setFlaps(el('card-cargo'),          BLANK, 'lg');
  el('card-cargo-max').innerHTML = '';
  (el('btn-dispatch') as HTMLAnchorElement).href = '#';
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
  setFlaps(el('card-dep-name'),    route.departure.name,    'sm');
  setFlaps(el('card-dep-country'), route.departure.country, 'sm');

  setFlaps(el('card-dest-icao'),    route.destination.icao,    'xl');
  setFlapsMin(el('card-dest-city'),  route.destination.city,   'lg', 12);
  setFlaps(el('card-dest-name'),    route.destination.name,    'sm');
  setFlaps(el('card-dest-country'), route.destination.country, 'sm');

  const distStr = plan.distance_nm.toLocaleString('en-US');
  const blkH = Math.floor(plan.block_time_min / 60);
  const blkM = plan.block_time_min % 60;
  const blkStr = `${String(blkH).padStart(2, '0')}+${String(blkM).padStart(2, '0')}`;
  setFlapsWithSuffix(el('card-distance'),  distStr, 'NM',  DIST_WIDTH, 'md');
  setFlapsWithSuffix(el('card-blocktime'), blkStr,  'BLK', BLK_WIDTH,  'md');

  setFlaps(el('card-aircraft-type'),  route.aircraft.type_name,    'lg');
  setFlaps(el('card-aircraft-frame'), route.aircraft.airframe_name, 'sm');

  setFlaps(el('card-pax'),     String(payload.pax ?? '—'),                         'lg');
  setFlaps(el('card-pax-max'), `/ ${route.aircraft.max_pax} MAX`,                  'sm');

  setFlaps(el('card-cargo'),     payload.cargo_kg.toLocaleString('en-US') + ' KG', 'lg');
  setFlaps(el('card-cargo-max'), `/ ${route.aircraft.max_cargo_kg.toLocaleString('en-US')} KG MAX`, 'sm');

  (el('btn-dispatch') as HTMLAnchorElement).href = flight.simbriefUrl;

  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderLoading(): void {
  el('flight-card').classList.add('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderEmpty(message: string): void {
  const msg = el('status-msg');
  msg.textContent = message;
  msg.classList.remove('hidden');
  el('flight-card').classList.remove('is-loading');
}
