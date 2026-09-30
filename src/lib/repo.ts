import { getDb } from "./db";
import { slugify, parseWhere, digitsOnly } from "./names";
import {
  fetchByName, fetchByAddress, lookupPhoneReal,
  ingestRealPeople, ingestRealProperty, type RealPropertyHit,
} from "./real";
import {
  githubUser, githubSearch, redditUser, gravatarProfile, phoneWebMentions,
  type SocialProfile, type GravatarProfile, type WebMentions,
} from "./social";
import {
  ipqsLookup, pdlEnrich, trestleLookup, searchbugReport,
  type PdlPerson, type SearchBugReport,
} from "./phoneintel";

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
  if (!db) return [];
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
  if (!hits.length) return [];

  // no writable DB (e.g. serverless) - map hits directly instead of caching
  if (!getDb()) {
    return hits.map((h, i) => ({
      id: i + 1,
      firstName: h.firstName ?? h.name,
      lastName: h.lastName ?? "",
      age: null,
      city: h.city ?? "",
      state: h.state ?? "",
      zip: h.zip ?? "",
      phone: null,
      relatives: [],
      premium: false,
      source: h.source,
      sourceLabel: SOURCE_LABELS[h.source] ?? h.source,
      role: h.role,
    }));
  }

  ingestRealPeople(hits);
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
  if (!db) return null;
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
  /** registered caller name from CNAM, normalized to "First Last" - null means none on record */
  cnam: string | null;
  /** true when CNAM is a generic label like "Wireless Caller" rather than a person */
  genericName: boolean;
  confidence: "high" | "medium" | "low";
  city: string | null;
  state: string | null;
  spamScore: number | null;
  riskLevel: string | null;
  /** IPQS 0-100 fraud risk */
  fraudScore: number | null;
  /** live carrier signal: Active Line / Disconnected Line / Phone Turned Off / ... */
  activeStatus: string | null;
  /** Trestle 0-100 observed network activity */
  activityScore: number | null;
  /** reputation/line flags from IPQS */
  flags: {
    voip: boolean;
    disposable: boolean;
    prepaid: boolean;
    tollFree: boolean;
    doNotCall: boolean;
    leaked: boolean;
    spammer: boolean;
    recentAbuse: boolean;
  } | null;
  /** names/emails IPQS associates with the number (not identity-verified) */
  extraNames: string[];
  extraEmails: string[];
  zip: string | null;
  timezone: string | null;
  /** matched person profile from PeopleDataLabs (aggregated public-record data) */
  person: PdlPerson | null;
  /** public-records report from SearchBug (names, DOB, addresses, relatives, emails) */
  report: SearchBugReport | null;
  source: string;
  sourceLabel: string;
  fetchedAt: string;
  /** emails/profiles/pages found on public web pages mentioning this number */
  web: WebMentions | null;
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
  const [hit, ipqs, pdl, trestle, sb, web] = await Promise.all([
    lookupPhoneReal(digits),
    ipqsLookup(digits).catch(() => null),
    pdlEnrich(digits).catch(() => null),
    trestleLookup(digits).catch(() => null),
    searchbugReport(digits).catch(() => null),
    phoneWebMentions(digits).catch(() => null),
  ]);
  if (!hit) return null;

  const rawCnam = hit.cnam?.trim() ?? "";
  const generic = !!rawCnam && GENERIC_CNAM.test(rawCnam);
  // IPQS reverse-name fills in when the carrier record is generic or missing
  const cnam =
    rawCnam && !generic
      ? normalizeCnamName(rawCnam)
      : (ipqs?.name ?? null);

  const valid = ipqs?.valid ?? trestle?.valid ?? hit.valid;
  const confidence: PhoneResult["confidence"] = !valid
    ? "low"
    : cnam || ipqs?.active === true || pdl || sb || (trestle?.activityScore ?? 0) >= 70
      ? "high"
      : "medium";

  const raw = (hit.detail.raw ?? {}) as { portability?: { spid_carrier_name?: string } };

  const sources = ["freecnamlookingup", "numbers.online"];
  if (ipqs) sources.push("ipqualityscore");
  if (trestle) sources.push("trestle");
  if (pdl) sources.push("peopledatalabs");
  if (sb) sources.push("searchbug");

  // derive live line status: IPQS field wins, else Trestle activity score
  const activeStatus =
    ipqs?.activeStatus ??
    (trestle?.activityScore != null
      ? trestle.activityScore >= 70
        ? "Active Line - High Confidence"
        : trestle.activityScore >= 30
          ? "Active Line - Low Confidence"
          : "Low Activity / Possibly Inactive"
      : null);

  const flags =
    ipqs?.flags ??
    (trestle
      ? {
          voip: /voip/i.test(trestle.lineType ?? ""),
          disposable: false,
          prepaid: trestle.prepaid,
          tollFree: false,
          doNotCall: false,
          leaked: false,
          spammer: false,
          recentAbuse: false,
        }
      : null);

  return {
    phone: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`,
    digits,
    valid,
    lineType: hit.lineType ?? ipqs?.lineType ?? trestle?.lineType ?? null,
    carrier: hit.carrier ?? ipqs?.carrier ?? trestle?.carrier ?? null,
    network: raw.portability?.spid_carrier_name ?? null,
    cnam,
    genericName: generic,
    confidence,
    city: hit.city ? capWords(hit.city) : (ipqs?.city ?? null),
    state: hit.state ? capWords(hit.state) : (ipqs?.region ?? null),
    spamScore: hit.spamScore,
    riskLevel: hit.riskLevel,
    fraudScore: ipqs?.fraudScore ?? null,
    activityScore: trestle?.activityScore ?? null,
    activeStatus,
    flags,
    extraNames: ipqs?.name ? [ipqs.name] : [],
    extraEmails: ipqs?.emails ?? [],
    zip: ipqs?.zip ?? null,
    timezone: ipqs?.timezone ?? null,
    person: pdl,
    report: sb,
    source: "multi",
    sourceLabel: sources.join(" + "),
    fetchedAt: hit.fetchedAt,
    web,
  };
}

// ---------- directory ----------

export function lastNameDirectory(letter: string): { name: string; count: number }[] {
  const db = getDb();
  if (!db) return [];
  return db
    .prepare(
      `SELECT last_name name, COUNT(*) count FROM real_people
       WHERE last_name IS NOT NULL AND last_name != '' AND last_name LIKE ?
       GROUP BY last_name ORDER BY last_name LIMIT 80`
    )
    .all(`${letter}%`) as { name: string; count: number }[];
}

// ---------- email / username lookups (free public-profile sources) ----------

export interface EmailResult {
  email: string;
  gravatar: GravatarProfile | null;
  github: SocialProfile[];
}

export async function lookupEmail(email: string): Promise<EmailResult | null> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  const [gravatar, github] = await Promise.all([
    gravatarProfile(clean),
    githubSearch(clean),
  ]);
  return { email: clean, gravatar, github };
}

export interface UsernameResult {
  username: string;
  profiles: SocialProfile[];
  /** direct profile links - unverified until visited */
  links: { platform: string; url: string }[];
}

export async function lookupUsername(username: string): Promise<UsernameResult | null> {
  const u = username.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{2,30}$/.test(u)) return null;
  const [gh, rd] = await Promise.all([githubUser(u), redditUser(u)]);
  return {
    username: u,
    profiles: [gh, rd].filter((p): p is SocialProfile => !!p),
    links: [
      { platform: "Instagram", url: `https://www.instagram.com/${u}` },
      { platform: "X (Twitter)", url: `https://x.com/${u}` },
      { platform: "TikTok", url: `https://www.tiktok.com/@${u}` },
      { platform: "Facebook", url: `https://www.facebook.com/${u}` },
      { platform: "LinkedIn", url: `https://www.linkedin.com/in/${u}` },
      { platform: "YouTube", url: `https://www.youtube.com/@${u}` },
    ],
  };
}
