import { getDb } from "./db";
import { slugify, parseWhere, digitsOnly } from "./names";
import {
  fetchByName, fetchByAddress, lookupPhoneReal,
  ingestRealPeople, ingestRealProperty, type RealPropertyHit,
} from "./real";

// ---------- shared types ----------

export interface PersonResult {
  id: number;
  firstName: string;
  lastName: string;
  age: number | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  maidenName?: string | null;
  relatives: string[];
  premium: boolean;
  /** the public-record source this record came from */
  source: string;
  sourceLabel: string;
  role?: string;
}

export const SOURCE_LABELS: Record<string, string> = {
  miamidade: "Miami-Dade Property Appraiser",
  philly: "Philadelphia OPA Property Records",
  acris: "NYC ACRIS Property Records",
  fec: "FEC Campaign Finance Records",
};

export function personHref(p: { id: number; firstName: string; lastName: string }) {
  return `/name/${slugify(`${p.firstName} ${p.lastName}`)}-r${p.id}`;
}

// ---------- people search (real public records only) ----------

export interface SearchFilters {
  name: string;
  where: string;
  page?: number;
  perPage?: number;
}

export interface SearchResults {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  results: PersonResult[];
}

interface RealPersonRow {
  id: number; source: string; name: string; first_name: string | null; last_name: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  role: string | null; external_id: string; detail: string;
}

function realRowToPerson(r: RealPersonRow): PersonResult {
  const { firstName, lastName } = r.first_name
    ? { firstName: r.first_name, lastName: r.last_name ?? "" }
    : { firstName: r.name, lastName: "" };
  return {
    id: r.id,
    firstName,
    lastName,
    age: null,
    city: r.city ?? "",
    state: r.state ?? "",
    zip: r.zip ?? "",
    phone: null,
    relatives: [],
    premium: false,
    source: r.source,
    sourceLabel: SOURCE_LABELS[r.source] ?? r.source,
    role: r.role ?? undefined,
  };
}

function queryRealPeopleLocal(name: string, where: string): PersonResult[] {
  const db = getDb();
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const conds = tokens.map(() => `UPPER(name) LIKE ?`);
  const args: unknown[] = tokens.map((t) => `%${t.toUpperCase()}%`);
  const w = parseWhere(where);
  if (w.zip) { conds.push(`zip = ?`); args.push(w.zip); }
  else {
    if (w.state) { conds.push(`state = ?`); args.push(w.state); }
    if (w.city) { conds.push(`UPPER(city) LIKE ?`); args.push(`%${w.city.toUpperCase()}%`); }
  }
  const rows = db
    .prepare(`SELECT * FROM real_people WHERE ${conds.join(" AND ")} LIMIT 200`)
    .all(...args) as RealPersonRow[];
  return rows.map(realRowToPerson);
}

async function searchRealPeople(name: string, where: string): Promise<PersonResult[]> {
  if (!name.trim()) return [];
  let rows = queryRealPeopleLocal(name, where);
  if (rows.length) return rows;

  // miss: hit all live public-record APIs in parallel, ingest, re-query
  const hits = await fetchByName(name, parseWhere(where));
  if (hits.length) ingestRealPeople(hits);
  rows = queryRealPeopleLocal(name, where);
  return rows;
}

export async function searchPeople(f: SearchFilters): Promise<SearchResults> {
  const real = await searchRealPeople(f.name, f.where);
  const perPage = f.perPage ?? 10;
  const page = Math.max(1, f.page ?? 1);
  return {
    total: real.length,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(real.length / perPage)),
    results: real.slice((page - 1) * perPage, page * perPage),
  };
}

export async function findPeopleByNameSlug(slug: string): Promise<PersonResult[]> {
  const name = slug.replace(/-/g, " ").trim();
  if (!name) return [];
  const r = await searchPeople({ name, where: "", perPage: 50 });
  return r.results;
}

// ---------- real public-record person ----------

export interface RealPersonDetail {
  id: number;
  source: string;
  sourceLabel: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  role: string;
  externalId: string;
  detail: Record<string, unknown>;
  fetchedAt: string;
  relatedRecords: { id: number; role: string; externalId: string }[];
}

