import type { FlightType, Simulator, AirportRegion, DepartureTimeMode, DeparturePeriod } from './types.js';
import { loadAircraft } from './aircraft-db.js';
import type { Aircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';
import type { Airline } from './airline-db.js';
import { loadAll, loadRegion } from './airport-db.js';
import { selectRoute, NoRouteError, pickRandom, findDestinationFor, findDepartureForDest, buildRerollAircraftPool } from './route-selector.js';
import type { RouteLocks } from './route-selector.js';
import { parsePresetFlightNumber, parsePresetIcao, parsePresetStd, PresetError } from './preset.js';
import { planFlight } from './flight-planner.js';
import { buildSimbriefUrl } from './simbrief.js';
import { buildPln, plnFilename } from './pln.js';
import { renderFlight, renderBlank, renderEmpty, renderLoading, cancelAnim, reRenderAirline, reRenderDestination, reRenderDeparture, reRenderAircraft } from './renderer.js';
import type { GeneratedFlight } from './renderer.js';
import { aircraftKey, filterEnabledAircraft } from './aircraft-filter.js';
import { loadCustomAircraft, addCustomAircraft, removeCustomAircraftAt, validateCustomEntry } from './custom-aircraft.js';

// Warm the caches before the user clicks Generate, then populate settings UI
Promise.all([loadAircraft(), loadAirlines()]).then(
  ([aircraft]) => { initAircraftSettings(aircraft); },
  err => { console.error('Failed to preload app data:', err); }
);

// ── Aircraft enable/disable ───────────────────────────────────────────────────

type PrefsSim = 'msfs2020' | 'msfs2024';
let currentPrefsSim: PrefsSim = 'msfs2020';
let allAircraftCache: Aircraft[] | null = null;

function getDisabledAircraftKeys(): Set<string> {
  const stored = localStorage.getItem('disp-aircraft-disabled');
  if (!stored) return new Set();
  try { return new Set(JSON.parse(stored) as string[]); }
  catch { return new Set(); }
}

function saveDisabledAircraftKeys(keys: Set<string>): void {
  if (keys.size === 0) {
    localStorage.removeItem('disp-aircraft-disabled');
  } else {
    localStorage.setItem('disp-aircraft-disabled', JSON.stringify([...keys]));
  }
}

function getCommunityPath(sim: PrefsSim): string | null {
  return localStorage.getItem(`disp-community-${sim}`);
}

function saveCommunityPath(sim: PrefsSim, p: string): void {
  localStorage.setItem(`disp-community-${sim}`, p);
}

function getScanResult(sim: string): Set<string> | null {
  const stored = localStorage.getItem(`disp-scan-${sim}`);
  if (!stored) return null;
  try { return new Set(JSON.parse(stored) as string[]); }
  catch { return null; }
}

function saveScanResult(sim: PrefsSim, icaoTypes: string[]): void {
  localStorage.setItem(`disp-scan-${sim}`, JSON.stringify(icaoTypes));
}

function getInstalledAircraft(all: Aircraft[], sim: Simulator): Aircraft[] {
  const scan = getScanResult(sim);
  if (!scan) return all;
  return all.filter(a => scan.has(a.icao_type));
}

function renderAircraftList(sim: PrefsSim): void {
  const container = document.getElementById('prefs-aircraft-list')!;
  container.innerHTML = '';
  if (!allAircraftCache) return;

  const scan     = getScanResult(sim);
  const visible  = scan ? allAircraftCache.filter(a => scan.has(a.icao_type)) : allAircraftCache;
  const disabled = getDisabledAircraftKeys();

  const groups: Array<{ type: 'passenger' | 'cargo'; label: string }> = [
    { type: 'passenger', label: 'Passenger' },
    { type: 'cargo',     label: 'Cargo'     },
  ];

  for (const { type, label } of groups) {
    const group = visible.filter(a => a.flight_type === type);
    if (group.length === 0) continue;

    const groupEl = document.createElement('div');
    groupEl.className = 'ac-group';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'ac-group-header';

    const groupLabel = document.createElement('div');
    groupLabel.className = 'ac-group-label';
    groupLabel.textContent = label;

    const groupActions = document.createElement('div');
    groupActions.className = 'ac-group-actions';

    const allBtn  = document.createElement('button');
    allBtn.className   = 'ac-action-btn';
    allBtn.textContent = 'All';

    const noneBtn = document.createElement('button');
    noneBtn.className   = 'ac-action-btn';
    noneBtn.textContent = 'None';

    groupActions.append(allBtn, noneBtn);
    groupHeader.append(groupLabel, groupActions);
    groupEl.appendChild(groupHeader);

    const groupInputs: HTMLInputElement[] = [];

    group.forEach((ac, i) => {
      const key = aircraftKey(ac);
      const id  = `ac-toggle-${type}-${i}`;

      const item  = document.createElement('div');
      item.className = 'ac-item';

      const input = document.createElement('input');
      input.type    = 'checkbox';
      input.id      = id;
      input.checked = !disabled.has(key);
      groupInputs.push(input);

      const lbl   = document.createElement('label');
      lbl.htmlFor = id;

      const dot = document.createElement('span');
      dot.className = 'ac-dot';

      const name = document.createElement('span');
      name.className   = 'ac-name';
      name.textContent = ac.type_name;

      const addon = document.createElement('span');
      addon.className   = 'ac-addon';
      addon.textContent = ac.airframe_name;

      lbl.append(dot, name, addon);
      item.append(input, lbl);
      groupEl.appendChild(item);

      input.addEventListener('change', () => {
        const d = getDisabledAircraftKeys();
        if (input.checked) { d.delete(key); } else { d.add(key); }
        saveDisabledAircraftKeys(d);
      });
    });

    allBtn.addEventListener('click', () => {
      const d = getDisabledAircraftKeys();
      group.forEach((ac, i) => { groupInputs[i].checked = true; d.delete(aircraftKey(ac)); });
      saveDisabledAircraftKeys(d);
    });

    noneBtn.addEventListener('click', () => {
      const d = getDisabledAircraftKeys();
      group.forEach((ac, i) => { groupInputs[i].checked = false; d.add(aircraftKey(ac)); });
      saveDisabledAircraftKeys(d);
    });

    container.appendChild(groupEl);
  }
}

function renderCommunityFolder(sim: PrefsSim): void {
  const container = document.getElementById('prefs-community-body')!;
  container.innerHTML = '';

  const folderPath = getCommunityPath(sim);
  const scanResult = getScanResult(sim);

  const row = document.createElement('div');
  row.className = 'cf-row';

  const pathEl = document.createElement('span');
  pathEl.className   = 'cf-path';
  // LRM prefix: .cf-path renders RTL for head-truncation, which would move a
  // leading "/" (bidi-neutral) of macOS paths to the visual end of the string
  pathEl.textContent = folderPath ? '\u200E' + folderPath : 'Not found';
  pathEl.title       = folderPath ?? '';

  const changeBtn = document.createElement('button');
  changeBtn.className   = 'cf-btn';
  changeBtn.textContent = 'Change';
  changeBtn.addEventListener('click', async () => {
    const selected = await window.electronAPI!.openFolderDialog();
    if (selected) { saveCommunityPath(sim, selected); renderCommunityFolder(sim); }
  });

  const scanBtn = document.createElement('button');
  scanBtn.className   = 'cf-btn cf-scan-btn';
  scanBtn.textContent = 'Scan';
  scanBtn.disabled    = !folderPath;
  scanBtn.addEventListener('click', async () => {
    scanBtn.textContent = 'Scanning…';
    scanBtn.disabled    = true;
    changeBtn.disabled  = true;

    const listContainer = document.getElementById('prefs-aircraft-list')!;
    listContainer.innerHTML = '';
    const progress = document.createElement('div');
    progress.className   = 'cf-scanning';
    progress.textContent = 'Scanning community folder…';
    listContainer.appendChild(progress);

    try {
      const found = await window.electronAPI!.scanCommunityFolder(folderPath!);
      saveScanResult(sim, found);
      renderCommunityFolder(sim);
      renderAircraftList(sim);
    } catch {
      listContainer.innerHTML = '';
      renderAircraftList(sim);
      scanBtn.textContent = 'Scan';
      scanBtn.disabled    = false;
      changeBtn.disabled  = false;
    }
  });

  row.append(pathEl, changeBtn, scanBtn);
  container.appendChild(row);

  if (scanResult !== null) {
    const matched = (allAircraftCache ?? []).filter(a => scanResult.has(a.icao_type)).length;

    const statusRow = document.createElement('div');
    statusRow.className = 'cf-status-row';

    const status = document.createElement('span');
    status.className   = 'cf-status';
    status.textContent = `${matched} aircraft detected`;

    const resetBtn = document.createElement('button');
    resetBtn.className   = 'cf-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(`disp-scan-${sim}`);
      renderCommunityFolder(sim);
      renderAircraftList(sim);
    });

    statusRow.append(status, resetBtn);
    container.appendChild(statusRow);
  }
}

