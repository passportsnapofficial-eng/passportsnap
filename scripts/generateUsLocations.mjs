import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const zipcodes = require('zipcodes');

const outputPath = resolve(process.cwd(), 'src', 'data', 'usLocations.js');

const STATE_NAME_OVERRIDES = {
  DC: 'District of Columbia',
};

const NON_STATE_CODES = new Set(['PR', 'GU', 'VI', 'AS', 'MP']);
const US_DELIVERY_COUNTRY = 'United States';

function normalizeLocationValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function escapeForSource(value) {
  return JSON.stringify(value);
}

const stateCityMap = new Map();
const zipIndex = new Map();
const stateNameMap = new Map();

for (const [zip, entry] of Object.entries(zipcodes.codes)) {
  if (!entry || entry.country !== 'US') continue;
  if (!entry.state || NON_STATE_CODES.has(entry.state)) continue;

  const stateCode = String(entry.state).trim().toUpperCase();
  const cityName = String(entry.city || '').trim();
  if (!stateCode || !cityName) continue;

  stateNameMap.set(stateCode, STATE_NAME_OVERRIDES[stateCode] || zipcodes.states[stateCode] || stateCode);

  if (!stateCityMap.has(stateCode)) {
    stateCityMap.set(stateCode, new Map());
  }

  const cityMap = stateCityMap.get(stateCode);
  if (!cityMap.has(cityName)) {
    cityMap.set(cityName, []);
  }

  cityMap.get(cityName).push(zip);
  zipIndex.set(zip, { city: cityName, state: stateCode });
}

const US_STATE_OPTIONS = Array.from(stateCityMap.entries())
  .map(([code, cities]) => ({
    code,
    name: stateNameMap.get(code) || code,
    cities: Array.from(cities.entries())
      .map(([name, zips]) => ({
        name,
        zips: zips.sort((left, right) => left.localeCompare(right)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const source = `export const US_DELIVERY_COUNTRY = ${escapeForSource(US_DELIVERY_COUNTRY)};

export const US_STATE_OPTIONS = ${JSON.stringify(US_STATE_OPTIONS, null, 2)};

function normalizeLocationValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildStateAliasMap() {
  const aliasMap = new Map();

  for (const state of US_STATE_OPTIONS) {
    aliasMap.set(normalizeLocationValue(state.code), state);
    aliasMap.set(normalizeLocationValue(state.name), state);
  }

  aliasMap.set('washingtondc', US_STATE_OPTIONS.find((state) => state.code === 'DC'));
  aliasMap.set('districtcolumbia', US_STATE_OPTIONS.find((state) => state.code === 'DC'));
  aliasMap.set('usa', { code: 'US', name: US_DELIVERY_COUNTRY, cities: [] });
  aliasMap.set('us', { code: 'US', name: US_DELIVERY_COUNTRY, cities: [] });
  aliasMap.set('unitedstates', { code: 'US', name: US_DELIVERY_COUNTRY, cities: [] });

  return aliasMap;
}

const STATE_ALIAS_MAP = buildStateAliasMap();
const STATE_BY_CODE = new Map(US_STATE_OPTIONS.map((state) => [state.code, state]));
const ZIP_INDEX = new Map();
const CITY_LOOKUP = new Map();

for (const state of US_STATE_OPTIONS) {
  const cityMap = new Map();

  for (const city of state.cities) {
    cityMap.set(normalizeLocationValue(city.name), city);

    for (const zip of city.zips) {
      ZIP_INDEX.set(zip, {
        zip,
        city: city.name,
        state: state.code,
      });
    }
  }

  CITY_LOOKUP.set(state.code, cityMap);
}

function levenshteinDistance(left = '', right = '') {
  const a = normalizeLocationValue(left);
  const b = normalizeLocationValue(right);

  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const nextDiagonal = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + cost,
      );
      diagonal = nextDiagonal;
    }
  }

  return previous[b.length];
}

function findClosestMatch(input, options, projector, maxDistance = 2) {
  const normalizedInput = normalizeLocationValue(input);
  if (!normalizedInput) return null;

  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const option of options) {
    const candidate = projector(option);
    const normalizedCandidate = normalizeLocationValue(candidate);
    if (!normalizedCandidate) continue;

    if (normalizedCandidate.startsWith(normalizedInput) || normalizedInput.startsWith(normalizedCandidate)) {
      return option;
    }

    const distance = levenshteinDistance(normalizedInput, normalizedCandidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = option;
    }
  }

  return bestDistance <= maxDistance ? bestMatch : null;
}

export function resolveUsCountryName(input = '') {
  const match = STATE_ALIAS_MAP.get(normalizeLocationValue(input));
  return match?.code === 'US' ? US_DELIVERY_COUNTRY : null;
}

export function resolveUsState(input = '') {
  const exactMatch = STATE_ALIAS_MAP.get(normalizeLocationValue(input));
  if (exactMatch && exactMatch.code !== 'US') {
    return exactMatch;
  }

  return findClosestMatch(input, US_STATE_OPTIONS, (state) => state.name);
}

export function getUsStateByCode(code = '') {
  return STATE_BY_CODE.get(String(code || '').trim().toUpperCase()) || null;
}

export function getUsCitiesByState(stateCode = '') {
  return (getUsStateByCode(stateCode)?.cities || []).map((city) => city.name);
}

export function getUsZipsByStateAndCity(stateCode = '', cityName = '') {
  const state = getUsStateByCode(stateCode);
  if (!state) return [];

  const cityMap = CITY_LOOKUP.get(state.code);
  const directMatch = cityMap?.get(normalizeLocationValue(cityName));
  if (directMatch) {
    return directMatch.zips;
  }

  const fuzzyMatch = findClosestMatch(cityName, state.cities, (city) => city.name, 2);
  return fuzzyMatch?.zips || [];
}

export function lookupUsZip(zip = '') {
  const normalizedZip = String(zip || '').trim();
  return ZIP_INDEX.get(normalizedZip) || null;
}

export function resolveUsCity(stateCode = '', input = '') {
  const state = getUsStateByCode(stateCode);
  if (!state) return null;

  const cityMap = CITY_LOOKUP.get(state.code);
  const exactMatch = cityMap?.get(normalizeLocationValue(input));
  if (exactMatch) {
    return exactMatch.name;
  }

  const fuzzyMatch = findClosestMatch(input, state.cities, (city) => city.name, 2);
  return fuzzyMatch?.name || null;
}
`;

await writeFile(outputPath, source, 'utf8');
console.log(`Generated ${outputPath}`);
