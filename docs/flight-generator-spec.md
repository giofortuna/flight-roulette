# Flight Generator — Project Specification

> Last updated: April 2026
> Status: Pre-development / Design phase — FINAL

---

## 1. Overview

A pure client-side web application that generates random flights for flight simulator enthusiasts. The app picks a flight type, airline, aircraft, departure airport, and a valid destination airport based on aircraft performance constraints, then dispatches the flight to SimBrief.

No backend. No server. No authentication.

---

## 2. Supported Simulators

| Simulator | v1 Support |
|---|---|
| Microsoft Flight Simulator 2020 | ✅ |
| Microsoft Flight Simulator 2024 | ✅ |
| X-Plane 12 | ✅ scaffold only — no aircraft at launch |
| Others (P3D, FS2004, etc.) | 🔜 Possible future addition |

Simulator selection filters the aircraft list. If no aircraft are available for the selected simulator, the app shows a "coming soon" state rather than failing silently.

---

## 3. UI — Settings Panel

Settings appear above the generate button. All controls are segmented toggles for consistency.

```
┌─────────────────────────────────────┐
│ Flight Type  [ Passenger | Cargo  ] │
│ Simulator    [ MSFS 2020 | MSFS 24] │
│ Payload      [ Random  | SimBrief ] │
│                                     │
│            ▶ GENERATE               │
└─────────────────────────────────────┘
```

### Flight Type
- **Passenger** — filters aircraft and airlines to passenger operators
- **Cargo** — filters aircraft and airlines to freighter operators
- Cargo selected in v1 shows an empty state ("no cargo aircraft available yet")

### Simulator
- Filters the aircraft list to aircraft available for that simulator

### Payload
- **Random Payload** — app generates pax + cargo, passes them to SimBrief URL
- **SimBrief Payload** — app passes no payload parameters, SimBrief uses its own defaults

---

## 4. Core Generation Flow

```
User sets: flight type + simulator + payload option
        │
        ▼
Step 1: Pick airline randomly (filtered by flight type)
        │
        ▼
Step 2: Pick aircraft randomly (filtered by flight type + simulator)
        │
        ▼
Step 3: Pick departure airport randomly
        │  filtered by: runway length ≥ aircraft min_runway_m
        ▼
Step 4: Pick destination airport randomly
        │  filtered by: distance ≤ aircraft range_nm
        │               runway length ≥ aircraft min_runway_m
        │               not same as departure
        ▼
Step 5: Generate payload (if Random Payload selected)
        │
        ▼
Step 6: Render flight card + Dispatch to SimBrief button
```

### Retry Logic

```
pick airline + aircraft
  └─► pick departure
        └─► filter destination candidates
              ├─ candidates found → pick destination → done ✅
              └─ no candidates → retry departure (max 10 attempts)
                    └─ still failing → relax range constraint by 20% → retry
```

---

## 5. Aircraft Database (v1)

Two passenger aircraft at launch. Both MSFS-only. No cargo aircraft in v1.

### Aircraft Schema

```js
{
  icao_type:            "B738",
  type_name:            "Boeing 737-800",
  airframe_name:        "PMDG 737-800",       // display name on flight card
  flight_type:          "passenger",           // passenger | cargo
  simulator:            ["msfs2020", "msfs2024"],
  range_nm:             2935,
  min_runway_m:         1800,
  cruise_ft:            35000,
  cruise_kts:           453,
  category:             "narrowbody",
  max_pax:              162,
  max_cargo_kg:         9000,
  simbrief_type:        "B738",
  simbrief_airframe_id: ""                     // TBD — see section 15
}
```

### PMDG Boeing 737-800

| Field | Value |
|---|---|
| `icao_type` | B738 |
| `type_name` | Boeing 737-800 |
| `airframe_name` | PMDG 737-800 |
| `flight_type` | passenger |
| `simulator` | msfs2020, msfs2024 |
| `range_nm` | 2935 |
| `min_runway_m` | 1800 |
| `cruise_ft` | 35000 |
| `cruise_kts` | 453 |
| `category` | narrowbody |
| `max_pax` | 162 |
| `max_cargo_kg` | 9000 |
| `simbrief_type` | B738 |
| `simbrief_airframe_id` | TBD |

### Fenix Airbus A320

| Field | Value |
|---|---|
| `icao_type` | A320 |
| `type_name` | Airbus A320-200 |
| `airframe_name` | Fenix A320 Sharklet CFM |
| `flight_type` | passenger |
| `simulator` | msfs2020, msfs2024 |
| `range_nm` | 3300 |
| `min_runway_m` | 1800 |
| `cruise_ft` | 35000 |
| `cruise_kts` | 447 |
| `category` | narrowbody |
| `max_pax` | 150 |
| `max_cargo_kg` | 7500 |
| `simbrief_type` | A320 |
| `simbrief_airframe_id` | TBD |

