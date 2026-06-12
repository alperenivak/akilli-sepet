// =====================================================
// OpenStreetMap Overpass — market şubeleri (İstanbul + Ankara)
// Kaynak: OSM shop=supermarket + brand etiketi (ODbL)
// =====================================================

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface OsmBranchRow {
  marketSlug: string;
  osmId: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  workingHours?: string;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_PATH = path.join(__dirname, '..', 'data', 'osm-branches-cache.json');
const DELAY_MS = 6_000;
const MAX_PER_MARKET_CITY = 45;
const MAX_RETRIES = 3;

const CITIES = ['İstanbul', 'Ankara'] as const;

export interface MarketOsmConfig {
  brands: string[];
  /** brand etiketi yoksa isim regex ile ara */
  nameRegex?: string;
}

/** market slug → OSM sorgu yapılandırması */
export const MARKET_BRAND_MAP: Record<string, MarketOsmConfig> = {
  bim: { brands: ['BİM'], nameRegex: 'BİM|BIM' },
  a101: { brands: ['A101'], nameRegex: 'A101' },
  sok: { brands: ['Şok', 'ŞOK', 'Sok Market'], nameRegex: 'Şok|ŞOK|Sok' },
  migros: { brands: ['Migros'], nameRegex: 'Migros' },
  carrefoursa: { brands: ['CarrefourSA', 'Carrefour'], nameRegex: 'Carrefour' },
  macrocenter: { brands: ['Macrocenter'], nameRegex: 'Macrocenter|Macro Center' },
};

const DEFAULT_HOURS: Record<string, string> = {
  bim: '09:00-21:00',
  a101: '08:00-22:00',
  sok: '09:00-21:00',
  migros: '08:00-23:00',
  carrefoursa: '08:00-22:00',
  macrocenter: '08:00-22:00',
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildAddress(tags: Record<string, string>): string {
  if (tags['addr:full']) return tags['addr:full'];
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  if (street) return street;
  if (tags['addr:place']) return tags['addr:place'];
  return tags.name ?? 'Adres bilgisi OSM';
}

function normalizeAscii(s: string): string {
  return s
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .trim();
}

function getMarketDisplayName(marketSlug: string): string {
  const MAP: Record<string, string> = {
    bim: 'BİM',
    a101: 'A101',
    sok: 'ŞOK',
    migros: 'Migros',
    carrefoursa: 'CarrefourSA',
    macrocenter: 'Macrocenter',
  };
  return MAP[marketSlug] ?? marketSlug.charAt(0).toUpperCase() + marketSlug.slice(1);
}

function isUsableAddress(address: string, marketSlug: string): boolean {
  const a = normalizeAscii(address);
  if (!a || a === 'adres bilgisi osm' || a.length < 4) return false;
  return !isGenericStoreName(address, marketSlug);
}

/** OSM'deki marka adi mi (Migros, BİM, Şok vb.) — sube ayirt edici degil */
function isGenericStoreName(name: string, marketSlug: string): boolean {
  const n = normalizeAscii(name);
  const aliases: Record<string, string[]> = {
    bim: ['bim'],
    sok: ['sok', 'sok market'],
    carrefoursa: ['carrefoursa', 'carrefour', 'carrefoursa express'],
    a101: ['a101'],
    migros: ['migros', 'migros jet', 'migros toptan', 'migros 5m', '5m'],
    macrocenter: ['macrocenter', 'macro center'],
  };
  const list = aliases[marketSlug] ?? [normalizeAscii(getMarketDisplayName(marketSlug))];
  return list.some((a) => n === a || n.startsWith(`${a} `));
}

function buildBranchName(
  marketSlug: string,
  tags: Record<string, string>,
  city: string,
  osmId: string,
): string {
  const marketName = getMarketDisplayName(marketSlug);
  const osmName = tags.name?.trim();
  const district = tags['addr:suburb'] ?? tags['addr:district'] ?? tags['addr:neighbourhood'];
  const street = tags['addr:street'];
  const address = buildAddress(tags);

  if (osmName && !isGenericStoreName(osmName, marketSlug) && osmName.length > marketName.length + 2) {
    return osmName.slice(0, 150);
  }

  if (district) {
    if (street && !isGenericStoreName(street, marketSlug)) {
      return `${marketName} ${district} — ${street}`.slice(0, 150);
    }
    return `${marketName} ${district}`.slice(0, 150);
  }

  if (street && !isGenericStoreName(street, marketSlug)) {
    return `${marketName} — ${street}`.slice(0, 150);
  }

  if (isUsableAddress(address, marketSlug)) {
    return `${marketName} — ${address}`.slice(0, 150);
  }

  const shortId = osmId.replace(/^(node|way)-/, '');
  return `${marketName} ${city} #${shortId}`.slice(0, 150);
}

/** Onceden kaydedilmis satirdan ismi yeniden uret (onbellek guncellemesi icin) */
export function refreshBranchName(row: OsmBranchRow): string {
  const tags: Record<string, string> = {};
  if (row.district) {
    tags['addr:suburb'] = row.district;
  }
  if (isUsableAddress(row.address, row.marketSlug)) {
    tags['addr:street'] = row.address;
  }
  return buildBranchName(row.marketSlug, tags, row.city, row.osmId);
}

/** Ayni isimli subeler icin sonek ekler */
export function uniquifyBranchNames<T extends { name: string; marketSlug: string }>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.marketSlug}:${normalizeAscii(row.name)}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return row;
    return { ...row, name: `${row.name} (${count})`.slice(0, 150) };
  });
}