async function autoDetectCommunityFolders(): Promise<void> {
  for (const sim of ['msfs2020', 'msfs2024'] as PrefsSim[]) {
    if (!getCommunityPath(sim)) {
      try {
        const detected = await window.electronAPI!.detectCommunityFolder(sim);
        if (detected) {
          saveCommunityPath(sim, detected);
          if (sim === currentPrefsSim) renderCommunityFolder(sim);
        }
      } catch {}
    }
  }
}

function initAircraftSettings(allAircraft: Aircraft[]): void {
  allAircraftCache = allAircraft;

  if (window.electronAPI) {
    document.getElementById('prefs-sim-tabs')!.classList.remove('hidden');
    document.getElementById('prefs-community-section')!.classList.remove('hidden');
    autoDetectCommunityFolders();
  }

  document.querySelectorAll<HTMLButtonElement>('.prefs-sim-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.prefs-sim-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPrefsSim = tab.dataset.sim as PrefsSim;
      renderAircraftList(currentPrefsSim);
      if (window.electronAPI) renderCommunityFolder(currentPrefsSim);
    });
  });

  renderAircraftList(currentPrefsSim);
  if (window.electronAPI) renderCommunityFolder(currentPrefsSim);
  renderCustomAircraftList();
}

const SIM_BADGE: Record<Simulator, string> = { msfs2020: 'MSFS2020', msfs2024: 'MSFS2024', xplane12: 'XP12' };

