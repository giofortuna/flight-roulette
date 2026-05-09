import type { FlightType, Simulator, AirportRegion, DepartureTimeMode, DeparturePeriod } from './types.js';
import { loadAircraft } from './aircraft-db.js';
import type { Aircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';
import type { Airline } from './airline-db.js';
import { loadAll, loadRegion } from './airport-db.js';
import { selectRoute, NoRouteError, pickRandom, findDestinationFor, findDepartureForDest, RANGE_UTILISATION, RANGE_RELAXATION } from './route-selector.js';
import { planFlight } from './flight-planner.js';
import { buildSimbriefUrl } from './simbrief.js';
import { renderFlight, renderBlank, renderEmpty, renderLoading, cancelAnim, reRenderAirline, reRenderDestination, reRenderDeparture, reRenderAircraft } from './renderer.js';
import type { GeneratedFlight } from './renderer.js';

// Warm the caches before the user clicks Generate
Promise.all([loadAircraft(), loadAirlines()]).catch(err => {
  console.error('Failed to preload app data:', err);
});

const RANGE_CONFIGS = {
  time: { min: 0, max: 16,   step: 0.5, unit: 'h'  },
  dist: { min: 0, max: 9000, step: 100, unit: 'nm' },
} as const;

function getFilterMode(): 'time' | 'dist' {
  return (document.querySelector('input[name="filter-mode"]:checked') as HTMLInputElement).value as 'time' | 'dist';
}

function getSettings(): { flightType: FlightType; simulator: Simulator; scheduledOnly: boolean; minBlockH?: number; maxBlockH?: number; minDistNm?: number; maxDistNm?: number; departureRegion?: AirportRegion; stdMode: DepartureTimeMode; stdPeriod?: DeparturePeriod } {
  const flightType = (document.querySelector('input[name="flight-type"]:checked') as HTMLInputElement).value as FlightType;
  const simulator  = (document.querySelector('input[name="simulator"]:checked')  as HTMLInputElement).value as Simulator;
  const scheduledOnly = (document.querySelector('input[name="airports"]:checked') as HTMLInputElement).value === 'scheduled';
  const filterMode = getFilterMode();
  const cfg = RANGE_CONFIGS[filterMode];
  const minParsed = parseFloat((document.getElementById('filter-min') as HTMLInputElement).value);
  const maxParsed = parseFloat((document.getElementById('filter-max') as HTMLInputElement).value);
  let minBlockH: number | undefined, maxBlockH: number | undefined;
  let minDistNm: number | undefined, maxDistNm: number | undefined;
  if (filterMode === 'time') {
    minBlockH = minParsed > cfg.min ? minParsed : undefined;
    maxBlockH = maxParsed < cfg.max ? maxParsed : undefined;
  } else {
    minDistNm = minParsed > cfg.min ? Math.round(minParsed) : undefined;
    maxDistNm = maxParsed < cfg.max ? Math.round(maxParsed) : undefined;
  }
  const regionRaw = (document.getElementById('filter-region') as HTMLSelectElement).value;
  const departureRegion = regionRaw ? (regionRaw as AirportRegion) : undefined;
  const stdMode = (document.querySelector('input[name="std-mode"]:checked') as HTMLInputElement).value as DepartureTimeMode;
  const stdPeriod = stdMode === 'period'
    ? (document.querySelector('input[name="std-period"]:checked') as HTMLInputElement).value as DeparturePeriod
    : undefined;
  return { flightType, simulator, scheduledOnly, minBlockH, maxBlockH, minDistNm, maxDistNm, departureRegion, stdMode, stdPeriod };
}

let generating = false;
let currentFlight: GeneratedFlight | null = null;

function showRerollButtons(): void {
  document.querySelectorAll('.btn-reroll').forEach(b => b.classList.add('visible'));
}

function hideRerollButtons(): void {
  document.querySelectorAll('.btn-reroll').forEach(b => b.classList.remove('visible'));
}

async function generate(): Promise<void> {
  if (generating) return;
  generating = true;
  try {
    const settings = getSettings();

    if (settings.simulator === 'xplane12') {
      hideRerollButtons();
      currentFlight = null;
      renderEmpty('X-Plane 12 support is coming soon. Please select MSFS 2020 or MSFS 2024.');
      return;
    }
    if (settings.flightType === 'cargo') {
      hideRerollButtons();
      currentFlight = null;
      renderEmpty('Cargo flights are coming soon. Please select Passenger for now.');
      return;
    }

    hideRerollButtons();
    renderLoading();

    try {
      const route = await selectRoute({ flightType: settings.flightType, simulator: settings.simulator, scheduledOnly: settings.scheduledOnly, minBlockH: settings.minBlockH, maxBlockH: settings.maxBlockH, minDistNm: settings.minDistNm, maxDistNm: settings.maxDistNm, departureRegion: settings.departureRegion });
      const plan        = planFlight(route.airline, route.aircraft, route.distanceNm, settings.stdMode, settings.stdPeriod);
      const simbriefUrl = buildSimbriefUrl(route, plan);
      const flight = { route, plan, simbriefUrl };
      currentFlight = flight;
      renderFlight(flight);
      showRerollButtons();
    } catch (err) {
      currentFlight = null;
      if (err instanceof NoRouteError) {
        const hints: string[] = [];
        if (settings.minBlockH !== undefined || settings.maxBlockH !== undefined)
          hints.push('widening the block time filter');
        if (settings.minDistNm !== undefined || settings.maxDistNm !== undefined)
          hints.push('widening the distance filter');
        if (settings.scheduledOnly)
          hints.push('switching Airports to All');
        if (settings.departureRegion !== undefined)
          hints.push('selecting a different or no departure region');
        const hint = hints.length > 0 ? ` Try ${hints.join(', or ')} in Options.` : '';
        renderEmpty(`Could not generate a route.${hint} Please try again.`);
        console.error(err);
      } else {
        renderEmpty('An unexpected error occurred. Please try again.');
        console.error(err);
      }
    }
  } finally {
    generating = false;
  }
}

async function handleRerollAirline(): Promise<void> {
  if (generating || !currentFlight) return;
  generating = true;
  try {
    const settings = getSettings();
    const { route, plan } = currentFlight;
    const allAirlines = await loadAirlines();
    const pool = allAirlines.filter(a => a.type === settings.flightType || a.type === 'both');
    const candidates = pool.filter(a => a.icao !== route.airline.icao);
    const src = (candidates.length > 0 ? candidates : pool) as [Airline, ...Airline[]];
    const newAirline = pickRandom(src);
    const newFlightNumber = newAirline.icao + String(100 + Math.floor(Math.random() * 900));
    const newRoute = { ...route, airline: newAirline };
    const newPlan  = { ...plan, flight_number: newFlightNumber };
    const newUrl   = buildSimbriefUrl(newRoute, newPlan);
    currentFlight  = { route: newRoute, plan: newPlan, simbriefUrl: newUrl };
    reRenderAirline(newFlightNumber, newAirline.name, newUrl);
  } finally {
    generating = false;
  }
}

async function handleRerollDestination(): Promise<void> {
  if (generating || !currentFlight) return;
  generating = true;
  try {
    const settings = getSettings();
    const { route, plan } = currentFlight;
    const allAirports = await loadAll();
    const destPool = allAirports.filter(a => !settings.scheduledOnly || a.scheduled !== false);
    const result = findDestinationFor(route.departure, route.aircraft, destPool, settings.minBlockH, settings.maxBlockH, settings.minDistNm, settings.maxDistNm);
    if (!result) return;
    const { destination, distanceNm } = result;
    const blockTimeMin = Math.round((distanceNm / route.aircraft.cruise_kts) * 60 + 30);
    const newRoute = { ...route, destination, distanceNm };
    const newPlan  = { ...plan, distance_nm: distanceNm, block_time_min: blockTimeMin };
    const newUrl   = buildSimbriefUrl(newRoute, newPlan);
    currentFlight  = { route: newRoute, plan: newPlan, simbriefUrl: newUrl };
    reRenderDestination(destination, distanceNm, blockTimeMin, newUrl);
  } finally {
    generating = false;
  }
}

async function handleRerollDeparture(): Promise<void> {
  if (generating || !currentFlight) return;
  generating = true;
  try {
    const settings = getSettings();
    const { route, plan } = currentFlight;
    const [allAirports, depAirports] = await Promise.all([
      loadAll(),
      settings.departureRegion ? loadRegion(settings.departureRegion) : Promise.resolve(undefined),
    ]);
    const schedFilter = (a: { scheduled?: boolean }) => !settings.scheduledOnly || a.scheduled !== false;
    const depPool = (depAirports ?? allAirports).filter(schedFilter);
    const result = findDepartureForDest(route.destination, route.aircraft, depPool, settings.minBlockH, settings.maxBlockH, settings.minDistNm, settings.maxDistNm);
    if (!result) return;
    const { departure, distanceNm } = result;
    const blockTimeMin = Math.round((distanceNm / route.aircraft.cruise_kts) * 60 + 30);
    const newFlightNumber = route.airline.icao + String(100 + Math.floor(Math.random() * 900));
    const newRoute = { ...route, departure, distanceNm };
    const newPlan  = { ...plan, distance_nm: distanceNm, block_time_min: blockTimeMin, flight_number: newFlightNumber };
    const newUrl   = buildSimbriefUrl(newRoute, newPlan);
    currentFlight  = { route: newRoute, plan: newPlan, simbriefUrl: newUrl };
    reRenderDeparture(departure, distanceNm, blockTimeMin, newFlightNumber, newUrl);
  } finally {
    generating = false;
  }
}

async function handleRerollAircraft(): Promise<void> {
  if (generating || !currentFlight) return;
  generating = true;
  try {
    const settings = getSettings();
    const { route, plan } = currentFlight;
    const { distanceNm } = route;
    const allAircraftList = await loadAircraft();
    const maxRange = RANGE_UTILISATION * RANGE_RELAXATION;
    const pool = allAircraftList.filter(a =>
      a.flight_type === settings.flightType &&
      a.simulator.includes(settings.simulator) &&
      a.icao_type !== route.aircraft.icao_type &&
      distanceNm <= a.range_nm * maxRange &&
      route.departure.max_runway_m   >= a.min_runway_m &&
      route.destination.max_runway_m >= a.min_runway_m
    );
    if (pool.length === 0) return;
    const newAircraft  = pickRandom(pool as [Aircraft, ...Aircraft[]]);
    const blockTimeMin = Math.round((distanceNm / newAircraft.cruise_kts) * 60 + 30);
    const newRoute     = { ...route, aircraft: newAircraft };
    const newPlan      = { ...plan, block_time_min: blockTimeMin };
    const newUrl       = buildSimbriefUrl(newRoute, newPlan);
    currentFlight      = { route: newRoute, plan: newPlan, simbriefUrl: newUrl };
    reRenderAircraft(newAircraft, blockTimeMin, newUrl);
  } finally {
    generating = false;
  }
}

renderBlank();

document.getElementById('btn-generate')!.addEventListener('click', generate);
document.getElementById('btn-reroll-airline')!.addEventListener('click', handleRerollAirline);
document.getElementById('btn-reroll-dest')!.addEventListener('click', handleRerollDestination);
document.getElementById('btn-reroll-dep')!.addEventListener('click', handleRerollDeparture);
document.getElementById('btn-reroll-aircraft')!.addEventListener('click', handleRerollAircraft);

const viewMain  = document.getElementById('view-main')!;
const viewAbout = document.getElementById('view-about')!;

document.getElementById('nav-about')!.addEventListener('click', () => {
  cancelAnim();
  viewMain.classList.add('hidden');
  viewAbout.classList.remove('hidden');
});

document.getElementById('nav-back')!.addEventListener('click', () => {
  viewAbout.classList.add('hidden');
  viewMain.classList.remove('hidden');
});

// ── Range filter — dual slider ────────────────────────────────────────────────

const filterMinEl   = document.getElementById('filter-min')      as HTMLInputElement;
const filterMaxEl   = document.getElementById('filter-max')      as HTMLInputElement;
const dualFillEl    = document.getElementById('dual-range-fill') as HTMLElement;
const rangeValMinEl = document.getElementById('range-val-min')   as HTMLElement;
const rangeValMaxEl = document.getElementById('range-val-max')   as HTMLElement;

function updateDualRange(): void {
  const cfg = RANGE_CONFIGS[getFilterMode()];
  const minVal = parseFloat(filterMinEl.value);
  const maxVal = parseFloat(filterMaxEl.value);
  const span = cfg.max - cfg.min;
  dualFillEl.style.left  = `${(minVal - cfg.min) / span * 100}%`;
  dualFillEl.style.width = `${(maxVal - minVal)  / span * 100}%`;
  rangeValMinEl.textContent = minVal > cfg.min ? `${minVal}${cfg.unit}` : 'Any';
  rangeValMaxEl.textContent = maxVal < cfg.max ? `${maxVal}${cfg.unit}` : 'Any';
  rangeValMinEl.classList.toggle('range-val-any', minVal <= cfg.min);
  rangeValMaxEl.classList.toggle('range-val-any', maxVal >= cfg.max);
}

function applyFilterMode(mode: 'time' | 'dist'): void {
  const cfg = RANGE_CONFIGS[mode];
  for (const el of [filterMinEl, filterMaxEl]) {
    el.min = String(cfg.min);
    el.max = String(cfg.max);
    el.step = String(cfg.step);
  }
  filterMinEl.value = localStorage.getItem(mode === 'time' ? 'disp-filter-min'      : 'disp-filter-dist-min') ?? String(cfg.min);
  filterMaxEl.value = localStorage.getItem(mode === 'time' ? 'disp-filter-max'      : 'disp-filter-dist-max') ?? String(cfg.max);
  updateDualRange();
}

filterMinEl.addEventListener('input', () => {
  if (parseFloat(filterMinEl.value) > parseFloat(filterMaxEl.value))
    filterMinEl.value = filterMaxEl.value;
  localStorage.setItem(getFilterMode() === 'time' ? 'disp-filter-min' : 'disp-filter-dist-min', filterMinEl.value);
  updateDualRange();
});

filterMaxEl.addEventListener('input', () => {
  if (parseFloat(filterMaxEl.value) < parseFloat(filterMinEl.value))
    filterMaxEl.value = filterMinEl.value;
  localStorage.setItem(getFilterMode() === 'time' ? 'disp-filter-max' : 'disp-filter-dist-max', filterMaxEl.value);
  updateDualRange();
});

document.querySelectorAll('input[name="filter-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const mode = (radio as HTMLInputElement).value as 'time' | 'dist';
    localStorage.setItem('disp-filter-mode', mode);
    applyFilterMode(mode);
  });
});

