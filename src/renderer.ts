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

function formatDistance(nm: number): string {
  return nm.toLocaleString('en-US') + ' NM';
}

function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}+${String(m).padStart(2, '0')} BLK`;
}

const BLANK = '—';

export function renderBlank(): void {
  setBlankTiles(el('card-fltnum'),    6, 'lg');
  setBlankTiles(el('card-airline'),   8, 'lg');
  setBlankTiles(el('card-dep-icao'),  4, 'xl');
  setFlaps(el('card-dep-name'),       BLANK, 'sm');
  setFlaps(el('card-dep-city'),       BLANK, 'sm');
  setFlaps(el('card-dep-country'),    BLANK, 'sm');
  setBlankTiles(el('card-dest-icao'),  4, 'xl');
  setFlaps(el('card-dest-name'),      BLANK, 'sm');
  setFlaps(el('card-dest-city'),      BLANK, 'sm');
  setFlaps(el('card-dest-country'),   BLANK, 'sm');
  setFlaps(el('card-distance'),       BLANK, 'md');
  setFlaps(el('card-blocktime'),      BLANK, 'md');
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

  setFlaps(el('card-fltnum'),  plan.flight_number,  'lg');
  setFlaps(el('card-airline'), route.airline.name,  'lg');
  // card-std: populated by issue #34 (STD departure time)

  setFlaps(el('card-dep-icao'),    route.departure.icao,    'xl');
  setFlaps(el('card-dep-name'),    route.departure.name,    'sm');
  setFlaps(el('card-dep-city'),    route.departure.city,    'sm');
  setFlaps(el('card-dep-country'), route.departure.country, 'sm');

  setFlaps(el('card-dest-icao'),    route.destination.icao,    'xl');
  setFlaps(el('card-dest-name'),    route.destination.name,    'sm');
  setFlaps(el('card-dest-city'),    route.destination.city,    'sm');
  setFlaps(el('card-dest-country'), route.destination.country, 'sm');

  setFlaps(el('card-distance'),  formatDistance(plan.distance_nm),      'md');
  setFlaps(el('card-blocktime'), formatBlockTime(plan.block_time_min),   'md');

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