function renderCustomAircraftList(): void {
  const container = document.getElementById('prefs-custom-list')!;
  container.innerHTML = '';
  const custom   = loadCustomAircraft();
  const disabled = getDisabledAircraftKeys();

  if (custom.length === 0) {
    const empty = document.createElement('div');
    empty.className   = 'custom-ac-empty';
    empty.textContent = 'No custom aircraft added yet.';
    container.appendChild(empty);
    return;
  }

  custom.forEach((ac, i) => {
    const key = aircraftKey(ac);
    const id  = `cac-toggle-${i}`;

    const item = document.createElement('div');
    item.className = 'ac-item ac-item-custom';

    const input = document.createElement('input');
    input.type    = 'checkbox';
    input.id      = id;
    input.checked = !disabled.has(key);

    const lbl = document.createElement('label');
    lbl.htmlFor = id;

    const dot = document.createElement('span');
    dot.className = 'ac-dot';

    const name = document.createElement('span');
    name.className   = 'ac-name';
    name.textContent = ac.type_name;

    const addon = document.createElement('span');
    addon.className   = 'ac-addon';
    addon.textContent = ac.airframe_name;

    const badges = document.createElement('span');
    badges.className = 'ac-sim-badges';
    for (const s of ac.simulator) {
      const badge = document.createElement('span');
      badge.className   = 'ac-sim-badge';
      badge.textContent = SIM_BADGE[s] ?? s;
      badges.appendChild(badge);
    }

    lbl.append(dot, name, badges, addon);

    const delBtn = document.createElement('button');
    delBtn.type      = 'button';
    delBtn.className = 'ac-delete-btn';
    delBtn.textContent = '×';
    delBtn.title     = 'Remove';
    delBtn.addEventListener('click', () => {
      removeCustomAircraftAt(i);
      // Keys are unique across curated + custom, so dropping the disabled
      // entry can't affect another aircraft
      const d = getDisabledAircraftKeys();
      if (d.delete(key)) saveDisabledAircraftKeys(d);
      renderCustomAircraftList();
    });

    item.append(input, lbl, delBtn);
    container.appendChild(item);

    input.addEventListener('change', () => {
      const d = getDisabledAircraftKeys();
      if (input.checked) { d.delete(key); } else { d.add(key); }
      saveDisabledAircraftKeys(d);
    });
  });
}

