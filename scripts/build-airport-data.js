import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR  = path.join(__dirname, '..', 'data', 'raw');
const OUT_DIR  = path.join(__dirname, '..', 'data');

// ── Region prefix table ──────────────────────────────────────────────────────
// Edit here to reassign ICAO prefixes without touching pipeline logic
const PREFIX_REGION = {
  'B': 'europe',    // Iceland, Greenland
  'E': 'europe',    // Northern/Central Europe
  'L': 'europe',    // Southern Europe
  'U': 'europe',    // Russia, CIS
  'C': 'namerica',  // Canada
  'K': 'namerica',  // USA
  'M': 'namerica',  // Mexico, Central America
  'P': 'namerica',  // Alaska, Hawaii, N. Pacific
  'S': 'sam',       // South America
  'T': 'sam',       // Caribbean
  'D': 'africa',    // West Africa
  'F': 'africa',    // Central/East/Southern Africa
  'G': 'africa',    // West/Northwest Africa
  'H': 'africa',    // East/Northeast Africa
  'O': 'asia',      // Middle East, Pakistan
  'R': 'asia',      // Japan, South Korea
  'V': 'asia',      // South/SE Asia
  'W': 'asia',      // SE Asia
  'Z': 'asia',      // China
  'N': 'pacific',   // Pacific islands, New Zealand
  'Y': 'pacific',   // Australia
};

const KEEP_TYPES = new Set(['small_airport', 'medium_airport', 'large_airport']);

// Checked with startsWith on uppercased surface string — covers ASPH, ASPH-CONC,
// CONC/ASPH, etc. GRS (grass) intentionally omitted.
const HARD_SURFACE_PREFIXES = ['ASP', 'CON', 'BIT', 'BRI', 'MAC', 'HLA'];

const MIN_AIRPORT_COUNT = 200; // warn + exit non-zero if any region falls below this

// ── CSV parser ───────────────────────────────────────────────────────────────

export function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

async function readCSV(filePath) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  const rows = [];
  let headers = null;
  let malformed = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    if (!headers) { headers = fields.map(h => h.trim()); continue; }
    if (fields.length < headers.length) { malformed++; continue; }
    const row = {};
    headers.forEach((h, i) => { row[h] = fields[i].trim(); });
    rows.push(row);
  }
  if (malformed > 0) console.warn(`  ⚠ ${path.basename(filePath)}: skipped ${malformed} malformed row(s)`);
  return rows;
}

// ── Pure pipeline functions (exported for testing) ───────────────────────────

export function isHardSurface(surface) {
  const up = surface.toUpperCase();
  return HARD_SURFACE_PREFIXES.some(code => up.startsWith(code));
}

export function round4(n) {
  return parseFloat(n.toFixed(4));
}

export function buildRunwayMap(runwayRows) {
  const runwayMap = new Map();        // ident → max hard-surface length (m)
  const allRunwayAirports = new Set(); // all idents that appear in runways.csv

  for (const rwy of runwayRows) {
    allRunwayAirports.add(rwy.airport_ident);
    if (rwy.closed === '1') continue;
    if (!isHardSurface(rwy.surface)) continue;
    const lengthM = Math.round(parseFloat(rwy.length_ft) * 0.3048);
    if (!lengthM || lengthM <= 0) continue;
    const prev = runwayMap.get(rwy.airport_ident) ?? 0;
    if (lengthM > prev) runwayMap.set(rwy.airport_ident, lengthM);
  }

  return { runwayMap, allRunwayAirports };
}

export function processAirports(airportRows, { runwayMap, allRunwayAirports }) {
  const regions = {};
  const skipped = {
    noIcao:         0, // ident is not a 4-letter ICAO code (includes FAA/local codes)
    wrongType:      0, // heliport, seaplane base, closed, etc.
    unknownRegion:  0, // ICAO prefix not in PREFIX_REGION table
    noRunwayRecord: 0, // airport has no entry in runways.csv at all
    softRunwayOnly: 0, // airport appears in runways.csv but all runways are soft/closed
    badCoords:      0, // lat or lon is missing or non-numeric
  };

  for (const apt of airportRows) {
    const icao = apt.ident;

    // OurAirports includes FAA/local codes (e.g. "00AK", "1AZ2") — intentionally excluded.
    if (!/^[A-Z]{4}$/.test(icao))  { skipped.noIcao++;         continue; }
    if (!KEEP_TYPES.has(apt.type)) { skipped.wrongType++;       continue; }

    const region = PREFIX_REGION[icao[0]];
    if (!region)                    { skipped.unknownRegion++;   continue; }

    if (!runwayMap.has(icao)) {
      if (allRunwayAirports.has(icao)) skipped.softRunwayOnly++;
      else                             skipped.noRunwayRecord++;
      continue;
    }

    const lat = parseFloat(apt.latitude_deg);
    const lon = parseFloat(apt.longitude_deg);
    if (isNaN(lat) || isNaN(lon))  { skipped.badCoords++;       continue; }

    (regions[region] ??= []).push({
      icao,
      name:         apt.name,
      city:         apt.municipality,
      country:      apt.iso_country,
      lat:          round4(lat),
      lon:          round4(lon),
      max_runway_m: runwayMap.get(icao),
      scheduled:    apt.scheduled_service === 'yes',
    });
  }

  return { regions, skipped };
}

// ── Main (file I/O) ──────────────────────────────────────────────────────────

async function main() {
  const airportsFile = path.join(RAW_DIR, 'airports.csv');
  const runwaysFile  = path.join(RAW_DIR, 'runways.csv');

  if (!fs.existsSync(airportsFile) || !fs.existsSync(runwaysFile)) {
    console.error(
      'Missing source files.\n' +
      'Download airports.csv and runways.csv from https://ourairports.com/data/\n' +
      'and place them in data/raw/'
    );
    process.exit(1);
  }

  console.log('Reading runways.csv…');
  const { runwayMap, allRunwayAirports } = buildRunwayMap(await readCSV(runwaysFile));

  console.log('Reading airports.csv…');
  const { regions, skipped } = processAirports(await readCSV(airportsFile), { runwayMap, allRunwayAirports });

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n── Build complete ──────────────────');
  let total = 0;
  let lowCount = false;
  for (const [region, airports] of Object.entries(regions)) {
    if (airports.length === 0) {
      console.warn(`  ⚠ ${region}: no airports — skipping file`);
      lowCount = true;
      continue;
    }
    fs.writeFileSync(path.join(OUT_DIR, `airports-${region}.json`), JSON.stringify(airports));
    const warn = airports.length < MIN_AIRPORT_COUNT ? ' ⚠ LOW COUNT' : '';
    if (airports.length < MIN_AIRPORT_COUNT) lowCount = true;
    console.log(`  ${region.padEnd(14)} ${airports.length.toLocaleString().padStart(5)} airports${warn}`);
    total += airports.length;
  }
  console.log(`  ${'total'.padEnd(14)} ${total.toLocaleString().padStart(5)} airports`);

  console.log('\n── Skipped ─────────────────────────');
  for (const [reason, count] of Object.entries(skipped)) {
    console.log(`  ${reason.padEnd(16)} ${count.toLocaleString()}`);
  }

  if (lowCount) {
    console.error('\nBuild failed: one or more regions below MIN_AIRPORT_COUNT threshold.');
    process.exit(1);
  }
}

// Guard so main() doesn't run when this file is imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(err); process.exit(1); });
}