function simplifyHours(raw?: string): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return raw.length <= 80 ? raw : undefined;
}

function parseElement(
  el: {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  },
  marketSlug: string,
  city: string,
): OsmBranchRow | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const district = tags['addr:suburb'] ?? tags['addr:district'] ?? tags['addr:neighbourhood'];
  const osmId = `${el.type}-${el.id}`;

  return {
    marketSlug,
    osmId,
    name: buildBranchName(marketSlug, tags, city, osmId),
    address: buildAddress(tags).slice(0, 500),
    city,
    district: district?.slice(0, 100),
    latitude: lat,
    longitude: lon,
    phone: (tags.phone ?? tags['contact:phone'])?.slice(0, 20),
    workingHours: simplifyHours(tags.opening_hours) ?? DEFAULT_HOURS[marketSlug],
  };
}

async function overpassRequest(query: string) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(
        OVERPASS_URL,
        `data=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'MarketApp/1.0 (branch-seed; dev@marketapp.local)',
          },
          timeout: 130_000,
        },
      );
      return res.data.elements ?? [];
    } catch (err) {
      lastErr = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429 || status === 504) {
        await sleep(DELAY_MS * (attempt + 2));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function queryInCity(
  city: string,
  marketSlug: string,
  filter: string,
): Promise<OsmBranchRow[]> {
  const query = `
[out:json][timeout:120];
area["name"="${city}"]["admin_level"="4"]->.searchArea;
(
  node["shop"="supermarket"]${filter}(area.searchArea);
  way["shop"="supermarket"]${filter}(area.searchArea);
);
out center;
`;

  const elements = await overpassRequest(query);
  return elements
    .map((el: Parameters<typeof parseElement>[0]) => parseElement(el, marketSlug, city))
    .filter((r: OsmBranchRow | null): r is OsmBranchRow => r != null);
}

async function queryMarketInCity(city: string, marketSlug: string, cfg: MarketOsmConfig): Promise<OsmBranchRow[]> {
  const collected: OsmBranchRow[] = [];

  for (const brand of cfg.brands) {
    try {
      const rows = await queryInCity(city, marketSlug, `["brand"="${brand}"]`);
      collected.push(...rows);
      if (rows.length > 0) break;
    } catch {
      /* sonraki brand dene */
    }
    await sleep(1_500);
  }

  if (collected.length === 0 && cfg.nameRegex) {
    try {
      const rows = await queryInCity(city, marketSlug, `["name"~"${cfg.nameRegex}",i]`);
      collected.push(...rows);
    } catch {
      /* atla */
    }
  }

  return collected;
}

function dedupeRows(rows: OsmBranchRow[]): OsmBranchRow[] {
  const seen = new Set<string>();
  const out: OsmBranchRow[] = [];
  for (const r of rows) {
    const key = `${r.marketSlug}:${r.latitude.toFixed(4)}:${r.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export async function fetchAllOsmBranches(
  marketSlugs: string[],
  onProgress?: (msg: string) => void,
): Promise<OsmBranchRow[]> {
  const all: OsmBranchRow[] = [];

  for (const city of CITIES) {
    for (const slug of marketSlugs) {
      const cfg = MARKET_BRAND_MAP[slug];
      if (!cfg) continue;

      onProgress?.(`OSM: ${city} / ${slug}…`);
      try {
        const rows = await queryMarketInCity(city, slug, cfg);
        const capped = dedupeRows(rows).slice(0, MAX_PER_MARKET_CITY);
        all.push(...capped);
        onProgress?.(`  → ${capped.length} şube`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onProgress?.(`  ⚠ ${slug} ${city} atlandı: ${msg}`);
      }
      await sleep(DELAY_MS);
    }
  }

  return uniquifyBranchNames(dedupeRows(all));
}

export function loadCache(): OsmBranchRow[] | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as {
      fetchedAt: string;
      rows: OsmBranchRow[];
    };
    const ageDays = (Date.now() - new Date(raw.fetchedAt).getTime()) / 86_400_000;
    if (ageDays > 30) return null;
    return raw.rows;
  } catch {
    return null;
  }
}

export function saveCache(rows: OsmBranchRow[]) {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ fetchedAt: new Date().toISOString(), rows }, null, 0));
}

export function loadCacheForce(): OsmBranchRow[] | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')) as { rows: OsmBranchRow[] };
    return raw.rows;
  } catch {
    return null;
  }
}