document.getElementById('custom-ac-form')!.addEventListener('submit', e => {
  e.preventDefault();
  const errorEl = document.getElementById('custom-ac-error')!;
  errorEl.textContent = '';

  const simulators: string[] = [];
  if ((document.getElementById('cac-sim-2020') as HTMLInputElement).checked) simulators.push('msfs2020');
  if ((document.getElementById('cac-sim-2024') as HTMLInputElement).checked) simulators.push('msfs2024');

  const data: Record<string, unknown> = {
    type_name:           (document.getElementById('cac-type-name')      as HTMLInputElement).value,
    airframe_name:       (document.getElementById('cac-developer')       as HTMLInputElement).value,
    simbrief_type:       (document.getElementById('cac-simbrief-type')   as HTMLInputElement).value,
    simbrief_airframe_id:(document.getElementById('cac-simbrief-id')     as HTMLInputElement).value,
    flight_type:         (document.querySelector('input[name="cac-ftype"]:checked') as HTMLInputElement | null)?.value ?? '',
    simulator:           simulators,
    range_nm:            parseFloat((document.getElementById('cac-range')   as HTMLInputElement).value),
    min_runway_m:        parseFloat((document.getElementById('cac-runway')  as HTMLInputElement).value),
    cruise_kts:          parseFloat((document.getElementById('cac-cruise')  as HTMLInputElement).value),
    category:            (document.getElementById('cac-category') as HTMLSelectElement).value,
  };

  try {
    addCustomAircraft(validateCustomEntry(data), allAircraftCache ?? []);
    (e.target as HTMLFormElement).reset();
    (document.getElementById('cac-ftype-pax')  as HTMLInputElement).checked = true;
    (document.getElementById('cac-sim-2024')   as HTMLInputElement).checked = true;
    (document.getElementById('cac-category')   as HTMLSelectElement).value  = 'narrowbody';
    (document.getElementById('custom-ac-details') as HTMLDetailsElement).open = false;
    renderCustomAircraftList();
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : 'Invalid entry';
  }
});

// ── Pre-set fields (issue #35) ────────────────────────────────────────────────

const presetFltnumEl   = document.getElementById('preset-fltnum')   as HTMLInputElement;
const presetDepEl      = document.getElementById('preset-dep')      as HTMLInputElement;
const presetDestEl     = document.getElementById('preset-dest')     as HTMLInputElement;
const presetAircraftEl = document.getElementById('preset-aircraft') as HTMLSelectElement;
const presetStdEl      = document.getElementById('preset-std')      as HTMLInputElement;
const presetErrorEl    = document.getElementById('preset-error')!;
const presetDetailsEl  = document.getElementById('preset-details')  as HTMLDetailsElement;

function resetPresetFields(): void {
  presetFltnumEl.value   = '';
  presetDepEl.value      = '';
  presetDestEl.value     = '';
  presetAircraftEl.value = '';
  presetStdEl.value      = '';
  presetErrorEl.textContent = '';
}

document.getElementById('preset-reset')!.addEventListener('click', resetPresetFields);

// Rebuild the aircraft dropdown from the currently enabled pool each time the
// panel opens, keeping a still-valid selection
async function populatePresetAircraft(): Promise<void> {
  const settings  = getSettings();
  const curated   = await loadAircraft();
  const installed = [...getInstalledAircraft(curated, settings.simulator), ...loadCustomAircraft()];
  const enabled   = filterEnabledAircraft(installed, getDisabledAircraftKeys())
    .filter(a => a.simulator.includes(settings.simulator));

  const prev = presetAircraftEl.value;
  presetAircraftEl.innerHTML = '';
  const random = document.createElement('option');
  random.value = '';
  random.textContent = 'Random';
  presetAircraftEl.appendChild(random);
  for (const a of enabled) {
    const opt = document.createElement('option');
    opt.value = aircraftKey(a);
    opt.textContent = `${a.type_name} — ${a.airframe_name}`;
    presetAircraftEl.appendChild(opt);
  }
  if ([...presetAircraftEl.options].some(o => o.value === prev)) presetAircraftEl.value = prev;
}

