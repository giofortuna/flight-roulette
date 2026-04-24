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

const DEFAULT_EMPTY_MSG = 'Configure your settings above and press Generate to receive your flight assignment.';

const SIM_LABEL: Record<Simulator, string> = {
  msfs2020: 'MSFS 2020',
  msfs2024: 'MSFS 2024',
  xplane12: 'X-Plane 12',
};

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing DOM element: #${id}`);
  return e;
}

function formatDistance(nm: number): string {
  return nm.toLocaleString('en-US') + ' nm';
}

function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}+${String(m).padStart(2, '0')} BLK`;
}

export function renderFlight(flight: GeneratedFlight): void {
  const { route, plan, payload, simulator } = flight;

  el('card-airline').textContent = route.airline.name;
  el('card-fltnum').textContent = plan.flight_number;
  el('card-sim-badge').textContent = SIM_LABEL[simulator];

  el('card-dep-icao').textContent = route.departure.icao;
  el('card-dep-name').textContent = route.departure.name;
  el('card-dep-city').textContent = route.departure.city;

  el('card-dest-icao').textContent = route.destination.icao;
  el('card-dest-name').textContent = route.destination.name;
  el('card-dest-city').textContent = route.destination.city;

  el('card-distance').textContent = formatDistance(plan.distance_nm);
  el('card-blocktime').textContent = formatBlockTime(plan.block_time_min);

  el('card-aircraft-type').textContent = route.aircraft.type_name;
  el('card-aircraft-frame').textContent = route.aircraft.airframe_name;

  const cellPax = el('cell-pax');
  if (payload.pax !== null) {
    cellPax.classList.remove('hidden');
    el('card-pax').textContent = String(payload.pax);
    el('card-pax-max').textContent = `/ ${route.aircraft.max_pax} max`;
  } else {
    cellPax.classList.add('hidden');
  }

  // card-cargo has an inline <span> for the "kg" suffix — update only the text node
  el('card-cargo').childNodes[0].textContent = payload.cargo_kg.toLocaleString('en-US');
  el('card-cargo-max').textContent = `/ ${route.aircraft.max_cargo_kg.toLocaleString('en-US')} kg max`;

  (el('btn-dispatch') as HTMLAnchorElement).href = flight.simbriefUrl;

  el('state-empty').classList.add('hidden');
  el('state-loading').classList.add('hidden');
  el('state-card').classList.remove('hidden');
}

export function renderEmpty(message = DEFAULT_EMPTY_MSG): void {
  el('empty-message').textContent = message;
  el('state-empty').classList.remove('hidden');
  el('state-loading').classList.add('hidden');
  el('state-card').classList.add('hidden');
}

export function renderLoading(): void {
  el('state-empty').classList.add('hidden');
  el('state-loading').classList.remove('hidden');
  el('state-card').classList.add('hidden');
}
