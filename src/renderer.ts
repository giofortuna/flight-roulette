import type { SelectedRoute, Airport, Aircraft } from './route-selector.js';
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

const FLIP_CHARS     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 /-';
const FLIP_CHARS_NUM = '0123456789';
const CYCLE_MS = 60;
const TILE_MS  = 35;
const FIELD_MS = 80;

interface CycleEntry { span: HTMLSpanElement; id: ReturnType<typeof setInterval> }
let _cycles:  CycleEntry[]                    = [];
let _pending: ReturnType<typeof setTimeout>[] = [];

export function cancelAnim(): void {
  for (const { id } of _cycles) clearInterval(id);
  _cycles = [];
  for (const t of _pending) clearTimeout(t);
  _pending = [];
}

function cycleSpan(span: HTMLSpanElement, chars = FLIP_CHARS): void {
  const id = setInterval(() => {
    const ch = chars[Math.floor(Math.random() * chars.length)];
    span.textContent = ch === ' ' ? '' : ch;
    span.style.transform = 'scaleY(0.85)';
    requestAnimationFrame(() => requestAnimationFrame(() => { span.style.transform = ''; }));
  }, CYCLE_MS);
  _cycles.push({ span, id });
}

function cycleField(target: HTMLElement, count: number, size: FlapSize, amber = false, chars = FLIP_CHARS): void {
  target.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    target.appendChild(span);
    cycleSpan(span, chars);
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

function revealText(target: HTMLElement, value: string): void {
  target.textContent = value;
  requestAnimationFrame(() => requestAnimationFrame(() => { target.style.opacity = ''; }));
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
  // Validator enforces field limits so overflow shouldn't occur;
  // truncate from the right defensively rather than produce out-of-bounds spans.
  const s = numStr.length > numWidth ? numStr.slice(0, numWidth) : numStr;
  const pad = numWidth - s.length;
  return [...Array<string>(pad).fill(''), ...[...s]];
}

// --- Dispatch button helpers ---

function fmtBlk(blockTimeMin: number): string {
  const h = Math.floor(blockTimeMin / 60);
  const m = blockTimeMin % 60;
  return `${String(h).padStart(2, '0')}+${String(m).padStart(2, '0')}`;
}

function disableDispatch(): void {
  el('btn-dispatch').removeAttribute('href');
  el('btn-dispatch').classList.add('is-disabled');
  el('btn-dispatch').setAttribute('aria-disabled', 'true');
}

function scheduleDispatchEnable(url: string, delay: number): void {
  const t = setTimeout(() => {
    (el('btn-dispatch') as HTMLAnchorElement).href = url;
    el('btn-dispatch').classList.remove('is-disabled');
    el('btn-dispatch').removeAttribute('aria-disabled');
  }, delay);
  _pending.push(t);
}

// --- Static helpers (used for blank/empty states) ---

function setBlankTiles(target: HTMLElement, count: number, size: FlapSize, amber = false): void {
  target.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.className = `flap-char flap-${size}${amber ? ' flap-amber' : ''}`;
    target.appendChild(span);
  }
}

