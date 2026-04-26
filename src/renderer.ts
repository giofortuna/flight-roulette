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
}

type FlapSize = 'xl' | 'lg' | 'md' | 'sm';

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing DOM element: #${id}`);
  return e;
}

// --- Animation state ---

const FLIP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /-';
const CYCLE_MS = 60;
const TILE_MS  = 35;
const FIELD_MS = 80;

function randChar(): string {
  return FLIP_CHARS[Math.floor(Math.random() * FLIP_CHARS.length)];
}

interface CycleEntry { span: HTMLSpanElement; id: ReturnType<typeof setInterval> }
let _cycles:  CycleEntry[]                    = [];
let _pending: ReturnType<typeof setTimeout>[] = [];

function cancelAnim(): void {
  for (const { id } of _cycles) clearInterval(id);
  _cycles = [];
  for (const t of _pending) clearTimeout(t);
  _pending = [];
}

function cycleSpan(span: HTMLSpanElement): void {
  const id = setInterval(() => {
    const ch = randChar();
    span.textContent = ch === ' ' ? '' : ch;
    span.style.transform = 'scaleY(0.85)';
    requestAnimationFrame(() => requestAnimationFrame(() => { span.style.transform = ''; }));
  }, CYCLE_MS);
  _cycles.push({ span, id });
}

function cycleField(target: HTMLElement, count: number, size: FlapSize, amber = false): void {
  target.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    target.appendChild(span);
    cycleSpan(span);
  }
}

function resolveSpan(span: HTMLSpanElement, finalCh: string, delay: number): void {
  const t = setTimeout(() => {
    const idx = _cycles.findIndex(e => e.span === span);
    if (idx !== -1) { clearInterval(_cycles[idx].id); _cycles.splice(idx, 1); }
    span.textContent = finalCh;
    span.style.transform = '';
  }, delay);
  _pending.push(t);
}

function resolveField(target: HTMLElement, finalChars: string[], fieldDelay: number): void {
  const spans = Array.from(target.querySelectorAll<HTMLSpanElement>('.flap-char'));
  finalChars.forEach((ch, i) => {
    if (spans[i]) resolveSpan(spans[i], ch, fieldDelay + i * TILE_MS);
  });
}

function resolveText(target: HTMLElement, value: string, delay: number): void {
  const t = setTimeout(() => { target.textContent = value; }, delay);
  _pending.push(t);
}

function minFinalChars(text: string, minTiles: number): string[] {
  const upper = text.toUpperCase();
  const chars = upper.length > minTiles
    ? [...upper.slice(0, minTiles - 1), '…']
    : [...upper];
  while (chars.length < minTiles) chars.push('');
  return chars.map(ch => (ch === ' ' ? '' : ch));
}

function numFinalChars(numStr: string, numWidth: number): string[] {
  const upper = numStr.toUpperCase();
  const pad = Math.max(0, numWidth - upper.length);
  return [...Array<string>(pad).fill(''), ...[...upper]];
}

// --- Static helpers (used for blank/empty states) ---

