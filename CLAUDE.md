# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # tsc — compiles src/ → dist/
node scripts/build-airport-data.js   # one-time: converts data/raw/*.csv → data/airports-{region}.json
node scripts/build-country-names.js  # one-time: converts data/raw/countries.csv → src/country-names.ts
```

No test runner or linter is configured yet. TypeScript strict mode is the primary correctness gate.

## Architecture

**Flight Roulette** is a pure client-side random flight generator for flight simulator pilots. No backend, no auth. Hosted on GitHub Pages.

### How a flight is generated

```
Settings (flight type + simulator + payload mode)
  → route-selector.ts   picks airline → aircraft → departure → destination
  → flight-planner.ts   computes block time + flight number
  → payload-gen.ts      generates pax/cargo counts
  → simbrief.ts         builds SimBrief dispatch URL
  → renderer.ts         populates flight card DOM
  → main.ts             orchestrates all of the above, owns UI state
```

### Key constraints enforced at route selection time

- Destination distance ≤ `aircraft.range_nm` (relaxed by 20% after 10 failed attempts)
- Both airports: `max_runway_m ≥ aircraft.min_runway_m`
- Aircraft filtered by `simulator` setting
- Airline filtered by `flightType` setting

### Airport data

Regional JSON files (`data/airports-{region}.json`) are produced by `scripts/build-airport-data.js` from OurAirports CSVs placed in `data/raw/` (git-ignored). The output JSON is committed. At runtime, `airport-db.ts` lazy-loads only the needed region chunk and caches it in memory.

### TypeScript / build notes

- Source: `src/` — browser ES modules; `moduleResolution: "bundler"`, `module: "ES2020"`, `target: "ES2020"`
- Output: `dist/` — served by GitHub Pages
- **All relative imports between `src/` modules must use `.js` extensions** (e.g. `import { airlines } from './airline-db.js'`). TypeScript resolves to the `.ts` source; the browser needs `.js` at runtime. `bundler` resolution does not add extensions automatically.
- The build script (`scripts/build-airport-data.js`) is plain Node.js, not TypeScript — runs directly with `node`, not `tsc`

### Data files

- `src/aircraft-db.ts` — 2 aircraft (PMDG 737-800, Fenix A320); `simbrief_airframe_id` is `""` pending verification
- `src/airline-db.ts` — ~300–400 airlines; `fleet: []` on all (Phase 2 constraint, not yet wired)
- `data/airports-{region}.json` — built from OurAirports; schema: `{ icao, name, city, country, lat, lon, max_runway_m }`

### Known unknowns (do not work around silently)

- SimBrief `pax` and `cargo` URL parameters are undocumented — mark with `// TODO: verify` in `simbrief.ts`
- `simbrief_airframe_id` for both aircraft is TBD — leave as `""` until sourced