> ⚠️ `max_cargo_kg` values are estimates — verify against official aircraft documentation before hardcoding.

### Card Display

```
Aircraft
Boeing 737-800       ← type_name
PMDG 737-800         ← airframe_name
```

### Future Aircraft

Multiple airframes can share the same `icao_type` — e.g. a future FlyByWire A320 would share `icao_type: A320` and `simbrief_type: A320` but have its own `airframe_name` and `simbrief_airframe_id`.

---

## 6. Airline Database

### Scope

~300–400 airlines covering all ICAO regions. Scheduled operators only — no defunct or charter-only carriers.

### Data Per Airline

```js
{
  icao:        "BAW",
  iata:        "BA",
  name:        "British Airways",
  callsign:    "SPEEDBIRD",
  country:     "GB",
  region:      "europe",
  hub:         ["EGLL", "EGKK"],
  type:        "passenger",   // passenger | cargo | both
  simbrief_id: "BAW",
  fleet:       []             // empty in Phase 1, populated in Phase 2
}
```

### Regional Breakdown (approximate)

| Region | Airlines |
|---|---|
| Europe | ~120 |
| North America | ~60 |
| Asia-Pacific | ~70 |
| Middle East | ~25 |
| Africa | ~30 |
| South America | ~30 |
| Caribbean / Central America | ~15 |

### Source

OurAirports `airlines.csv` — consistent with the airport data pipeline.

### Phase 2 — Fleet Constraints

In Phase 2, airline constrains the aircraft list. The schema is already ready — Phase 2 is purely a data fill-in, no structural changes needed:

```js
// Phase 1 — unconstrained
const aircraft = pickRandom(allAircraft);

// Phase 2 — airline constrains aircraft pool
const aircraft = pickRandom(airline.fleet.map(id => aircraftDB[id]));
```

`hub` is captured now for a future soft bias — departures weighted toward an airline's hub airports.

---

## 7. Airport Database

### Source

**OurAirports** — free, public domain dataset
- `airports.csv` — ICAO, name, coordinates, type, elevation
- `runways.csv` — runway lengths per airport
- `airlines.csv` — airline data

Runway data is joined into airport records at build time.

### Processing Pipeline

A one-time build script (`scripts/build-airport-data.js`) converts raw CSVs into compressed, region-split JSON. Raw CSVs are git-ignored. Output JSON is committed.

**Filters applied at build time:**
- Exclude: heliports, seaplane bases, closed airports, balloonports
- Keep: small, medium, and large airports with at least one hard-surface runway

### Runtime Loading

Lazy-loaded by region — only the relevant chunk is fetched when a flight is generated.

| File | Region |
|---|---|
| `airports-europe.json` | Europe |
| `airports-namerica.json` | North America |
| `airports-asia.json` | Asia-Pacific |
| `airports-africa.json` | Africa |
| `airports-pacific.json` | Oceania / Pacific |
| `airports-sam.json` | South America |

**Estimated file sizes:** ~200–400 KB per chunk (gzip-compressed by GitHub Pages).

---

## 8. Payload Generation

### Passenger Flights

| Parameter | Logic |
|---|---|
| `pax` | Random load factor (45–95%) × `max_pax`, rounded to whole number |
| `cargo_kg` | Random value between 0 and `max_cargo_kg` |

### Cargo Flights

| Parameter | Logic |
|---|---|
| `pax` | Not generated — hidden from flight card |
| `cargo_kg` | Random value between 0 and `max_cargo_kg` |

### Fuel

Always delegated to SimBrief — never generated in-app.

---

## 9. Flight Card

Shown after generation. SimBrief is the only primary action.

### Fields

| Field | Passenger | Cargo |
|---|---|---|
| Airline name | ✅ | ✅ |
| Flight number | ✅ | ✅ |
| Simulator badge | ✅ | ✅ |
| Origin ICAO + airport name + city | ✅ | ✅ |
| Destination ICAO + airport name + city | ✅ | ✅ |
| Distance (nm) | ✅ | ✅ |
| Block time estimate | ✅ | ✅ |
| Aircraft `type_name` | ✅ | ✅ |
| Aircraft `airframe_name` | ✅ | ✅ |
| Pax count + max pax | ✅ | ❌ |
| Cargo weight + max cargo | ✅ | ✅ |
| Fuel note ("Calculated by SimBrief") | ✅ | ✅ |
| Dispatch to SimBrief button | ✅ | ✅ |

### Layout