export function getRealPerson(id: number): RealPersonDetail | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM real_people WHERE id = ?`).get(id) as
    | (RealPersonRow & { fetched_at: string })
    | undefined;
  if (!row) return null;
  const related = db
    .prepare(`SELECT id, role, external_id FROM real_people WHERE name = ? AND id != ? LIMIT 20`)
    .all(row.name, id) as { id: number; role: string; external_id: string }[];
  return {
    id: row.id,
    source: row.source,
    sourceLabel: SOURCE_LABELS[row.source] ?? row.source,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    role: row.role ?? "Public record",
    externalId: row.external_id,
    detail: JSON.parse(row.detail || "{}"),
    fetchedAt: row.fetched_at,
    relatedRecords: related.map((r) => ({ id: r.id, role: r.role, externalId: r.external_id })),
  };
}

// ---------- reverse address ----------

export interface AddressResult {
  real: RealPropertyHit[];
}

export async function lookupAddress(street: string, where: string): Promise<AddressResult> {
  const real = await fetchByAddress(street, parseWhere(where));
  for (const hit of real.slice(0, 10)) ingestRealProperty(hit);
  return { real };
}

// ---------- reverse phone (real data via numbers.online + freecnam) ----------

export interface PhoneResult {
  phone: string;
  digits: string;
  valid: boolean;
  lineType: string | null;
  carrier: string | null;
  /** underlying network when the carrier is an MVNO/reseller */
  network: string | null;
  /** registered caller name from CNAM, normalized to "First Last" — null means none on record */
  cnam: string | null;
  /** true when CNAM is a generic label like "Wireless Caller" rather than a person */
  genericName: boolean;
  confidence: "high" | "medium" | "low";
  city: string | null;
  state: string | null;
  spamScore: number | null;
  riskLevel: string | null;
  source: string;
  sourceLabel: string;
  fetchedAt: string;
}

function capWords(s: string): string {
  return s.toLowerCase().replace(/(^|[-' ])\w/g, (c) => c.toUpperCase());
}

const GENERIC_CNAM =
  /^(WIRELESS CALLER|CELL PHONE|CELLPHONE|MOBILE CALLER|TOLL[ -]FREE|UNKNOWN|UNAVAILABLE|PRIVATE|RESTRICTED|NOT AVAILABLE|V\d{10,})$/i;

const BUSINESS_WORDS =
  /\b(INC|LLC|CORP|CORPORATION|COMMUNICATIONS?|SERVICES?|WIRELESS|CELLULAR|TELECOM|TELEPHONE|COMPANY|CO|GROUP|PARTNERS|HOLDINGS|DBA|CENTER|ASSOC|ASSOCIATES|BANK|SCHOOL|CHURCH|COUNTY|CITY OF|STATE OF|DEPT|DEPARTMENT)\b/i;

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV"]);

/**
 * CNAM stores residential names as "LASTNAME FIRSTNAME [MIDDLE] [SUFFIX]".
 * Reorder to "Firstname [Middle] Lastname [Suffix]" unless it looks like a
 * business label.
 */
function normalizeCnamName(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (GENERIC_CNAM.test(t) || BUSINESS_WORDS.test(t)) return capWords(t);
  const parts = t.split(" ").filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^[A-Z0-9'-.]+$/i.test(p))) {
    const last = parts[parts.length - 1];
    const suffix = NAME_SUFFIXES.has(last.toUpperCase()) ? parts.pop()! : null;
    const first = parts.slice(1).join(" ");
    const reordered = `${first} ${parts[0]}${suffix ? ` ${suffix}` : ""}`;
    return capWords(reordered);
  }
  return capWords(t);
}

export async function lookupPhone(input: string): Promise<PhoneResult | null> {
  const digits = digitsOnly(input).replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return null;
  const hit = await lookupPhoneReal(digits);
  if (!hit) return null;

  const rawCnam = hit.cnam?.trim() ?? "";
  const generic = !!rawCnam && GENERIC_CNAM.test(rawCnam);
  const cnam = rawCnam && !generic ? normalizeCnamName(rawCnam) : null;

  const confidence: PhoneResult["confidence"] = !hit.valid
    ? "low"
    : cnam
      ? "high"
      : "medium";

  const raw = (hit.detail.raw ?? {}) as { portability?: { spid_carrier_name?: string } };

  return {
    phone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    digits,
    valid: hit.valid,
    lineType: hit.lineType,
    carrier: hit.carrier,
    network: raw.portability?.spid_carrier_name ?? null,
    cnam,
    genericName: generic,
    confidence,
    city: hit.city ? capWords(hit.city) : null,
    state: hit.state ? capWords(hit.state) : null,
    spamScore: hit.spamScore,
    riskLevel: hit.riskLevel,
    source: "cnamlookup",
    sourceLabel: "freecnamlookingup + numbers.online",
    fetchedAt: hit.fetchedAt,
  };
}

// ---------- directory ----------

export function lastNameDirectory(letter: string): { name: string; count: number }[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT last_name name, COUNT(*) count FROM real_people
       WHERE last_name IS NOT NULL AND last_name != '' AND last_name LIKE ?
       GROUP BY last_name ORDER BY last_name LIMIT 80`
    )
    .all(`${letter}%`) as { name: string; count: number }[];
}
