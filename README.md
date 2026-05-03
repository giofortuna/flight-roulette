# Flight Roulette — Random Flight Generator

A random flight assignment tool for flight simulator pilots. Pick your simulator, press Generate, and get a realistic route dispatched directly to SimBrief.

**[Live app](https://giofortuna.github.io/flight-roulette/)** · [Releases](https://github.com/giofortuna/flight-roulette/releases) · [SimBrief](https://www.simbrief.com) · [OurAirports](https://ourairports.com)

---

## What it does

Selects an airline, aircraft, departure airport, and destination constrained by real aircraft performance data, then opens SimBrief with a pre-filled dispatch. Destination is chosen within 80% of the aircraft's published range to ensure SimBrief can always plan fuel successfully.

Once a flight is generated, each element can be individually re-rolled without regenerating the whole flight:
- **Re-roll airline** — pick a different airline for the same route
- **Re-roll departure** — find a new departure airport that can still reach the same destination
- **Re-roll destination** — find a new destination reachable from the same departure
- **Re-roll aircraft** — swap to a different aircraft that fits the same route

## Options

- **Airports** — *Scheduled* (default) restricts to airports with active scheduled airline service; *All* opens the full ICAO database including military and GA fields
- **Block time** — filter routes by minimum and/or maximum flight duration in hours
- **Departure region** — restrict departure airports to a specific world region
- **Departure time** — *Now +45 min* (default) sets STD to 45 minutes from the current time; *Time period* lets you pick morning / afternoon / evening / night

## Supported simulators

| Simulator | Status |
|---|---|
| MSFS 2020 | Live |
| MSFS 2024 | Live |
| X-Plane 12 | Coming soon |

## Supported flight types

| Type | Status |
|---|---|
| Passenger | Live |
| Cargo | Coming soon |

## Supported aircraft

29 aircraft across turboprop, narrowbody, and widebody categories from add-on publishers including PMDG, Fenix, FlyByWire, iniBuilds, Headwind, and others. Full list: [`data/aircraft.json`](data/aircraft.json).

## Desktop app

Download the latest Windows installer or portable `.exe` from [Releases](https://github.com/giofortuna/flight-roulette/releases). The app runs fully offline — no internet connection required except to open SimBrief dispatch.

## Development

```bash
npm install
npm run build          # tsc → dist/
npm test               # tsx --test (runs all src/*.test.ts and scripts/*.test.js)
npm run dev            # serve . (local static server)
npm run electron:dev   # build + launch Electron window
npm run electron:build # build + package installer/portable via electron-builder
```

### Airport data

The regional JSON files (`data/airports-*.json`) are committed and ready to use. To rebuild them from source:

1. Download `airports.csv` and `runways.csv` from [OurAirports](https://ourairports.com/data/) and place them in `data/raw/` (git-ignored)
2. Run `node scripts/build-airport-data.js`

The build script filters to airports with hard-surface runways. Each record includes a `scheduled` boolean derived from OurAirports' `scheduled_service` field, which powers the Scheduled/All toggle at runtime.

### Airline data

The airline database (`data/airlines.json`) is committed. To rebuild it from source:

1. Download `airlines.dat` from [OpenFlights](https://openflights.org/data.html) and place it in `data/raw/` (git-ignored)
2. Run `node scripts/build-airline-data.js`

## Data sources

- **Airport data** — [OurAirports](https://ourairports.com) (public domain)
- **Airline data** — [OpenFlights](https://openflights.org/data.html) (Open Database License)
- **Flight planning** — [SimBrief](https://www.simbrief.com)
