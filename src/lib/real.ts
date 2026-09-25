// Real public-record sources — free APIs, no keys required.
//
//   Miami-Dade County Property Appraiser (ArcGIS REST)
//     ~900k parcels, real owner names + site addresses + valuations.
//   Philadelphia OPA (CARTO)
//     ~560k properties, real owner_1/owner_2 + locations + market values.
//   NYC ACRIS (Socrata open data)
//     Recorded property documents for the 5 boroughs: party names + addresses.
//   FEC (api.open.fec.gov, DEMO_KEY)
//     ~240M real individual campaign donors: names, city/state/zip, employer.
//
// Results are ingested into real_people / real_properties so each record is
// fetched once and then served locally forever.

import { getDb } from "./db";
import { parseWhere } from "./names";

const TIMEOUT = 12_000;

type Where = ReturnType<typeof parseWhere>;

/** Does a {city,state} filter match a source's jurisdiction? */
function inJurisdiction(w: Where, city: string, state: string): boolean {
  if (w.state && w.state !== state) return false;
  if (w.city && !w.city.toLowerCase().includes(city.toLowerCase())) return false;
  return true;
}

export interface RealPersonHit {
  source: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role: string;
  externalId: string;
  detail: Record<string, unknown>;
}

export interface RealPropertyHit {
  source: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  owners: { name: string; role: string }[];
  detail: Record<string, unknown>;
}

export interface Source {
  id: string;
  byName?: (name: string, where: Where) => Promise<RealPersonHit[]>;
  byAddress?: (street: string, where: Where) => Promise<RealPropertyHit[]>;
}

// ---------- per-source reachability ----------
// A source that errors is marked down for a cooldown period so every request
// doesn't pay the timeout penalty on unreachable networks.

const DOWN_MS = 5 * 60 * 1000;
const sourceDown = new Map<string, number>(); // id -> cooldown expiry timestamp

export function sourceIsDown(id: string): boolean {
  const until = sourceDown.get(id);
  if (until && Date.now() < until) return true;
  if (until) sourceDown.delete(id);
  return false;
}

export function markSourceDown(id: string, ms = DOWN_MS) {
  sourceDown.set(id, Date.now() + ms);
}

async function safe<T>(p: Promise<T>, fallback: T, sourceId: string): Promise<T> {
  try {
    return await p;
  } catch {
    markSourceDown(sourceId);
    return fallback;
  }
}

// ---------- helpers ----------

const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "MD", "ESQ"]);

