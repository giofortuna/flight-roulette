# DISPATCH — Random Flight Generator

A random flight assignment tool for flight simulator pilots. Pick your simulator, press Generate, and get a realistic route dispatched directly to SimBrief.

**[Live app](#)** · [SimBrief](https://www.simbrief.com) · [OurAirports](https://ourairports.com)

---

## What it does

Selects an airline, aircraft, departure airport, and destination constrained by real aircraft performance data (range, minimum runway length), then opens SimBrief with a pre-filled dispatch.

## Supported simulators

| Simulator | Status |
|---|---|
| MSFS 2020 | Live |
| MSFS 2024 | Live |
| X-Plane 12 | Coming soon |

## Supported aircraft (v1)

| Type | Airframe |
|---|---|
| Boeing 737-800 | PMDG 737-800 |
| Airbus A320-200 | Fenix A320 Sharklet CFM |

## Development

```bash
npm install
npm run build        # tsc → dist/

# One-time airport data build (requires OurAirports CSVs in data/raw/)
node scripts/build-airport-data.js
```

Airport data (`data/raw/`) is git-ignored. Download `airports.csv` and `runways.csv` from [OurAirports](https://ourairports.com/data/) and run the build script to regenerate the regional JSON files.

## Data sources

- **Airport & airline data** — [OurAirports](https://ourairports.com) (public domain)
- **Flight planning** — [SimBrief](https://www.simbrief.com)
