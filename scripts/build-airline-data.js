import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR  = path.join(__dirname, '..', 'data', 'raw');
const OUT_FILE = path.join(__dirname, '..', 'data', 'airlines.json');

// ── Country → region ─────────────────────────────────────────────────────────
// Keyed by both ISO-2 code and English country name (OurAirports/OpenFlights
// uses country names; some exports use ISO codes — we handle both).
const COUNTRY_REGION = {
  // ── Europe ──
  'Albania': 'europe', 'AL': 'europe',
  'Andorra': 'europe', 'AD': 'europe',
  'Armenia': 'europe', 'AM': 'europe',
  'Austria': 'europe', 'AT': 'europe',
  'Azerbaijan': 'europe', 'AZ': 'europe',
  'Belarus': 'europe', 'BY': 'europe',
  'Belgium': 'europe', 'BE': 'europe',
  'Bosnia and Herzegovina': 'europe', 'BA': 'europe',
  'Bulgaria': 'europe', 'BG': 'europe',
  'Croatia': 'europe', 'HR': 'europe',
  'Cyprus': 'europe', 'CY': 'europe',
  'Czech Republic': 'europe', 'Czechia': 'europe', 'CZ': 'europe',
  'Denmark': 'europe', 'DK': 'europe',
  'Estonia': 'europe', 'EE': 'europe',
  'Faroe Islands': 'europe', 'FO': 'europe',
  'Finland': 'europe', 'FI': 'europe',
  'France': 'europe', 'FR': 'europe',
  'Georgia': 'europe', 'GE': 'europe',
  'Germany': 'europe', 'DE': 'europe',
  'Gibraltar': 'europe', 'GI': 'europe',
  'Greece': 'europe', 'GR': 'europe',
  'Greenland': 'europe', 'GL': 'europe',
  'Guernsey': 'europe', 'GG': 'europe',
  'Hungary': 'europe', 'HU': 'europe',
  'Iceland': 'europe', 'IS': 'europe',
  'Ireland': 'europe', 'IE': 'europe',
  'Isle of Man': 'europe', 'IM': 'europe',
  'Italy': 'europe', 'IT': 'europe',
  'Jersey': 'europe', 'JE': 'europe',
  'Kosovo': 'europe', 'XK': 'europe',
  'Latvia': 'europe', 'LV': 'europe',
  'Liechtenstein': 'europe', 'LI': 'europe',
  'Lithuania': 'europe', 'LT': 'europe',
  'Luxembourg': 'europe', 'LU': 'europe',
  'Malta': 'europe', 'MT': 'europe',
  'Moldova': 'europe', 'MD': 'europe',
  'Monaco': 'europe', 'MC': 'europe',
  'Montenegro': 'europe', 'ME': 'europe',
  'Netherlands': 'europe', 'NL': 'europe',
  'North Macedonia': 'europe', 'Macedonia': 'europe', 'MK': 'europe',
  'Norway': 'europe', 'NO': 'europe',
  'Poland': 'europe', 'PL': 'europe',
  'Portugal': 'europe', 'PT': 'europe',
  'Romania': 'europe', 'RO': 'europe',
  'Russia': 'europe', 'Russian Federation': 'europe', 'RU': 'europe',
  'San Marino': 'europe', 'SM': 'europe',
  'Serbia': 'europe', 'RS': 'europe',
  'Slovakia': 'europe', 'SK': 'europe',
  'Slovenia': 'europe', 'SI': 'europe',
  'Spain': 'europe', 'ES': 'europe',
  'Svalbard and Jan Mayen': 'europe', 'SJ': 'europe',
  'Sweden': 'europe', 'SE': 'europe',
  'Switzerland': 'europe', 'CH': 'europe',
  'Turkey': 'europe', 'TR': 'europe',
  'Ukraine': 'europe', 'UA': 'europe',
  'United Kingdom': 'europe', 'GB': 'europe',
  'Vatican City': 'europe', 'VA': 'europe',

  // ── North America ──
  'Canada': 'namerica', 'CA': 'namerica',
  'Mexico': 'namerica', 'MX': 'namerica',
  'United States': 'namerica', 'US': 'namerica',

  // ── Caribbean / Central America ──
  'Anguilla': 'caribbean', 'AI': 'caribbean',
  'Antigua and Barbuda': 'caribbean', 'AG': 'caribbean',
  'Aruba': 'caribbean', 'AW': 'caribbean',
  'Bahamas': 'caribbean', 'BS': 'caribbean',
  'Barbados': 'caribbean', 'BB': 'caribbean',
  'Belize': 'caribbean', 'BZ': 'caribbean',
  'Bonaire, Saint Eustatius and Saba': 'caribbean', 'BQ': 'caribbean',
  'Cayman Islands': 'caribbean', 'KY': 'caribbean',
  'Costa Rica': 'caribbean', 'CR': 'caribbean',
  'Cuba': 'caribbean', 'CU': 'caribbean',
  'Curacao': 'caribbean', 'CW': 'caribbean',
  'Dominica': 'caribbean', 'DM': 'caribbean',
  'Dominican Republic': 'caribbean', 'DO': 'caribbean',
  'El Salvador': 'caribbean', 'SV': 'caribbean',
  'Grenada': 'caribbean', 'GD': 'caribbean',
  'Guadeloupe': 'caribbean', 'GP': 'caribbean',
  'Guatemala': 'caribbean', 'GT': 'caribbean',
  'Haiti': 'caribbean', 'HT': 'caribbean',
  'Honduras': 'caribbean', 'HN': 'caribbean',
  'Jamaica': 'caribbean', 'JM': 'caribbean',
  'Martinique': 'caribbean', 'MQ': 'caribbean',
  'Montserrat': 'caribbean', 'MS': 'caribbean',
  'Nicaragua': 'caribbean', 'NI': 'caribbean',
  'Panama': 'caribbean', 'PA': 'caribbean',
  'Puerto Rico': 'caribbean', 'PR': 'caribbean',
  'Saint Barthelemy': 'caribbean', 'BL': 'caribbean',
  'Saint Kitts and Nevis': 'caribbean', 'KN': 'caribbean',
  'Saint Lucia': 'caribbean', 'LC': 'caribbean',
  'Saint Martin': 'caribbean', 'MF': 'caribbean',
  'Saint Vincent and the Grenadines': 'caribbean', 'VC': 'caribbean',
  'Sint Maarten': 'caribbean', 'SX': 'caribbean',
  'Netherlands Antilles': 'caribbean',
  'Trinidad and Tobago': 'caribbean', 'TT': 'caribbean',
  'Turks and Caicos Islands': 'caribbean', 'TC': 'caribbean',
  'British Virgin Islands': 'caribbean', 'VG': 'caribbean',
  'United States Virgin Islands': 'caribbean', 'VI': 'caribbean',

  // ── South America ──
  'Argentina': 'sam', 'AR': 'sam',
  'Bolivia': 'sam', 'BO': 'sam',
  'Brazil': 'sam', 'BR': 'sam',
  'Chile': 'sam', 'CL': 'sam',
  'Colombia': 'sam', 'CO': 'sam',
  'Ecuador': 'sam', 'EC': 'sam',
  'Falkland Islands': 'sam', 'FK': 'sam',
  'French Guiana': 'sam', 'GF': 'sam',
  'Guyana': 'sam', 'GY': 'sam',
  'Paraguay': 'sam', 'PY': 'sam',
  'Peru': 'sam', 'PE': 'sam',
  'Suriname': 'sam', 'SR': 'sam',
  'Uruguay': 'sam', 'UY': 'sam',
  'Venezuela': 'sam', 'VE': 'sam',

  // ── Africa ──
  'Algeria': 'africa', 'DZ': 'africa',
  'Angola': 'africa', 'AO': 'africa',
  'Benin': 'africa', 'BJ': 'africa',
  'Botswana': 'africa', 'BW': 'africa',
  'Burkina Faso': 'africa', 'BF': 'africa',
  'Burundi': 'africa', 'BI': 'africa',
  'Cameroon': 'africa', 'CM': 'africa',
  'Cape Verde': 'africa', 'CV': 'africa',
  'Central African Republic': 'africa', 'CF': 'africa',
  'Chad': 'africa', 'TD': 'africa',
  'Comoros': 'africa', 'KM': 'africa',
  'Congo': 'africa', 'Republic of the Congo': 'africa', 'CG': 'africa',
  'Democratic Republic of the Congo': 'africa', 'Congo (Kinshasa)': 'africa', 'CD': 'africa',
  'Djibouti': 'africa', 'DJ': 'africa',
  'Egypt': 'africa', 'EG': 'africa',
  'Equatorial Guinea': 'africa', 'GQ': 'africa',
  'Eritrea': 'africa', 'ER': 'africa',
  'Eswatini': 'africa', 'Swaziland': 'africa', 'SZ': 'africa',
  'Ethiopia': 'africa', 'ET': 'africa',
  'Gabon': 'africa', 'GA': 'africa',
  'Gambia': 'africa', 'GM': 'africa',
  'Ghana': 'africa', 'GH': 'africa',
  'Guinea': 'africa', 'GN': 'africa',
  'Guinea-Bissau': 'africa', 'GW': 'africa',
  'Ivory Coast': 'africa', "Cote d'Ivoire": 'africa', 'CI': 'africa',
  'Kenya': 'africa', 'KE': 'africa',
  'Lesotho': 'africa', 'LS': 'africa',
  'Liberia': 'africa', 'LR': 'africa',
  'Libya': 'africa', 'LY': 'africa',
  'Madagascar': 'africa', 'MG': 'africa',
  'Malawi': 'africa', 'MW': 'africa',
  'Mali': 'africa', 'ML': 'africa',
  'Mauritania': 'africa', 'MR': 'africa',
  'Mauritius': 'africa', 'MU': 'africa',
  'Mayotte': 'africa', 'YT': 'africa',
  'Morocco': 'africa', 'MA': 'africa',
  'Mozambique': 'africa', 'MZ': 'africa',
  'Namibia': 'africa', 'NA': 'africa',
  'Niger': 'africa', 'NE': 'africa',
  'Nigeria': 'africa', 'NG': 'africa',
  'Reunion': 'africa', 'RE': 'africa',
  'Rwanda': 'africa', 'RW': 'africa',
  'Sao Tome and Principe': 'africa', 'ST': 'africa',
  'Senegal': 'africa', 'SN': 'africa',
  'Seychelles': 'africa', 'SC': 'africa',
  'Sierra Leone': 'africa', 'SL': 'africa',
  'Somalia': 'africa', 'SO': 'africa',
  'South Africa': 'africa', 'ZA': 'africa',
  'South Sudan': 'africa', 'SS': 'africa',
  'Sudan': 'africa', 'SD': 'africa',
  'Tanzania': 'africa', 'TZ': 'africa',
  'Togo': 'africa', 'TG': 'africa',
  'Tunisia': 'africa', 'TN': 'africa',
  'Uganda': 'africa', 'UG': 'africa',
  'Western Sahara': 'africa', 'EH': 'africa',
  'Zambia': 'africa', 'ZM': 'africa',
  'Zimbabwe': 'africa', 'ZW': 'africa',

  // ── Asia ──
  'Afghanistan': 'asia', 'AF': 'asia',
  'Bahrain': 'asia', 'BH': 'asia',
  'Bangladesh': 'asia', 'BD': 'asia',
  'Bhutan': 'asia', 'BT': 'asia',
  'Brunei': 'asia', 'BN': 'asia',
  'Cambodia': 'asia', 'KH': 'asia',
  'China': 'asia', 'CN': 'asia',
  'East Timor': 'asia', 'Timor-Leste': 'asia', 'TL': 'asia',
  'Hong Kong': 'asia', 'Hong Kong SAR of China': 'asia', 'HK': 'asia',
  'India': 'asia', 'IN': 'asia',
  'Indonesia': 'asia', 'ID': 'asia',
  'Iran': 'asia', 'IR': 'asia',
  'Iraq': 'asia', 'IQ': 'asia',
  'Israel': 'asia', 'IL': 'asia',
  'Japan': 'asia', 'JP': 'asia',
  'Jordan': 'asia', 'JO': 'asia',
  'Kazakhstan': 'asia', 'KZ': 'asia',
  'Kuwait': 'asia', 'KW': 'asia',
  'Kyrgyzstan': 'asia', 'KG': 'asia',
  'Laos': 'asia', 'Lao Peoples Democratic Republic': 'asia', 'LA': 'asia',
  'Lebanon': 'asia', 'LB': 'asia',
  'Macau': 'asia', 'Macao': 'asia', 'MO': 'asia',
  'Malaysia': 'asia', 'MY': 'asia',
  'Maldives': 'asia', 'MV': 'asia',
  'Mongolia': 'asia', 'MN': 'asia',
  'Myanmar': 'asia', 'Burma': 'asia', 'MM': 'asia',
  'North Korea': 'asia', "Democratic People's Republic of Korea": 'asia', 'KP': 'asia',
  'Nepal': 'asia', 'NP': 'asia',
  'Oman': 'asia', 'OM': 'asia',
  'Pakistan': 'asia', 'PK': 'asia',
  'Palestinian Territory': 'asia', 'Palestine': 'asia', 'PS': 'asia',
  'Philippines': 'asia', 'PH': 'asia',
  'Qatar': 'asia', 'QA': 'asia',
  'Saudi Arabia': 'asia', 'SA': 'asia',
  'Singapore': 'asia', 'SG': 'asia',
  'South Korea': 'asia', 'Republic of Korea': 'asia', 'KR': 'asia',
  'Sri Lanka': 'asia', 'LK': 'asia',
  'Syria': 'asia', 'Syrian Arab Republic': 'asia', 'SY': 'asia',
  'Taiwan': 'asia', 'TW': 'asia',
  'Tajikistan': 'asia', 'TJ': 'asia',
  'Thailand': 'asia', 'TH': 'asia',
  'Turkmenistan': 'asia', 'TM': 'asia',
  'United Arab Emirates': 'asia', 'AE': 'asia',
  'Uzbekistan': 'asia', 'UZ': 'asia',
  'Vietnam': 'asia', 'VN': 'asia',
  'Yemen': 'asia', 'YE': 'asia',

  // ── Pacific ──
  'American Samoa': 'pacific', 'AS': 'pacific',
  'Australia': 'pacific', 'AU': 'pacific',
  'Cook Islands': 'pacific', 'CK': 'pacific',
  'Fiji': 'pacific', 'FJ': 'pacific',
  'French Polynesia': 'pacific', 'PF': 'pacific',
  'Guam': 'pacific', 'GU': 'pacific',
  'Kiribati': 'pacific', 'KI': 'pacific',
  'Marshall Islands': 'pacific', 'MH': 'pacific',
  'Micronesia': 'pacific', 'FM': 'pacific',
  'Nauru': 'pacific', 'NR': 'pacific',
  'New Caledonia': 'pacific', 'NC': 'pacific',
  'New Zealand': 'pacific', 'NZ': 'pacific',
  'Niue': 'pacific', 'NU': 'pacific',
  'Northern Mariana Islands': 'pacific', 'MP': 'pacific',
  'Palau': 'pacific', 'PW': 'pacific',
  'Papua New Guinea': 'pacific', 'PG': 'pacific',
  'Pitcairn': 'pacific', 'PN': 'pacific',
  'Samoa': 'pacific', 'WS': 'pacific',
  'Solomon Islands': 'pacific', 'SB': 'pacific',
  'Tonga': 'pacific', 'TO': 'pacific',
  'Tuvalu': 'pacific', 'TV': 'pacific',
  'United States Minor Outlying Islands': 'pacific', 'UM': 'pacific',
  'Vanuatu': 'pacific', 'VU': 'pacific',
  'Wallis and Futuna': 'pacific', 'WF': 'pacific',
};

