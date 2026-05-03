# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # tsc — compiles src/ → dist/
npm test               # tsx --test (runs all src/*.test.ts and scripts/*.test.js)
npm run dev            # serve . (local static server)
npm run electron:dev   # build + launch Electron window
npm run electron:build # build + package installer via electron-builder → release/

node scripts/build-airport-data.js   # one-time: converts data/raw/*.csv → data/airports-{region}.json
node scripts/build-airline-data.js   # one-time: converts data/raw/airlines.dat → data/airlines.json
node scripts/build-country-names.js  # one-time: converts data/raw/countries.csv → src/country-names.ts
```

No linter is configured. TypeScript strict mode is the primary correctness gate.

## Architecture

**Flight Roulette** is a pure client-side random flight generator for flight simulator pilots. No backend, no auth. Runs as a GitHub Pages web app and as an Electron desktop app.

### How a flight is generated

```
Settings (flight type + simulator + filters)
  → route-selector.ts   picks airline → aircraft → departure → destination
  → flight-planner.ts   computes block time + flight number + STD
  → simbrief.ts         builds SimBrief dispatch URL
  → renderer.ts         populates flight card DOM
  → main.ts             orchestrates all of the above, owns UI state
```

### Key constraints enforced at route selection time

- Destination distance ≤ `aircraft.range_nm` (relaxed by 20% after 10 failed attempts)
- Both airports: `max_runway_m ≥ aircraft.min_runway_m`
- Aircraft filtered by `simulator` setting
- Airline filtered by `flightType` setting
- Optional filters: `minBlockH`, `maxBlockH`, `departureRegion`

### Electron app

Entry point: `electron/main.cjs` + `electron/preload.cjs`. The app uses a custom `app://` protocol (registered as privileged before `app.whenReady`) to serve local files, which allows `fetch()` to work in the renderer. The preload exposes `window.electronAPI.resizeToHeight(h)` via `contextBridge`; `src/main.ts` uses a `ResizeObserver` to keep the window sized to content.

### Font bundling

Fonts are bundled locally in `fonts/` (woff2) and declared in `css/fonts.css`. License: `fonts/OFL.txt` (SIL OFL 1.1). Do not add CDN font links — the Electron app must work offline.

### Airport data

Regional JSON files (`data/airports-{region}.json`) are produced by `scripts/build-airport-data.js` from OurAirports CSVs placed in `data/raw/` (git-ignored). The output JSON is committed. At runtime, `airport-db.ts` lazy-loads only the needed region chunk and caches it in memory.

### Airline data

`data/airlines.json` (~1,072 entries) is produced by `scripts/build-airline-data.js` from the OpenFlights `airlines.dat` file placed in `data/raw/` (git-ignored). The output JSON is committed.

### TypeScript / build notes

- Source: `src/` — browser ES modules; `moduleResolution: "bundler"`, `module: "ES2020"`, `target: "ES2020"`
- Output: `dist/` — served by GitHub Pages and bundled into the Electron app
- **All relative imports between `src/` modules must use `.js` extensions** (e.g. `import { airlines } from './airline-db.js'`). TypeScript resolves to the `.ts` source; the browser needs `.js` at runtime. `bundler` resolution does not add extensions automatically.
- Build scripts (`scripts/`) are plain Node.js — run directly with `node`, not `tsc`

### Data files

- `data/aircraft.json` — 29 aircraft; `simbrief_airframe_id` is `""` on all entries pending verification
- `data/airlines.json` — 1,072 airlines sourced from OpenFlights; `fleet: []` on all (not yet wired)
- `data/airports-{region}.json` — built from OurAirports; schema: `{ icao, name, city, country, lat, lon, max_runway_m, scheduled }`

### Known unknowns (do not work around silently)

- `simbrief_airframe_id` for all aircraft is `""` — leave as-is until sourced per aircraft