```
┌──────────────────────────────────────┐
│ British Airways · BAW442   MSFS 2024 │  ← header
├──────────────────────────────────────┤
│  EGLL              ✈        OMDB     │
│  Heathrow     1,234 nm    Dubai Intl │  ← route
│  London UK    04+22 BLK   Dubai UAE  │
├──────────────────────────────────────┤
│ Aircraft          │ Passengers        │
│ Boeing 737-800    │ 138 / 162        │  ← details grid
│ PMDG 737-800      ├──────────────────│
│                   │ Cargo            │
│                   │ 4,280 / 9,000 kg │
├──────────────────────────────────────┤
│ Fuel: Calculated by SimBrief         │
│                  [ Dispatch → ]      │  ← footer
└──────────────────────────────────────┘
```

---

## 10. SimBrief Integration

### How SimBrief Identifies Aircraft

SimBrief uses two levels of identification:

- **Type** (`simbrief_type`) — the ICAO aircraft type code, selects the base performance profile. 193 types available.
- **Airframe** (`simbrief_airframe_id`) — a specific saved configuration within a type (custom weights, pax count, fuel flow, OEW). Curated airframes are published by developers and the community.

### URL Structure

```
https://www.simbrief.com/system/dispatch.php
  ?orig=        {departure_icao}
  &dest=        {destination_icao}
  &type=        {simbrief_type}
  &airline=     {airline.simbrief_id}
  &fltnum=      {flight_number}
  &pax=         {pax_count}             ← omitted if SimBrief Payload selected
  &cargo=       {cargo_kg}              ← omitted if SimBrief Payload selected
  &fl=          {cruise_ft / 100}
  &route=       AUTO
  &units=       KGS
```

Opens in a new tab. User presses "Generate OFP" in SimBrief themselves.

> ⚠️ SimBrief URL parameters for `pax` and `cargo` are undocumented — validate with a real account before building the module.  
> ⚠️ `simbrief_airframe_id` values for both aircraft are TBD — locate curated airframe IDs before building the module.

---

## 11. Module Structure

```
/
├── .github/
│   └── workflows/
│       └── deploy.yml             ← GitHub Actions static deploy
├── data/
│   ├── raw/                       ← OurAirports CSVs (git-ignored)
│   ├── airports-europe.json
│   ├── airports-namerica.json
│   ├── airports-asia.json
│   ├── airports-africa.json
│   ├── airports-pacific.json
│   └── airports-sam.json
├── scripts/
│   └── build-airport-data.js      ← one-time CSV → JSON pipeline
├── js/
│   ├── main.js                    ← app entry, wires modules together
│   ├── airline-db.js              ← comprehensive airline list
│   ├── aircraft-db.js             ← curated aircraft data
│   ├── airport-db.js              ← lazy loader, filter, search
│   ├── route-selector.js          ← constraint-based pairing + retry logic
│   ├── flight-planner.js          ← block time, cruise FL
│   ├── payload-gen.js             ← pax + cargo, passenger vs cargo aware
│   ├── simbrief.js                ← URL builder
│   └── renderer.js                ← flight card DOM rendering
├── css/
│   └── style.css
└── index.html
```

---

## 12. Hosting & Deployment

| Property | Value |
|---|---|
| Host | GitHub Pages |
| URL | `{username}.github.io/flight-generator` |
| Custom domain | No (v1) |
| CI/CD | GitHub Actions on push to `main` |
| Distribution | FlightSim.to (link to GH Pages URL) |

---

## 13. Out of Scope (v1)

- Live weather / METAR API
- Fuel generation in-app
- `.pln` / `.fms` flight plan file export
- Direct simulator integration
- User accounts or persistent history
- Cargo aircraft (scaffold exists, no aircraft yet)
- X-Plane 12 aircraft (scaffold exists, no aircraft yet)
- P3D / FS2004 / other simulators
- Custom domain
- Phase 2 airline → aircraft fleet constraints
- Hub-biased departure airport selection

---

## 14. Planned Build Order

1. `build-airport-data.js` — data pipeline (OurAirports CSV → regional JSON)
2. `aircraft-db.js` — static aircraft data (2 aircraft)
3. `airline-db.js` — comprehensive airline list (~300–400 entries)
4. `airport-db.js` — lazy loader + runway filtering
5. `route-selector.js` — constraint logic (range + runway + retry)
6. `payload-gen.js` — pax + cargo, passenger vs cargo aware
7. `simbrief.js` — URL builder (pending verifications in section 15)
8. `flight-planner.js` — block time + cruise FL
9. `renderer.js` + UI — wire to visual design

---

## 15. Known Unknowns — Pre-build Verification Required

| Item | Action needed |
|---|---|
| SimBrief `pax` and `cargo` URL parameters | Test with real SimBrief account before building `simbrief.js` |
| `max_cargo_kg` for both aircraft | Verify against official aircraft documentation |
| PMDG 737-800 `simbrief_airframe_id` | Locate curated airframe ID published by PMDG or community |
| Fenix A320 `simbrief_airframe_id` | Locate curated airframe ID published by Fenix or community |