function splitPersonName(
  raw: string,
  order: "first-last" | "last-first" = "first-last"
): { firstName: string | null; lastName: string | null } {
  const clean = raw
    .replace(/\b(ETAL|ET AL|TR|TRS|H\/W|W\/E|JT\/RS|LE|EST OF|ESTATE OF)\b/g, "")
    .replace(/[&,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(" ").filter((p) => !SUFFIXES.has(p.toUpperCase()));
  if (parts.length < 2) return { firstName: null, lastName: null };
  const cap = (s: string) => s.toLowerCase().replace(/(^|[-'])\w/g, (c) => c.toUpperCase());
  return order === "first-last"
    ? { firstName: cap(parts[0]), lastName: cap(parts[parts.length - 1]) }
    : { firstName: cap(parts[1]), lastName: cap(parts[0]) };
}

function likeConds(field: string, tokens: string[]): string {
  return tokens
    .map((t) => `UPPER(${field}) LIKE UPPER('%${t.replace(/'/g, "''")}%')`)
    .join(" AND ");
}

function tokensOf(s: string): string[] {
  return s.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

// ---------------- Miami-Dade (ArcGIS) ----------------

const MD_URL =
  "https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26/query";

interface MdFeature {
  attributes: Record<string, unknown>;
}

async function mdQuery(where: string): Promise<MdFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields:
      "FOLIO,TRUE_OWNER1,TRUE_OWNER2,TRUE_OWNER3,TRUE_SITE_ADDR,TRUE_SITE_CITY,TRUE_SITE_ZIP_CODE," +
      "TRUE_MAILING_ADDR1,TRUE_MAILING_CITY,TRUE_MAILING_STATE,TRUE_MAILING_ZIP_CODE," +
      "LAND_VAL_CUR,BUILDING_VAL_CUR,TOTAL_VAL_CUR,DOR_DESC",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "25",
  });
  const res = await fetch(`${MD_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return [];
  const json = (await res.json()) as { features?: MdFeature[] };
  return json.features ?? [];
}

const miamidade: Source = {
  id: "miamidade",

  async byName(name, where) {
    if (!inJurisdiction(where, "Miami", "FL")) return [];
    const tokens = tokensOf(name);
    if (!tokens.length) return [];
    const features = await mdQuery(likeConds("TRUE_OWNER1", tokens));
    return features.flatMap((f) => {
      const a = f.attributes;
      const owner = String(a.TRUE_OWNER1 ?? "");
      const { firstName, lastName } = splitPersonName(owner);
      return [{
        source: "miamidade",
        name: owner,
        firstName, lastName,
        address: String(a.TRUE_SITE_ADDR ?? "") || null,
        city: String(a.TRUE_SITE_CITY ?? "") || "Miami-Dade",
        state: "FL",
        zip: String(a.TRUE_SITE_ZIP_CODE ?? "") || null,
        role: "Property Owner",
        externalId: String(a.FOLIO ?? ""),
        detail: {
          folio: a.FOLIO,
          siteAddress: `${a.TRUE_SITE_ADDR ?? ""}, ${a.TRUE_SITE_CITY ?? ""} FL ${a.TRUE_SITE_ZIP_CODE ?? ""}`,
          mailingAddress: [a.TRUE_MAILING_ADDR1, a.TRUE_MAILING_CITY, a.TRUE_MAILING_STATE, a.TRUE_MAILING_ZIP_CODE]
            .filter(Boolean).join(" "),
          landValue: a.LAND_VAL_CUR,
          buildingValue: a.BUILDING_VAL_CUR,
          totalValue: a.TOTAL_VAL_CUR,
          landUse: a.DOR_DESC,
          coOwners: [a.TRUE_OWNER2, a.TRUE_OWNER3].filter(Boolean),
        },
      }];
    });
  },

  async byAddress(street, where) {
    if (!inJurisdiction(where, "Miami", "FL")) return [];
    const tokens = tokensOf(street).filter((t) => t.length > 1);
    if (!tokens.length) return [];
    const features = await mdQuery(likeConds("TRUE_SITE_ADDR", tokens));
    return features.map((f) => {
      const a = f.attributes;
      return {
        source: "miamidade",
        address: String(a.TRUE_SITE_ADDR ?? ""),
        city: String(a.TRUE_SITE_CITY ?? "") || "Miami-Dade",
        state: "FL",
        zip: String(a.TRUE_SITE_ZIP_CODE ?? "") || "",
        owners: [a.TRUE_OWNER1, a.TRUE_OWNER2, a.TRUE_OWNER3]
          .filter((o): o is string => !!o)
          .map((o) => ({ name: o, role: "Property Owner" })),
        detail: {
          folio: a.FOLIO,
          mailingAddress: [a.TRUE_MAILING_ADDR1, a.TRUE_MAILING_CITY, a.TRUE_MAILING_STATE, a.TRUE_MAILING_ZIP_CODE]
            .filter(Boolean).join(" "),
          landValue: a.LAND_VAL_CUR,
          buildingValue: a.BUILDING_VAL_CUR,
          totalValue: a.TOTAL_VAL_CUR,
          landUse: a.DOR_DESC,
        },
      };
    });
  },
};

// ---------------- Philadelphia OPA (CARTO) ----------------

const PHL_URL = "https://phl.carto.com/api/v2/sql";

interface PhlRow {
  owner_1?: string;
  owner_2?: string;
  location?: string;
  zip_code?: string;
  mailing_address_1?: string;
  mailing_address_2?: string;
  mailing_city_state?: string;
  mailing_zip?: string;
  market_value?: number;
  sale_price?: number;
  sale_date?: string;
  year_built?: number;
  category_code_description?: string;
  parcel_number?: string;
  number_of_bedrooms?: number;
  number_of_bathrooms?: number;
  total_livable_area?: number;
}

async function phlQuery(sql: string): Promise<PhlRow[]> {
  const res = await fetch(`${PHL_URL}?q=${encodeURIComponent(sql)}`, {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { rows?: PhlRow[] };
  return json.rows ?? [];
}

const PHL_COLS =
  "owner_1,owner_2,location,zip_code,mailing_address_1,mailing_address_2," +
  "mailing_city_state,mailing_zip,market_value,sale_price,sale_date,year_built," +
  "category_code_description,parcel_number,number_of_bedrooms,number_of_bathrooms,total_livable_area";

const philly: Source = {
  id: "philly",

  async byName(name, where) {
    if (!inJurisdiction(where, "Philadelphia", "PA")) return [];
    const tokens = tokensOf(name);
    if (!tokens.length) return [];
    const cond = tokens.map((t) => `upper(owner_1) like '%${t.replace(/'/g, "''")}%'`).join(" AND ");
    const rows = await phlQuery(
      `SELECT ${PHL_COLS} FROM opa_properties_public WHERE ${cond} LIMIT 25`
    );
    return rows.map((r) => {
      const owner = r.owner_1 ?? "";
      const { firstName, lastName } = splitPersonName(owner, "last-first");
      return {
        source: "philly",
        name: owner,
        firstName, lastName,
        address: r.location ?? null,
        city: "Philadelphia",
        state: "PA",
        zip: r.zip_code?.split("-")[0] ?? null,
        role: "Property Owner",
        externalId: `${r.parcel_number ?? ""}-${r.location ?? ""}`,
        detail: {
          folio: r.parcel_number,
          siteAddress: `${r.location ?? ""}, Philadelphia, PA ${r.zip_code ?? ""}`,
          mailingAddress: [r.mailing_address_1, r.mailing_address_2, r.mailing_city_state, r.mailing_zip]
            .filter(Boolean).join(" "),
          totalValue: r.market_value,
          salePrice: r.sale_price,
          saleDate: r.sale_date,
          yearBuilt: r.year_built,
          landUse: r.category_code_description,
          beds: r.number_of_bedrooms,
          baths: r.number_of_bathrooms,
          sqft: r.total_livable_area,
          coOwners: r.owner_2 ? [r.owner_2] : [],
        },
      };
    });
  },

  async byAddress(street, where) {
    if (!inJurisdiction(where, "Philadelphia", "PA")) return [];
    const tokens = tokensOf(street).filter((t) => t.length > 1);
    if (!tokens.length) return [];
    const cond = tokens.map((t) => `upper(location) like '%${t.replace(/'/g, "''")}%'`).join(" AND ");
    const rows = await phlQuery(
      `SELECT ${PHL_COLS} FROM opa_properties_public WHERE ${cond} LIMIT 25`
    );
    return rows.map((r) => ({
      source: "philly",
      address: r.location ?? "",
      city: "Philadelphia",
      state: "PA",
      zip: r.zip_code?.split("-")[0] ?? "",
      owners: [r.owner_1, r.owner_2]
        .filter((o): o is string => !!o)
        .map((o) => ({ name: o, role: "Property Owner" })),
      detail: {
        folio: r.parcel_number,
        mailingAddress: [r.mailing_address_1, r.mailing_address_2, r.mailing_city_state, r.mailing_zip]
          .filter(Boolean).join(" "),
        totalValue: r.market_value,
        salePrice: r.sale_price,
        saleDate: r.sale_date,
        yearBuilt: r.year_built,
        landUse: r.category_code_description,
        beds: r.number_of_bedrooms,
        baths: r.number_of_bathrooms,
        sqft: r.total_livable_area,
      },
    }));
  },
};

// ---------------- NYC ACRIS (Socrata) ----------------

const ACRIS_PARTIES = "https://data.cityofnewyork.us/resource/636b-3b5g.json";
const ACRIS_MASTER = "https://data.cityofnewyork.us/resource/bnx9-e6tj.json";

interface AcrisParty {
  document_id: string;
  party_type: string;
  name: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const PARTY_ROLES: Record<string, string> = {
  "1": "Grantor (seller)",
  "2": "Grantee (buyer)",
  "3": "Other party",
};

const acris: Source = {
  id: "acris",

  async byName(name, where) {
    const safe = name.toUpperCase().replace(/'/g, "''").trim();
    if (!safe) return [];
    const conds = [`upper(name) like '%${safe}%'`];
    if (where.state) conds.push(`upper(state)='${where.state}'`);
    if (where.city) conds.push(`upper(city) like '%${where.city.toUpperCase().replace(/'/g, "''")}%'`);
    const params = new URLSearchParams({
      $where: conds.join(" AND "),
      $limit: "25",
      $order: "document_id DESC",
    });
    const res = await fetch(`${ACRIS_PARTIES}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return [];
    const parties = (await res.json()) as AcrisParty[];
    if (!parties.length) return [];

    const docIds = [...new Set(parties.map((p) => p.document_id))].slice(0, 25);
    let master: Record<string, { doc_type?: string; document_date?: string; document_amt?: string }> = {};
    try {
      const mParams = new URLSearchParams({
        $where: `document_id IN (${docIds.map((d) => `'${d}'`).join(",")})`,
        $select: "document_id,doc_type,document_date,document_amt",
        $limit: "50",
      });
      const mRes = await fetch(`${ACRIS_MASTER}?${mParams}`, { signal: AbortSignal.timeout(TIMEOUT) });
      if (mRes.ok) {
        const rows = (await mRes.json()) as { document_id: string; doc_type?: string; document_date?: string; document_amt?: string }[];
        master = Object.fromEntries(rows.map((r) => [r.document_id, r]));
      }
    } catch {
      // enrichment is best-effort
    }

    return parties.map((p) => {
      const { firstName, lastName } = splitPersonName(p.name, "last-first");
      const m = master[p.document_id];
      return {
        source: "acris",
        name: p.name,
        firstName, lastName,
        address: [p.address_1, p.address_2].filter(Boolean).join(" ") || null,
        city: p.city ?? "New York",
        state: p.state ?? "NY",
        zip: p.zip ?? null,
        role: PARTY_ROLES[p.party_type] ?? "Recorded party",
        externalId: `${p.document_id}-${p.party_type}-${p.name}`,
        detail: {
          documentId: p.document_id,
          docType: m?.doc_type,
          docDate: m?.document_date,
          docAmount: m?.document_amt,
          mailingAddress: [p.address_1, p.address_2, p.city, p.state, p.zip].filter(Boolean).join(", "),
        },
      };
    });
  },
};

// ---------------- FEC donors ----------------

const FEC_URL = "https://api.open.fec.gov/v1/schedules/schedule_a/";
const FEC_KEY = process.env.FEC_API_KEY ?? "DEMO_KEY";

interface FecRow {
  contributor_name?: string;
  contributor_city?: string;
  contributor_state?: string;
  contributor_zip?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contribution_receipt_amount?: number;
  contribution_receipt_date?: string;
  committee?: { name?: string };
  contributor_id?: string;
  transaction_id?: string;
}

const fec: Source = {
  id: "fec",

  async byName(name, where) {
    const tokens = tokensOf(name);
    if (!tokens.length) return [];
    // FEC stores "LASTNAME, FIRSTNAME" — surname query gives best recall.
    const params = new URLSearchParams({
      api_key: FEC_KEY,
      contributor_name: tokens[tokens.length - 1],
      contributor_type: "individual",
      two_year_transaction_period: "2024",
      per_page: "25",
      sort: "-contribution_receipt_date",
      sort_hide_null: "true",
    });
    if (where.state) params.set("contributor_state", where.state);
    if (where.city) params.set("contributor_city", where.city);
    const res = await fetch(`${FEC_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: FecRow[] };
    const rows = json.results ?? [];
    // keep rows that actually match all name tokens
    const hits = rows.filter((r) => {
      const n = (r.contributor_name ?? "").toUpperCase();
      return tokens.every((t) => n.includes(t));
    });
    return hits.map((r) => {
      const name = r.contributor_name ?? "";
      const [last, first] = name.includes(",")
        ? name.split(",").map((s) => s.trim())
        : ["", name];
      const cap = (s: string) => s.toLowerCase().replace(/(^|[-' ])\w/g, (c) => c.toUpperCase());
      const TITLES = new Set(["MS", "MRS", "MR", "DR", "MISS", "JR", "SR", "II", "III", "IV"]);
      const firstToks = first.split(/\s+/).filter((t) => !TITLES.has(t.replace(/\./g, "").toUpperCase()));
      return {
        source: "fec",
        name,
        firstName: firstToks.length ? cap(firstToks[0]) : null,
        lastName: last ? cap(last) : null,
        address: null,
        city: r.contributor_city ? cap(r.contributor_city) : null,
        state: r.contributor_state ?? null,
        zip: r.contributor_zip ?? null,
        role: "Political Donor",
        externalId: `${r.transaction_id ?? ""}-${name}`,
        detail: {
          employer: r.contributor_employer,
          occupation: r.contributor_occupation,
          amount: r.contribution_receipt_amount,
          receiptDate: r.contribution_receipt_date,
          committee: r.committee?.name,
        },
      };
    });
  },
};

// ---------------- phone lookup (freecnamlookingup + numbers.online) ----------------

const CNAM_URL = "https://freecnamlookingup.com/api/lookup";
const FREECNAM_URL = "https://freecnam.org/dip";

// pace CNAM calls — the free API 429s on bursts
const CNAM_GAP_MS = 1200;
let lastCnamCall = 0;

async function cnamFetch(digits: string): Promise<Response> {
  const wait = Math.max(0, lastCnamCall + CNAM_GAP_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCnamCall = Date.now();
  return fetch(CNAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: digits }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
}
const NOL_URL = "https://numbers.online/api/v1/lookup/";
const NOL_KEY = process.env.NUMBERS_ONLINE_KEY;

export interface RealPhoneHit {
  digits: string;
  valid: boolean;
  lineType: string | null;
  carrier: string | null;
  cnam: string | null;
  city: string | null;
  state: string | null;
  spamScore: number | null;
  riskLevel: string | null;
  fetchedAt: string;
  detail: Record<string, unknown>;
}

interface PhoneRow {
  digits: string; valid: number; line_type: string | null; carrier: string | null;
  cnam: string | null; city: string | null; state: string | null;
  spam_score: number | null; risk_level: string | null;
  detail: string; fetched_at: string;
}

function phoneRowToHit(r: PhoneRow): RealPhoneHit {
  return {
    digits: r.digits, valid: !!r.valid, lineType: r.line_type, carrier: r.carrier,
    cnam: r.cnam, city: r.city ?? null, state: r.state ?? null,
    spamScore: r.spam_score, riskLevel: r.risk_level,
    fetchedAt: r.fetched_at, detail: JSON.parse(r.detail || "{}"),
  };
}

interface CnamResult {
  phoneNumber?: string;
  nationalFormat?: string;
  countryCode?: string;
  callerName?: string | null;
  callerNameError?: unknown;
  carrierName?: string | null;
  normalizedCarrier?: string | null;
  lineType?: string | null;
  city?: string | null;
  state?: string | null;
  raw?: {
    valid_number?: boolean;
    fraud?: unknown;
    portability?: { lrn?: string; ocn?: string; spid_carrier_name?: string; city?: string; state?: string };
  };
}

export async function lookupPhoneReal(digits: string): Promise<RealPhoneHit | null> {
  if (!/^\d{10}$/.test(digits)) return null;
  const db = getDb();
  const cached = db.prepare(`SELECT * FROM real_phones WHERE digits = ?`).get(digits) as PhoneRow | undefined;
  if (cached) return phoneRowToHit(cached);

  // primary: freecnamlookingup — free CNAM + carrier + portability
  let hit: RealPhoneHit | null = null;
  if (!sourceIsDown("cnamlookup")) {
    for (let attempt = 0; attempt < 3 && !hit; attempt++) {
      try {
        const res = await cnamFetch(digits);
        if (res.status === 429) {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
            continue;
          }
          markSourceDown("cnamlookup", 60_000); // rate limit — short cooldown
          break;
        }
        if (!res.ok) {
          if (res.status >= 500) markSourceDown("cnamlookup");
          break;
        }
        const j = (await res.json()) as { result?: CnamResult };
        const r = j.result;
        if (r?.phoneNumber) {
          hit = {
            digits,
            valid: r.raw?.valid_number !== false,
            lineType: r.lineType ?? null,
            carrier: r.carrierName ?? r.normalizedCarrier ?? null,
            cnam: r.callerName ?? null,
            city: r.city ?? r.raw?.portability?.city ?? null,
            state: r.state ?? r.raw?.portability?.state ?? null,
            spamScore: null,
            riskLevel: null,
            fetchedAt: new Date().toISOString(),
            detail: r as unknown as Record<string, unknown>,
          };
        }
      } catch {
        markSourceDown("cnamlookup");
      }
    }
  }

  // secondary CNAM dip when the registered name is missing or generic
  const GENERIC = /^(WIRELESS CALLER|CELL PHONE|CELLPHONE|TOLL FREE|TOLL-FREE|UNKNOWN|UNAVAILABLE|PRIVATE|RESTRICTED|NOT AVAILABLE)$/i;
  if (hit && hit.valid && (!hit.cnam || GENERIC.test(hit.cnam)) && !sourceIsDown("freecnam")) {
    try {
      const res = await fetch(`${FREECNAM_URL}?q=${digits}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text && !/^error/i.test(text) && !GENERIC.test(text)) {
          hit.detail.freecnamAlt = text;
          hit.cnam = text;
        }
      } else if (res.status === 429) {
        markSourceDown("freecnam", 60_000);
      }
    } catch {
      markSourceDown("freecnam");
    }
  }

  // enrich: numbers.online spam score
  if (hit && NOL_KEY && !sourceIsDown("numbersonline")) {
    try {
      const res = await fetch(`${NOL_URL}+1${digits}`, {
        headers: { Authorization: `Bearer ${NOL_KEY}` },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) {
        const j = (await res.json()) as Record<string, unknown>;
        const risk = (j.risk ?? {}) as { level?: string };
        hit.spamScore = (j.spam_score as number) ?? null;
        hit.riskLevel = risk.level ?? null;
        hit.detail.numbersOnline = j;
      } else if (res.status === 429 || res.status >= 500) markSourceDown("numbersonline");
    } catch {
      markSourceDown("numbersonline");
    }
  }

  if (!hit) return null;

  db.prepare(
    `INSERT OR REPLACE INTO real_phones (digits, valid, line_type, carrier, cnam, city, state, spam_score, risk_level, detail)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(hit.digits, hit.valid ? 1 : 0, hit.lineType, hit.carrier, hit.cnam, hit.city, hit.state, hit.spamScore, hit.riskLevel, JSON.stringify(hit.detail));

  return hit;
}

// ---------------- registry ----------------

export const SOURCES: Source[] = [miamidade, philly, acris, fec];

export async function fetchByName(name: string, where: Where): Promise<RealPersonHit[]> {
  const jobs = SOURCES.filter((s) => s.byName && !sourceIsDown(s.id)).map((s) =>
    safe(s.byName!(name, where), [] as RealPersonHit[], s.id)
  );
  return (await Promise.all(jobs)).flat();
}

export async function fetchByAddress(street: string, where: Where): Promise<RealPropertyHit[]> {
  const jobs = SOURCES.filter((s) => s.byAddress && !sourceIsDown(s.id)).map((s) =>
    safe(s.byAddress!(street, where), [] as RealPropertyHit[], s.id)
  );
  return (await Promise.all(jobs)).flat();
}

// ---------------- ingest ----------------

export function ingestRealPeople(hits: RealPersonHit[]): number[] {
  const db = getDb();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO real_people (source, name, first_name, last_name, address, city, state, zip, role, external_id, detail)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const sel = db.prepare(`SELECT id FROM real_people WHERE source=? AND name=? AND external_id=?`);
  const ids: number[] = [];
  for (const h of hits) {
    ins.run(
      h.source, h.name, h.firstName, h.lastName, h.address, h.city, h.state, h.zip,
      h.role, h.externalId, JSON.stringify(h.detail)
    );
    const row = sel.get(h.source, h.name, h.externalId) as { id: number } | undefined;
    if (row) ids.push(row.id);
  }
  return ids;
}

export function ingestRealProperty(hit: RealPropertyHit): number {
  const db = getDb();
  const key = `${hit.address}|${hit.city}|${hit.state}|${hit.zip}`;
  db.prepare(
    `INSERT OR IGNORE INTO real_properties (source, address, city, state, zip, detail)
     VALUES (?,?,?,?,?,?)`
  ).run(hit.source, key, hit.city, hit.state, hit.zip, JSON.stringify({ ...hit.detail, owners: hit.owners }));
  const row = db
    .prepare(`SELECT id FROM real_properties WHERE source=? AND address=?`)
    .get(hit.source, key) as { id: number };
  return row.id;
}