const savedFilterMode = (localStorage.getItem('disp-filter-mode') ?? 'time') as 'time' | 'dist';
if (savedFilterMode === 'dist') {
  const el = document.getElementById('fmode-dist') as HTMLInputElement | null;
  if (el) el.checked = true;
}
applyFilterMode(savedFilterMode);

const filterRegionEl = document.getElementById('filter-region') as HTMLSelectElement;
const savedRegion = localStorage.getItem('disp-filter-region');
if (savedRegion) filterRegionEl.value = savedRegion;
filterRegionEl.addEventListener('change', () => localStorage.setItem('disp-filter-region', filterRegionEl.value));

// ── Departure time — period row toggle + persist ───────────────────────────────

const stdPeriodRow = document.getElementById('std-period-row')!;

function syncPeriodRow(): void {
  const mode = (document.querySelector('input[name="std-mode"]:checked') as HTMLInputElement).value;
  if (mode === 'period') stdPeriodRow.classList.remove('hidden');
  else stdPeriodRow.classList.add('hidden');
}

document.querySelectorAll('input[name="std-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    syncPeriodRow();
    localStorage.setItem('disp-std-mode', (radio as HTMLInputElement).value);
  });
});

document.querySelectorAll('input[name="std-period"]').forEach(radio => {
  radio.addEventListener('change', () => localStorage.setItem('disp-std-period', (radio as HTMLInputElement).value));
});

