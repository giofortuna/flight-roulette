import type { FlightType, Simulator, AirportRegion, DepartureTimeMode, DeparturePeriod } from './types.js';
import { loadAircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';
import { selectRoute, NoRouteError } from './route-selector.js';
import { planFlight } from './flight-planner.js';
import { generatePayload } from './payload-gen.js';
import { buildSimbriefUrl } from './simbrief.js';
import { renderFlight, renderBlank, renderEmpty, renderLoading, cancelAnim } from './renderer.js';

// Warm the caches before the user clicks Generate
Promise.all([loadAircraft(), loadAirlines()]).catch(err => {
  console.error('Failed to preload app data:', err);
});

function getSettings(): { flightType: FlightType; simulator: Simulator; useRandomPayload: boolean; scheduledOnly: boolean; minBlockH?: number; maxBlockH?: number; departureRegion?: AirportRegion; stdMode: DepartureTimeMode; stdPeriod?: DeparturePeriod } {
  const flightType = (document.querySelector('input[name="flight-type"]:checked') as HTMLInputElement).value as FlightType;
  const simulator  = (document.querySelector('input[name="simulator"]:checked')  as HTMLInputElement).value as Simulator;
  const useRandomPayload = (document.querySelector('input[name="payload"]:checked') as HTMLInputElement).value === 'random';
  const scheduledOnly    = (document.querySelector('input[name="airports"]:checked') as HTMLInputElement).value === 'scheduled';
  const minRaw = (document.getElementById('filter-min') as HTMLInputElement).value;
  const maxRaw = (document.getElementById('filter-max') as HTMLInputElement).value;
  const minBlockH = minRaw ? Number(minRaw) : undefined;
  const maxBlockH = maxRaw ? Number(maxRaw) : undefined;
  const regionRaw = (document.getElementById('filter-region') as HTMLSelectElement).value;
  const departureRegion = regionRaw ? (regionRaw as AirportRegion) : undefined;
  const stdMode = (document.querySelector('input[name="std-mode"]:checked') as HTMLInputElement).value as DepartureTimeMode;
  const stdPeriod = stdMode === 'period'
    ? (document.querySelector('input[name="std-period"]:checked') as HTMLInputElement).value as DeparturePeriod
    : undefined;
  return { flightType, simulator, useRandomPayload, scheduledOnly, minBlockH, maxBlockH, departureRegion, stdMode, stdPeriod };
}

let generating = false;

async function generate(): Promise<void> {
  if (generating) return;
  generating = true;
  try {
    const settings = getSettings();

    if (settings.simulator === 'xplane12') {
      renderEmpty('X-Plane 12 support is coming soon. Please select MSFS 2020 or MSFS 2024.');
      return;
    }
    if (settings.flightType === 'cargo') {
      renderEmpty('Cargo flights are coming soon. Please select Passenger for now.');
      return;
    }

    renderLoading();

    try {
      const route = await selectRoute({ flightType: settings.flightType, simulator: settings.simulator, scheduledOnly: settings.scheduledOnly, minBlockH: settings.minBlockH, maxBlockH: settings.maxBlockH, departureRegion: settings.departureRegion });
      const plan    = planFlight(route.airline, route.aircraft, route.distanceNm, settings.stdMode, settings.stdPeriod);
      const payload = generatePayload(route.aircraft, settings.flightType);
      const simbriefUrl = buildSimbriefUrl(route, plan, payload, { useRandomPayload: settings.useRandomPayload });
      renderFlight({ route, plan, payload, simbriefUrl });
    } catch (err) {
      if (err instanceof NoRouteError) {
        const hints: string[] = [];
        if (settings.minBlockH !== undefined || settings.maxBlockH !== undefined)
          hints.push('widening the block time filter');
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

renderBlank();

document.getElementById('btn-generate')!.addEventListener('click', generate);

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

// ── Block time filter — restore and persist ───────────────────────────────────

const filterMinEl = document.getElementById('filter-min') as HTMLInputElement;
const filterMaxEl = document.getElementById('filter-max') as HTMLInputElement;

const savedMin = localStorage.getItem('disp-filter-min');
const savedMax = localStorage.getItem('disp-filter-max');
if (savedMin) filterMinEl.value = savedMin;
if (savedMax) filterMaxEl.value = savedMax;

filterMinEl.addEventListener('input', () => localStorage.setItem('disp-filter-min', filterMinEl.value));
filterMaxEl.addEventListener('input', () => localStorage.setItem('disp-filter-max', filterMaxEl.value));

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