presetDetailsEl.addEventListener('toggle', () => {
  if (presetDetailsEl.open) void populatePresetAircraft();
});

interface ResolvedPreset {
  locks?: RouteLocks;
  flightNumber?: string;
  stdMs?: number;
}

// Throws PresetError on malformed values or unresolvable references
async function resolvePreset(enabledAircraft: Aircraft[]): Promise<ResolvedPreset> {
  const fltnum   = parsePresetFlightNumber(presetFltnumEl.value);
  const depIcao  = parsePresetIcao(presetDepEl.value,  'Departure');
  const destIcao = parsePresetIcao(presetDestEl.value, 'Destination');
  const stdMs    = parsePresetStd(presetStdEl.value);
  const lockKey  = presetAircraftEl.value;

  if (!fltnum && !depIcao && !destIcao && stdMs === null && !lockKey) return {};

  const locks: RouteLocks = {};
  if (depIcao || destIcao) {
    if (depIcao && destIcao && depIcao === destIcao)
      throw new PresetError('Departure and destination must differ');
    const all = await loadAll();
    if (depIcao) {
      locks.departure = all.find(a => a.icao === depIcao);
      if (!locks.departure) throw new PresetError(`Departure ${depIcao} not found in the airport database`);
    }
    if (destIcao) {
      locks.destination = all.find(a => a.icao === destIcao);
      if (!locks.destination) throw new PresetError(`Destination ${destIcao} not found in the airport database`);
    }
  }
  if (lockKey) {
    locks.aircraft = enabledAircraft.find(a => aircraftKey(a) === lockKey);
    if (!locks.aircraft) throw new PresetError('Pre-set aircraft is no longer enabled — re-select it');
  }
  if (fltnum) {
    const allAirlines = await loadAirlines();
    locks.airline = allAirlines.find(a => a.icao === fltnum.airlineIcao);
    if (!locks.airline) throw new PresetError(`Unknown airline code ${fltnum.airlineIcao}`);
  }

  const hasLocks = Object.values(locks).some(v => v !== undefined);
  return {
    locks: hasLocks ? locks : undefined,
    flightNumber: fltnum?.flightNumber,
    stdMs: stdMs ?? undefined,
  };
}

function presetActive(p: ResolvedPreset): boolean {
  return p.locks !== undefined || p.flightNumber !== undefined || p.stdMs !== undefined;
}

// ─────────────────────────────────────────────────────────────────────────────

const RANGE_CONFIGS = {
  time: { min: 0, max: 16,   step: 0.5, unit: 'h'  },
  dist: { min: 0, max: 9900, step: 100, unit: 'nm' },
} as const;

const filterMinEl = document.getElementById('filter-min') as HTMLInputElement;
const filterMaxEl = document.getElementById('filter-max') as HTMLInputElement;

function getFilterMode(): 'time' | 'dist' {
  return (document.querySelector('input[name="filter-mode"]:checked') as HTMLInputElement).value as 'time' | 'dist';
}