const savedStdMode   = localStorage.getItem('disp-std-mode');
const savedStdPeriod = localStorage.getItem('disp-std-period');
if (savedStdMode) {
  const el = document.getElementById(`std-${savedStdMode}`) as HTMLInputElement | null;
  if (el) { el.checked = true; syncPeriodRow(); }
}
if (savedStdPeriod) {
  const el = document.getElementById(`per-${savedStdPeriod}`) as HTMLInputElement | null;
  if (el) el.checked = true;
}

// ── Options panel — restore and persist open/closed state ────────────────────

const optionsPanelEl = document.querySelector('.advanced-section') as HTMLDetailsElement;
const savedOptionsOpen = localStorage.getItem('disp-options-open');
if (savedOptionsOpen !== null) optionsPanelEl.open = savedOptionsOpen === '1';
optionsPanelEl.addEventListener('toggle', () =>
  localStorage.setItem('disp-options-open', optionsPanelEl.open ? '1' : '0')
);

// ── Electron window auto-fit ──────────────────────────────────────────────────

declare global { interface Window { electronAPI?: { resizeToHeight(h: number): void } } }

if (window.electronAPI) {
  document.body.classList.add('electron');

  const mainShell = document.querySelector<HTMLElement>('#view-main .app-shell')!;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const sendHeight = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (viewMain.classList.contains('hidden')) return;
      window.electronAPI!.resizeToHeight(mainShell.offsetHeight);
    }, 80);
  };
  new ResizeObserver(sendHeight).observe(mainShell);
}
