import { loadAircraft } from './aircraft-db.js';
import { loadAirlines } from './airline-db.js';

// Warm the caches before the user clicks Generate
Promise.all([loadAircraft(), loadAirlines()]).catch(err => {
  console.error('Failed to preload app data:', err);
});

const viewMain = document.getElementById('view-main')!;
const viewAbout = document.getElementById('view-about')!;

document.getElementById('nav-about')!.addEventListener('click', () => {
  viewMain.classList.add('hidden');
  viewAbout.classList.remove('hidden');
});

document.getElementById('nav-back')!.addEventListener('click', () => {
  viewAbout.classList.add('hidden');
  viewMain.classList.remove('hidden');
});
