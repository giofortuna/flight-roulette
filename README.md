# Flight Roulette — Random Flight Generator

A random flight assignment tool for flight simulator pilots. Pick your simulator, press Generate, and get a realistic route dispatched directly to SimBrief.

**[Live app](#)** · [SimBrief](https://www.simbrief.com) · [OurAirports](https://ourairports.com)

---

## What it does

Selects an airline, aircraft, departure airport, and destination constrained by real aircraft performance data, then opens SimBrief with a pre-filled dispatch. Destination is chosen within 80% of the aircraft's published range to ensure SimBrief can always plan fuel successfully.

**Options** (collapsed by default):
- **Payload** — randomly generate passenger and cargo loads passed to SimBrief, or let SimBrief calculate its own
- **Airports** — *Commercial* (default) restricts to airports with active scheduled airline service; *All* opens the full ICAO database including military and GA fields

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

## Supported aircraft (v1)

| Type | Airframe | Simulators |
|---|---|---|
| Boeing 737-800 | PMDG 737-800 | MSFS 2020 / 2024 |
| Airbus A320-200 | Fenix A320 Sharklet CFM | MSFS 2020 / 2024 |

## Development

```bash
npm install
npm run build   # tsc → dist/
npm test        # tsx --test (runs all src/*.test.ts and scripts/*.test.js)
npm run dev     # serve . (local static server)
```

### Airport data

The regional JSON files (`data/airports-*.json`) are committed and ready to use. To rebuild them from source:

1. Download `airports.csv` and `runways.csv` from [OurAirports](https://ourairports.com/data/) and place them in `data/raw/` (git-ignored)
2. Run `node scripts/build-airport-data.js`

The build script filters to airports with hard-surface runways. Each record includes a `scheduled` boolean derived from OurAirports' `scheduled_service` field, which powers the Commercial/All toggle at runtime.

## Data sources

- **Airport & airline data** — [OurAirports](https://ourairports.com) (public domain)
- **Flight planning** — [SimBrief](https://www.simbrief.com)