function setBlankTiles(target: HTMLElement, count: number, size: FlapSize): void {
  target.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}`;
    target.appendChild(span);
  }
}

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

function setFlapsMin(target: HTMLElement, text: string, size: FlapSize, minTiles: number, amber = false): void {
  target.innerHTML = '';
  const upper = text.toUpperCase();
  const chars = upper.length > minTiles
    ? [...upper.slice(0, minTiles - 1), '…']
    : [...upper];

  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    if (ch !== ' ') span.textContent = ch;
    target.appendChild(span);
  }
  for (let i = chars.length; i < minTiles; i++) {
    const blank = document.createElement('span');
    blank.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    target.appendChild(blank);
  }
}

// --- Field size constants ---

const STD_WIDTH     = 4;
const DIST_WIDTH    = 6;
const BLK_WIDTH     = 5;
const PAX_WIDTH     = 3;
const CARGO_WIDTH   = 7;
const AIRLINE_TILES = 31;

function blankFlaps(): void {
  setBlankTiles(el('card-fltnum'),    6, 'xl');
  setBlankTiles(el('card-std'),       STD_WIDTH, 'xl');
  setFlapsMin(el('card-airline'),    '', 'lg', AIRLINE_TILES);
  setBlankTiles(el('card-dep-icao'),  4, 'xl');
  setFlapsMin(el('card-dep-city'),   '', 'lg', 12);
  setBlankTiles(el('card-dest-icao'), 4, 'xl');
  setFlapsMin(el('card-dest-city'),  '', 'lg', 12);
  setFlapsNumber(el('card-distance'),  '00,000', DIST_WIDTH, 'md');
  setFlapsNumber(el('card-blocktime'), '00+00',  BLK_WIDTH,  'md');
  setFlapsNumber(el('card-pax'),   '000',     PAX_WIDTH,   'lg');
  setFlapsNumber(el('card-cargo'), '000,000', CARGO_WIDTH, 'lg');
}

function blankText(): void {
  el('card-dep-name').textContent      = '';
  el('card-dep-country').textContent   = '';
  el('card-dest-name').textContent     = '';
  el('card-dest-country').textContent  = '';
  el('card-aircraft-type').textContent  = '';
  el('card-aircraft-frame').textContent = '';
  el('card-pax-max').textContent   = '';
  el('card-cargo-max').textContent = '';
}

// --- Public render functions ---

export function renderBlank(): void {
  cancelAnim();
  blankFlaps();
  blankText();
  el('btn-dispatch').removeAttribute('href');
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderLoading(): void {
  cancelAnim();
  blankText();

  // card-std is hidden (awaiting issue #34) — skip cycling to avoid perpetual intervals
  cycleField(el('card-fltnum'),    6,            'xl');
  cycleField(el('card-airline'),   AIRLINE_TILES, 'lg');
  cycleField(el('card-dep-icao'),  4,            'xl');
  cycleField(el('card-dep-city'),  12,           'lg');
  cycleField(el('card-dest-icao'), 4,            'xl');
  cycleField(el('card-dest-city'), 12,           'lg');
  cycleField(el('card-distance'),  DIST_WIDTH,   'md');
  cycleField(el('card-blocktime'), BLK_WIDTH,    'md');
  cycleField(el('card-pax'),       PAX_WIDTH,    'lg');
  cycleField(el('card-cargo'),     CARGO_WIDTH,  'lg');

  el('btn-dispatch').removeAttribute('href');
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderFlight(flight: GeneratedFlight): void {
  const { route, plan, payload } = flight;

  const distStr = plan.distance_nm.toLocaleString('en-US');
  const blkH = Math.floor(plan.block_time_min / 60);
  const blkM = plan.block_time_min % 60;
  const blkStr = `${String(blkH).padStart(2, '0')}+${String(blkM).padStart(2, '0')}`;

  // Field resolution order (f(n) = n * FIELD_MS):
  // 0: fltnum, 1: airline, 2: dep-icao + dep-city, 3: dest-icao + dest-city,
  // 4: distance + blocktime, 5: aircraft text, 6: pax, 7: cargo

  const f = (n: number) => n * FIELD_MS;

  resolveField(el('card-fltnum'),    minFinalChars(plan.flight_number, 6),              f(0));
  resolveField(el('card-airline'),   minFinalChars(route.airline.name, AIRLINE_TILES),  f(1));

  resolveField(el('card-dep-icao'),  minFinalChars(route.departure.icao, 4),   f(2));
  resolveField(el('card-dep-city'),  minFinalChars(route.departure.city, 12),  f(2));
  resolveText(el('card-dep-name'),    route.departure.name,                    f(2));
  resolveText(el('card-dep-country'), countryName(route.departure.country),    f(2));

  resolveField(el('card-dest-icao'), minFinalChars(route.destination.icao, 4),   f(3));
  resolveField(el('card-dest-city'), minFinalChars(route.destination.city, 12),  f(3));
  resolveText(el('card-dest-name'),    route.destination.name,                   f(3));
  resolveText(el('card-dest-country'), countryName(route.destination.country),   f(3));

  resolveField(el('card-distance'),  numFinalChars(distStr, DIST_WIDTH), f(4));
  resolveField(el('card-blocktime'), numFinalChars(blkStr,  BLK_WIDTH),  f(4));

  resolveText(el('card-aircraft-type'),  route.aircraft.type_name,     f(5));
  resolveText(el('card-aircraft-frame'), route.aircraft.airframe_name, f(5));

  resolveField(el('card-pax'), numFinalChars(String(payload.pax ?? 0), PAX_WIDTH), f(6));
  resolveText(el('card-pax-max'), `/ ${route.aircraft.max_pax} MAX`, f(6));

  resolveField(el('card-cargo'), numFinalChars(payload.cargo_kg.toLocaleString('en-US'), CARGO_WIDTH), f(7));
  resolveText(el('card-cargo-max'), `/ ${route.aircraft.max_cargo_kg.toLocaleString('en-US')} KG MAX`, f(7));

  // Enable dispatch button after the last tile (cargo field) has fully resolved
  const lastTileDelay = f(7) + (CARGO_WIDTH - 1) * TILE_MS + 50;
  const t = setTimeout(() => {
    (el('btn-dispatch') as HTMLAnchorElement).href = flight.simbriefUrl;
    el('btn-dispatch').classList.remove('is-disabled');
    el('btn-dispatch').removeAttribute('aria-disabled');
  }, lastTileDelay);
  _pending.push(t);

  el('flight-card').classList.remove('is-loading');
  el('status-msg').classList.add('hidden');
}

export function renderEmpty(message: string): void {
  cancelAnim();
  blankFlaps();
  blankText();
  el('btn-dispatch').removeAttribute('href');
  const msg = el('status-msg');
  msg.textContent = message;
  msg.classList.remove('hidden');
  el('flight-card').classList.remove('is-loading');
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
}