function setFlapsNumber(target: HTMLElement, numStr: string, numWidth: number, size: FlapSize): void {
  target.innerHTML = '';
  const pad = Math.max(0, numWidth - numStr.length);
  for (let i = 0; i < pad; i++) {
    const blank = document.createElement('span');
    blank.className = `flap-char flap-${size}`;
    target.appendChild(blank);
  }
  for (const ch of numStr) {
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
// Numeric fields have hard display limits tied to their tile count:
//   DIST_WIDTH=6  → max "99,999" NM  (longest real route ~9,500 NM; safe)
//   BLK_WIDTH=5   → max "99+59"      (longest real flight ~24h; safe)
//   PAX_WIDTH=3   → max 999 pax      — enforced by aircraft-db validator
//   CARGO_WIDTH=7 → max 999,999 kg   — enforced by aircraft-db validator

const FLTNUM_TILES  = 6;
const STD_TILES     = 2; // tiles per half (H and M rendered separately)
const ICAO_TILES    = 4;
const CITY_TILES    = 12;
const DIST_WIDTH    = 6;
const BLK_WIDTH     = 5;
const PAX_WIDTH     = 3;
const CARGO_WIDTH   = 7;
const AIRLINE_TILES = 31;

function blankFlaps(): void {
  setBlankTiles(el('card-fltnum'),    FLTNUM_TILES,  'xl');
  setBlankTiles(el('card-std-h'),     STD_TILES,     'xl', true);
  setBlankTiles(el('card-std-m'),     STD_TILES,     'xl', true);
  setFlapsMin(el('card-airline'),    '', 'lg', AIRLINE_TILES);
  setBlankTiles(el('card-dep-icao'),  ICAO_TILES,    'xl');
  setFlapsMin(el('card-dep-city'),   '', 'lg', CITY_TILES);
  setBlankTiles(el('card-dest-icao'), ICAO_TILES,    'xl');
  setFlapsMin(el('card-dest-city'),  '', 'lg', CITY_TILES);
  setFlapsNumber(el('card-distance'),  '00,000', DIST_WIDTH, 'md');
  setFlapsNumber(el('card-blocktime'), '00+00',  BLK_WIDTH,  'md');
  setFlapsNumber(el('card-pax'),   '000',     PAX_WIDTH,   'lg');
  setFlapsNumber(el('card-cargo'), '000,000', CARGO_WIDTH, 'lg');
}

function blankText(): void {
  const ids = [
    'card-dep-name', 'card-dep-country',
    'card-dest-name', 'card-dest-country',
    'card-aircraft-type', 'card-aircraft-frame',
    'card-pax-max', 'card-cargo-max',
  ];
  for (const id of ids) {
    const e = el(id);
    e.textContent = '';
    e.style.opacity = '0';
  }
}

// --- Public render functions ---

export function renderBlank(): void {
  cancelAnim();
  blankFlaps();
  blankText();
  disableDispatch();
  el('status-msg').classList.add('hidden');
}

export function renderLoading(): void {
  cancelAnim();
  blankText();

  cycleField(el('card-fltnum'),    FLTNUM_TILES,  'xl');
  cycleField(el('card-std-h'),     STD_TILES,     'xl', true, FLIP_CHARS_NUM);
  cycleField(el('card-std-m'),     STD_TILES,     'xl', true, FLIP_CHARS_NUM);
  cycleField(el('card-airline'),   AIRLINE_TILES, 'lg');
  cycleField(el('card-dep-icao'),  ICAO_TILES,   'xl');
  cycleField(el('card-dep-city'),  CITY_TILES,   'lg');
  cycleField(el('card-dest-icao'), ICAO_TILES,   'xl');
  cycleField(el('card-dest-city'), CITY_TILES,   'lg');
  cycleField(el('card-distance'),  DIST_WIDTH,   'md', false, FLIP_CHARS_NUM);
  cycleField(el('card-blocktime'), BLK_WIDTH,    'md', false, FLIP_CHARS_NUM);
  cycleField(el('card-pax'),       PAX_WIDTH,    'lg', false, FLIP_CHARS_NUM);
  cycleField(el('card-cargo'),     CARGO_WIDTH,  'lg', false, FLIP_CHARS_NUM);

  disableDispatch();
  el('status-msg').classList.add('hidden');
}

function stdLocalHM(stdMs: number): { h: string; m: string } {
  const d = new Date(stdMs);
  return {
    h: String(d.getHours()).padStart(2, '0'),
    m: String(d.getMinutes()).padStart(2, '0'),
  };
}

export function renderFlight(flight: GeneratedFlight): void {
  const { route, plan, payload } = flight;

  const distStr = plan.distance_nm.toLocaleString('en-US');
  const blkStr  = fmtBlk(plan.block_time_min);
  const { h: stdH, m: stdM } = stdLocalHM(plan.std_ms);

  // Field resolution order (f(n) = n * FIELD_MS):
  // 0: fltnum, 1: std, 2: airline, 3: dep-icao + dep-city, 4: dest-icao + dest-city,
  // 5: distance + blocktime, 6: pax, 7: cargo
  // (aircraft text is revealed immediately via revealText, not staggered)

  const f = (n: number) => n * FIELD_MS;

  resolveField(el('card-fltnum'),    minFinalChars(plan.flight_number, FLTNUM_TILES),   f(0));
  resolveField(el('card-std-h'),     [...stdH],                                         f(1));
  resolveField(el('card-std-m'),     [...stdM],                                         f(1));
  resolveField(el('card-airline'),   minFinalChars(route.airline.name, AIRLINE_TILES),  f(2));

  resolveField(el('card-dep-icao'),  minFinalChars(route.departure.icao, ICAO_TILES),  f(3));
  resolveField(el('card-dep-city'),  minFinalChars(route.departure.city, CITY_TILES),  f(3));
  revealText(el('card-dep-name'),    route.departure.name);
  revealText(el('card-dep-country'), countryName(route.departure.country));

  resolveField(el('card-dest-icao'), minFinalChars(route.destination.icao, ICAO_TILES), f(4));
  resolveField(el('card-dest-city'), minFinalChars(route.destination.city, CITY_TILES), f(4));
  revealText(el('card-dest-name'),    route.destination.name);
  revealText(el('card-dest-country'), countryName(route.destination.country));

  resolveField(el('card-distance'),  numFinalChars(distStr, DIST_WIDTH), f(5));
  resolveField(el('card-blocktime'), numFinalChars(blkStr,  BLK_WIDTH),  f(5));

  revealText(el('card-aircraft-type'),  route.aircraft.type_name);
  revealText(el('card-aircraft-frame'), route.aircraft.airframe_name);

  resolveField(el('card-pax'), numFinalChars(String(payload.pax ?? ''), PAX_WIDTH), f(6));
  revealText(el('card-pax-max'), payload.pax !== null ? `/ ${route.aircraft.max_pax} MAX` : '');

  resolveField(el('card-cargo'), numFinalChars(payload.cargo_kg.toLocaleString('en-US'), CARGO_WIDTH), f(7));
  revealText(el('card-cargo-max'), `/ ${route.aircraft.max_cargo_kg.toLocaleString('en-US')} KG MAX`);

  scheduleDispatchEnable(flight.simbriefUrl, f(7) + (CARGO_WIDTH - 1) * TILE_MS + 50);
  el('status-msg').classList.add('hidden');
}

export function renderEmpty(message: string): void {
  cancelAnim();
  blankFlaps();
  blankText();
  disableDispatch();
  const msg = el('status-msg');
  msg.textContent = message;
  msg.classList.remove('hidden');
}

// --- Partial re-renders for individual field re-rolls ---

export function reRenderAirline(flightNumber: string, airlineName: string, simbriefUrl: string): void {
  cancelAnim();
  disableDispatch();
  const f = (n: number) => n * FIELD_MS;
  cycleField(el('card-fltnum'),  FLTNUM_TILES,  'xl');
  cycleField(el('card-airline'), AIRLINE_TILES, 'lg');
  resolveField(el('card-fltnum'),  minFinalChars(flightNumber, FLTNUM_TILES),  f(0));
  resolveField(el('card-airline'), minFinalChars(airlineName,  AIRLINE_TILES), f(1));
  scheduleDispatchEnable(simbriefUrl, f(1) + (AIRLINE_TILES - 1) * TILE_MS + 50);
}

export function reRenderDestination(
  dest: Airport,
  distanceNm: number,
  blockTimeMin: number,
  simbriefUrl: string,
): void {
  cancelAnim();
  disableDispatch();
  const f = (n: number) => n * FIELD_MS;
  el('card-dest-name').style.opacity    = '0';
  el('card-dest-country').style.opacity = '0';
  cycleField(el('card-dest-icao'), ICAO_TILES, 'xl');
  cycleField(el('card-dest-city'), CITY_TILES, 'lg');
  cycleField(el('card-distance'),  DIST_WIDTH, 'md', false, FLIP_CHARS_NUM);
  cycleField(el('card-blocktime'), BLK_WIDTH,  'md', false, FLIP_CHARS_NUM);
  resolveField(el('card-dest-icao'), minFinalChars(dest.icao, ICAO_TILES),                         f(0));
  resolveField(el('card-dest-city'), minFinalChars(dest.city, CITY_TILES),                         f(0));
  resolveField(el('card-distance'),  numFinalChars(distanceNm.toLocaleString('en-US'), DIST_WIDTH), f(1));
  resolveField(el('card-blocktime'), numFinalChars(fmtBlk(blockTimeMin), BLK_WIDTH),               f(1));
  revealText(el('card-dest-name'),    dest.name);
  revealText(el('card-dest-country'), countryName(dest.country));
  scheduleDispatchEnable(simbriefUrl, f(0) + (CITY_TILES - 1) * TILE_MS + 50);
}

export function reRenderDeparture(
  dep: Airport,
  dest: Airport,
  distanceNm: number,
  blockTimeMin: number,
  flightNumber: string,
  simbriefUrl: string,
): void {
  cancelAnim();
  disableDispatch();
  const f = (n: number) => n * FIELD_MS;
  el('card-dep-name').style.opacity     = '0';
  el('card-dep-country').style.opacity  = '0';
  el('card-dest-name').style.opacity    = '0';
  el('card-dest-country').style.opacity = '0';
  cycleField(el('card-fltnum'),    FLTNUM_TILES, 'xl');
  cycleField(el('card-dep-icao'),  ICAO_TILES,   'xl');
  cycleField(el('card-dep-city'),  CITY_TILES,   'lg');
  cycleField(el('card-dest-icao'), ICAO_TILES,   'xl');
  cycleField(el('card-dest-city'), CITY_TILES,   'lg');
  cycleField(el('card-distance'),  DIST_WIDTH,   'md', false, FLIP_CHARS_NUM);
  cycleField(el('card-blocktime'), BLK_WIDTH,    'md', false, FLIP_CHARS_NUM);
  resolveField(el('card-fltnum'),    minFinalChars(flightNumber, FLTNUM_TILES),                     f(0));
  resolveField(el('card-dep-icao'),  minFinalChars(dep.icao,     ICAO_TILES),                       f(1));
  resolveField(el('card-dep-city'),  minFinalChars(dep.city,     CITY_TILES),                       f(1));
  resolveField(el('card-dest-icao'), minFinalChars(dest.icao,    ICAO_TILES),                       f(2));
  resolveField(el('card-dest-city'), minFinalChars(dest.city,    CITY_TILES),                       f(2));
  resolveField(el('card-distance'),  numFinalChars(distanceNm.toLocaleString('en-US'), DIST_WIDTH), f(3));
  resolveField(el('card-blocktime'), numFinalChars(fmtBlk(blockTimeMin), BLK_WIDTH),               f(3));
  revealText(el('card-dep-name'),     dep.name);
  revealText(el('card-dep-country'),  countryName(dep.country));
  revealText(el('card-dest-name'),    dest.name);
  revealText(el('card-dest-country'), countryName(dest.country));
  scheduleDispatchEnable(simbriefUrl, f(2) + (CITY_TILES - 1) * TILE_MS + 50);
}

export function reRenderAircraft(
  aircraft: Aircraft,
  payload: Payload,
  blockTimeMin: number,
  simbriefUrl: string,
): void {
  cancelAnim();
  disableDispatch();
  const f = (n: number) => n * FIELD_MS;
  revealText(el('card-aircraft-type'),  aircraft.type_name);
  revealText(el('card-aircraft-frame'), aircraft.airframe_name);
  revealText(el('card-pax-max'),   payload.pax !== null ? `/ ${aircraft.max_pax} MAX` : '');
  revealText(el('card-cargo-max'), `/ ${aircraft.max_cargo_kg.toLocaleString('en-US')} KG MAX`);
  cycleField(el('card-pax'),       PAX_WIDTH,   'lg', false, FLIP_CHARS_NUM);
  cycleField(el('card-cargo'),     CARGO_WIDTH, 'lg', false, FLIP_CHARS_NUM);
  cycleField(el('card-blocktime'), BLK_WIDTH,   'md', false, FLIP_CHARS_NUM);
  resolveField(el('card-pax'),       numFinalChars(String(payload.pax ?? ''), PAX_WIDTH),               f(0));
  resolveField(el('card-cargo'),     numFinalChars(payload.cargo_kg.toLocaleString('en-US'), CARGO_WIDTH), f(1));
  resolveField(el('card-blocktime'), numFinalChars(fmtBlk(blockTimeMin), BLK_WIDTH),                   f(1));
  scheduleDispatchEnable(simbriefUrl, f(1) + (CARGO_WIDTH - 1) * TILE_MS + 50);
}