// ── CSV parser (same logic as build-airport-data.js) ─────────────────────────
function parseCSVLine(line) {
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

function sanitize(val) {
  if (!val || val === '\\N' || val === 'N/A' || val === '-') return '';
  return val.trim();
}

function inferType(name) {
  if (/\bcargo\b|\bfreight\b|\bfreighter\b/i.test(name)) return 'cargo';
  return 'passenger';
}

// OpenFlights .dat: no headers, positional fields
// ID, Name, Alias, IATA, ICAO, Callsign, Country, Active
async function readDat(filePath) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  const rows = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const f = parseCSVLine(line);
    rows.push({
      name:     sanitize(f[1]),
      iata:     sanitize(f[3]),
      icao:     sanitize(f[4]),
      callsign: sanitize(f[5]),
      country:  sanitize(f[6]),
      active:   sanitize(f[7]),
    });
  }
  return rows;
}

async function main() {
  const datFile = path.join(RAW_DIR, 'airlines.dat');
  if (!fs.existsSync(datFile)) {
    console.error(
      'Missing source file.\n' +
      'Place airlines.dat (OpenFlights format) in data/raw/'
    );
    process.exit(1);
  }

  // Load existing entries as overlay — hand-curated fields (hub, type, simbrief_id) are preserved
  const existing = new Map();
  if (fs.existsSync(OUT_FILE)) {
    for (const a of JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')))
      existing.set(a.icao, a);
    console.log(`Loaded ${existing.size} existing entries`);
  }

  console.log('Reading airlines.dat…');
  const rows = await readDat(datFile);

  const airlines = new Map();
  const skipped = { noIcao: 0, inactive: 0, noName: 0, unknownCountry: 0, duplicate: 0 };

  for (const row of rows) {
    const icao = sanitize(row.icao)?.toUpperCase();
    if (!icao || !/^[A-Z]{3}$/.test(icao)) { skipped.noIcao++; continue; }

    if (row.active !== 'Y' && row.active !== 'Yes') { skipped.inactive++; continue; }

    const name = sanitize(row.name);
    if (!name) { skipped.noName++; continue; }

    if (airlines.has(icao)) { skipped.duplicate++; continue; }

    // Existing hand-curated entry takes full precedence
    if (existing.has(icao)) {
      airlines.set(icao, existing.get(icao));
      continue;
    }

    const country = sanitize(row.country);
    const region = COUNTRY_REGION[country];
    if (!region) { skipped.unknownCountry++; continue; }

    airlines.set(icao, {
      icao,
      iata:        sanitize(row.iata),
      name,
      callsign:    sanitize(row.callsign),
      country,
      region,
      hub:         [],
      type:        inferType(name),
      simbrief_id: icao,
      fleet:       [],
    });
  }

  // Preserve any hand-curated entries not in the CSV
  for (const [icao, entry] of existing)
    if (!airlines.has(icao)) airlines.set(icao, entry);

  const result = [...airlines.values()].sort((a, b) => a.icao.localeCompare(b.icao));
  const byRegion = {};
  for (const a of result) byRegion[a.region] = (byRegion[a.region] || 0) + 1;

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

  console.log('\n── Build complete ──────────────────');
  console.log(`  ${'total'.padEnd(12)} ${result.length}`);
  for (const [r, c] of Object.entries(byRegion).sort())
    console.log(`  ${r.padEnd(12)} ${c}`);
  console.log('\n── Skipped ─────────────────────────');
  for (const [r, c] of Object.entries(skipped))
    console.log(`  ${r.padEnd(16)} ${c}`);
}

main().catch(err => { console.error(err); process.exit(1); });
