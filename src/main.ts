import type { FlightType, Simulator } from './types.js';
import { loadAircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';
import { selectRoute, NoRouteError } from './route-selector.js';
import { planFlight } from './flight-planner.js';
import { generatePayload } from './payload-gen.js';
import { buildSimbriefUrl } from './simbrief.js';
import { renderFlight, renderEmpty, renderLoading } from './renderer.js';

// Warm the caches before the user clicks Generate
Promise.all([loadAircraft(), loadAirlines()]).catch(err => {
  console.error('Failed to preload app data:', err);
});

function getSettings(): { flightType: FlightType; simulator: Simulator; useRandomPayload: boolean; scheduledOnly: boolean } {
  const flightType = (document.querySelector('input[name="flight-type"]:checked') as HTMLInputElement).value as FlightType;
  const simulator  = (document.querySelector('input[name="simulator"]:checked')  as HTMLInputElement).value as Simulator;
  const useRandomPayload = (document.querySelector('input[name="payload"]:checked') as HTMLInputElement).value === 'random';
  const scheduledOnly    = (document.querySelector('input[name="airports"]:checked') as HTMLInputElement).value === 'scheduled';
  return { flightType, simulator, useRandomPayload, scheduledOnly };
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
      const route = await selectRoute({ flightType: settings.flightType, simulator: settings.simulator, scheduledOnly: settings.scheduledOnly });
      const plan    = planFlight(route.airline, route.aircraft, route.distanceNm);
      const payload = generatePayload(route.aircraft, settings.flightType);
      const simbriefUrl = buildSimbriefUrl(route, plan, payload, { useRandomPayload: settings.useRandomPayload });
      renderFlight({ route, plan, payload, simbriefUrl, simulator: settings.simulator });
    } catch (err) {
      if (err instanceof NoRouteError) {
        renderEmpty('Could not generate a route. Please try again.');
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

renderEmpty();

document.getElementById('btn-generate')!.addEventListener('click', generate);
document.getElementById('btn-regen')!.addEventListener('click', generate);

const viewMain  = document.getElementById('view-main')!;
const viewAbout = document.getElementById('view-about')!;

document.getElementById('nav-about')!.addEventListener('click', () => {
  viewMain.classList.add('hidden');
  viewAbout.classList.remove('hidden');
});

document.getElementById('nav-back')!.addEventListener('click', () => {
  viewAbout.classList.add('hidden');
  viewMain.classList.remove('hidden');
});