function getSettings(): { flightTypes: FlightType[]; simulator: Simulator; scheduledOnly: boolean; minBlockH?: number; maxBlockH?: number; minDistNm?: number; maxDistNm?: number; departureRegion?: AirportRegion; stdMode: DepartureTimeMode; stdPeriod?: DeparturePeriod } {
  const checked = Array.from(document.querySelectorAll('input[name="flight-type"]:checked')) as HTMLInputElement[];
  const flightTypes: FlightType[] = checked.length > 0 ? checked.map(el => el.value as FlightType) : ['passenger'];
  const simulator  = (document.querySelector('input[name="simulator"]:checked')  as HTMLInputElement).value as Simulator;
  const scheduledOnly = (document.querySelector('input[name="airports"]:checked') as HTMLInputElement).value === 'scheduled';
  const filterMode = getFilterMode();
  const cfg = RANGE_CONFIGS[filterMode];
  const minParsed = parseFloat(filterMinEl.value);
  const maxParsed = parseFloat(filterMaxEl.value);
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
  return { flightTypes, simulator, scheduledOnly, minBlockH, maxBlockH, minDistNm, maxDistNm, departureRegion, stdMode, stdPeriod };
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
    hideRerollButtons();

    const curated         = await loadAircraft();
    const custom          = loadCustomAircraft();
    const disabled        = getDisabledAircraftKeys();
    const installed       = [...getInstalledAircraft(curated, settings.simulator), ...custom];
    const enabledAircraft = filterEnabledAircraft(installed, disabled);

    if (enabledAircraft.length === 0) {
      currentFlight = null;
      renderEmpty('No aircraft enabled. Enable at least one aircraft in Settings.');
      return;
    }

    const hasMatch = enabledAircraft.some(a =>
      settings.flightTypes.includes(a.flight_type) && a.simulator.includes(settings.simulator)
    );
    if (!hasMatch) {
      currentFlight = null;
      renderEmpty('No enabled aircraft match the selected Flight Type and Simulator. Enable more aircraft in Settings.');
      return;
    }

    presetErrorEl.textContent = '';
    let preset: ResolvedPreset;
    try {
      preset = await resolvePreset(enabledAircraft);
    } catch (err) {
      if (err instanceof PresetError) {
        currentFlight = null;
        presetDetailsEl.open = true;
        presetErrorEl.textContent = err.message;
        renderEmpty(`Pre-set fields: ${err.message}`);
        return;
      }
      throw err;
    }

    renderLoading();
    try {
      const route = await selectRoute({ flightTypes: settings.flightTypes, simulator: settings.simulator, scheduledOnly: settings.scheduledOnly, minBlockH: settings.minBlockH, maxBlockH: settings.maxBlockH, minDistNm: settings.minDistNm, maxDistNm: settings.maxDistNm, departureRegion: settings.departureRegion }, enabledAircraft, preset.locks);
      let plan = planFlight(route.airline, route.aircraft, route.distanceNm, settings.stdMode, settings.stdPeriod);
      if (preset.flightNumber !== undefined) plan = { ...plan, flight_number: preset.flightNumber };
      if (preset.stdMs        !== undefined) plan = { ...plan, std_ms: preset.stdMs };
      const simbriefUrl = buildSimbriefUrl(route, plan);
      const flight = { route, plan, simbriefUrl };
      currentFlight = flight;
      renderFlight(flight);
      showRerollButtons();
      if (presetActive(preset)) resetPresetFields();
    } catch (err) {
      currentFlight = null;
      if (err instanceof NoRouteError && preset.locks) {
        renderEmpty(`${err.message}. Adjust or reset the pre-set fields.`);
        console.error(err);
      } else if (err instanceof NoRouteError) {
        const hints: string[] = [];
        if (settings.minBlockH !== undefined || settings.maxBlockH !== undefined)
          hints.push('widening the block time filter');
        if (settings.minDistNm !== undefined || settings.maxDistNm !== undefined) {
          const eligibleAircraft = enabledAircraft.filter(a =>
            settings.flightTypes.includes(a.flight_type) && a.simulator.includes(settings.simulator)
          );
          const anyCanReachMin = settings.minDistNm === undefined ||
            eligibleAircraft.some(a => a.range_nm * 0.8 >= settings.minDistNm!);
          if (!anyCanReachMin) {
            hints.push('enabling aircraft with a longer range, or widening the distance filter');
          } else {
            hints.push('widening the distance filter');
          }
        }
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
    const { route, plan } = currentFlight;
    const allAirlines = await loadAirlines();
    const pool = allAirlines.filter(a => a.type === route.aircraft.flight_type || a.type === 'both');
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
    const curated  = await loadAircraft();
    const custom   = loadCustomAircraft();
    const installed = [...getInstalledAircraft(curated, settings.simulator), ...custom];
    const pool = buildRerollAircraftPool(
      filterEnabledAircraft(installed, getDisabledAircraftKeys()),
      settings.flightTypes,
      route.airline.type,
      settings.simulator,
      route.aircraft.icao_type,
      distanceNm,
      route.departure.max_runway_m,
      route.destination.max_runway_m,
    );
    if (pool.length === 0) {
      hideRerollButtons();
      currentFlight = null;
      renderEmpty('No alternative aircraft available. Enable more aircraft in Settings.');
      return;
    }
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

let savingPln = false;
document.getElementById('btn-pln')!.addEventListener('click', async () => {
  if (!currentFlight || savingPln) return;
  savingPln = true;
  const content  = buildPln(currentFlight.route);
  const filename = plnFilename(currentFlight.route);
  if (window.electronAPI?.savePln) {
    try {
      const ok = await window.electronAPI.savePln(content, filename);
      if (ok === false) alert('Failed to save flight plan. Check folder permissions.');
    } catch (err) {
      console.error('savePln IPC error:', err);
      alert('Failed to save flight plan. Check folder permissions.');
    } finally {
      savingPln = false;
    }
  } else {
    try {
      const blob = new Blob([content], { type: 'application/xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      savingPln = false;
    }
  }
});

const viewMain  = document.getElementById('view-main')!;
const viewAbout = document.getElementById('view-about')!;
const viewPrefs = document.getElementById('view-prefs')!;

document.getElementById('nav-about')!.addEventListener('click', () => {
  cancelAnim();
  viewMain.classList.add('hidden');
  viewAbout.classList.remove('hidden');
});

document.getElementById('nav-back')!.addEventListener('click', () => {
  viewAbout.classList.add('hidden');
  viewMain.classList.remove('hidden');
});

document.getElementById('nav-prefs')!.addEventListener('click', () => {
  cancelAnim();
  viewMain.classList.add('hidden');
  viewPrefs.classList.remove('hidden');
});

document.getElementById('nav-back-prefs')!.addEventListener('click', () => {
  viewPrefs.classList.add('hidden');
  viewMain.classList.remove('hidden');
});

// ── Range filter — dual slider ────────────────────────────────────────────────

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

// ── Flight type + simulator + airports — persist ─────────────────────────────

function persistRadioGroup(name: string, key: string): void {
  document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
    radio.addEventListener('change', () => localStorage.setItem(key, (radio as HTMLInputElement).value));
  });
  const saved = localStorage.getItem(key);
  if (saved) {
    const el = document.querySelector(`input[name="${name}"][value="${saved}"]`) as HTMLInputElement | null;
    if (el) el.checked = true;
  }
}

// Flight type checkboxes — persist individually, guard against deselecting both
const ftPassengerEl = document.getElementById('ft-passenger') as HTMLInputElement;
const ftCargoEl     = document.getElementById('ft-cargo')     as HTMLInputElement;

ftPassengerEl.addEventListener('change', () => {
  if (!ftPassengerEl.checked && !ftCargoEl.checked) {
    ftCargoEl.checked = true;
    localStorage.setItem('disp-ft-cargo', '1');
  }
  localStorage.setItem('disp-ft-passenger', ftPassengerEl.checked ? '1' : '0');
});
ftCargoEl.addEventListener('change', () => {
  if (!ftCargoEl.checked && !ftPassengerEl.checked) {
    ftPassengerEl.checked = true;
    localStorage.setItem('disp-ft-passenger', '1');
  }
  localStorage.setItem('disp-ft-cargo', ftCargoEl.checked ? '1' : '0');
});

const savedFtPassenger = localStorage.getItem('disp-ft-passenger');
const savedFtCargo     = localStorage.getItem('disp-ft-cargo');
if (savedFtPassenger !== null) ftPassengerEl.checked = savedFtPassenger === '1';
if (savedFtCargo     !== null) ftCargoEl.checked     = savedFtCargo     === '1';
if (!ftPassengerEl.checked && !ftCargoEl.checked) ftPassengerEl.checked = true;

persistRadioGroup('simulator',   'disp-simulator');
persistRadioGroup('airports',    'disp-airports');

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

declare global {
  interface Window {
    electronAPI?: {
      resizeToHeight(h: number): void;
      detectCommunityFolder(sim: string): Promise<string | null>;
      scanCommunityFolder(path: string): Promise<string[]>;
      openFolderDialog(): Promise<string | null>;
      savePln(content: string, filename: string): Promise<boolean | null>;
    }
  }
}

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
