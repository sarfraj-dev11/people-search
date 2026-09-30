/**
 * IPQualityScore phone intelligence - free tier (5k lookups/mo).
 * Carrier-grade signals: live line status, fraud score, line flags,
 * and owner-name/email enrichment when IPQS has coverage.
 * Returns null when no key is configured or the request fails.
 */

export interface IpqsPhoneResult {
  valid: boolean | null;
  /** live carrier-signal status: Active Line / Disconnected Line / etc. */
  activeStatus: string | null;
  active: boolean | null;
  carrier: string | null;
  lineType: string | null;
  name: string | null;
  city: string | null;
  region: string | null;
  zip: string | null;
  timezone: string | null;
  /** 0-100 fraud risk */
  fraudScore: number | null;
  emails: string[];
  flags: {
    voip: boolean;
    disposable: boolean;
    prepaid: boolean;
    tollFree: boolean;
    doNotCall: boolean;
    leaked: boolean;
    spammer: boolean;
    recentAbuse: boolean;
  };
}

interface IpqsRaw {
  success?: boolean;
  valid?: boolean;
  active?: boolean | null;
  active_status?: string | null;
  carrier?: string;
  line_type?: string;
  name?: string | null;
  city?: string | null;
  region?: string | null;
  zip_code?: string | null;
  timezone?: string | null;
  fraud_score?: number;
  VOIP?: boolean;
  disposable?: boolean;
  prepaid?: boolean;
  toll_free?: boolean;
  do_not_call?: boolean;
  leaked?: boolean;
  spammer?: boolean;
  recent_abuse?: boolean;
  associated_email_addresses?: { status?: string; emails?: string[] };
}

const T = 8_000;

/**
 * Trestle Phone Validation / phone_intel - carrier-signal data.
 * Trial enables 3.0/phone_intel: validity, carrier, line type, prepaid,
 * and activity_score (0-100 = observed live usage on the network).
 * Reverse Phone API (owners/addresses) needs product access enabled.
 */
export interface TrestlePhone {
  valid: boolean | null;
  /** 0-100 - observed recent activity on the carrier network */
  activityScore: number | null;
  carrier: string | null;
  lineType: string | null;
  prepaid: boolean;
}

export async function trestleLookup(digits: string): Promise<TrestlePhone | null> {
  const key = process.env.TRESTLE_API_KEY;
  if (!key || !/^\d{10}$/.test(digits)) return null;
  try {
    const res = await fetch(
      `https://api.trestleiq.com/3.0/phone_intel?phone=${encodeURIComponent(`1${digits}`)}`,
      { headers: { "x-api-key": key }, signal: AbortSignal.timeout(T) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      is_valid?: boolean;
      activity_score?: number;
      carrier?: string;
      line_type?: string;
      is_prepaid?: boolean;
      error?: unknown;
    };
    if (j.error) return null;
    return {
      valid: j.is_valid ?? null,
      activityScore: j.activity_score ?? null,
      carrier: j.carrier ?? null,
      lineType: j.line_type ?? null,
      prepaid: !!j.is_prepaid,
    };
  } catch {
    return null;
  }
}

/**
 * PeopleDataLabs person enrichment - free tier (100 credits/mo).
 * Phone -> real person profile: name, emails, social URLs, address, job.
 * This is actual aggregated-record data (same category brokers sell).
 */
export interface PdlPerson {
  name: string | null;
  sex: string | null;
  birthYear: number | null;
  emails: string[];
  phones: string[];
  address: string | null;
  location: string | null;
  jobTitle: string | null;
  company: string | null;
  industry: string | null;
  profiles: { platform: string; url: string }[];
}

interface PdlData {
  full_name?: string;
  sex?: string;
  birth_year?: number | boolean;
  // paid field bundles return `true`/`false` when not licensed - only arrays/strings are real data
  emails?: { address?: string }[] | boolean;
  personal_emails?: string[] | boolean;
  recommended_personal_email?: string | boolean;
  phone_numbers?: string[] | boolean;
  mobile_phone?: string | boolean;
  street_addresses?:
    | { street_address?: string; locality?: string; region?: string; postal_code?: string }[]
    | boolean;
  location_names?: string[] | boolean;
  location_region?: string | boolean;
  job_title?: string;
  job_company_name?: string;
  industry?: string;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  github_url?: string;
  profiles?: { network?: string; url?: string; username?: string }[] | boolean;
}

const ACRONYMS = new Set(["nyc", "usa", "us", "la", "dc", "ny", "sf", "hr", "it", "md"]);
const capWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[-' ])\w/g, (c) => c.toUpperCase())
    .replace(/\b\w{2,}\b/g, (w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w));

export async function pdlEnrich(digits: string): Promise<PdlPerson | null> {
  const key = process.env.PDL_API_KEY;
  if (!key || !/^\d{10}$/.test(digits)) return null;
  try {
    const url = `https://api.peopledatalabs.com/v5/person/enrich?phone=${encodeURIComponent(
      `+1${digits}`
    )}&min_likelihood=2`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: number; data?: PdlData };
    const d = j.data;
    if (j.status !== 200 || !d) return null;

    const arr = <T>(v: T[] | boolean | undefined): T[] => (Array.isArray(v) ? v : []);
    const str = (v: string | boolean | undefined): string | null =>
      typeof v === "string" && v ? v : null;

    const emails = [
      ...arr(d.emails).map((e) => e.address),
      ...arr(d.personal_emails),
      str(d.recommended_personal_email),
    ].filter((e): e is string => !!e).slice(0, 6);

    const addr = arr(d.street_addresses)[0];
    const profiles = arr(d.profiles)
      .filter((p) => p.url)
      .map((p) => ({
        platform: capWords(p.network ?? "profile"),
        url: p.url!.startsWith("http") ? p.url! : `https://${p.url}`,
      }))
      .filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i)
      .slice(0, 8);

    const isSocial = (u: string) => !u.includes("/company/");
    const clean = profiles.filter((p) => isSocial(p.url));

    return {
      name: d.full_name ? capWords(d.full_name) : null,
      sex: d.sex ?? null,
      birthYear: typeof d.birth_year === "number" ? d.birth_year : null,
      emails,
      phones: arr(d.phone_numbers).concat(str(d.mobile_phone) ? [str(d.mobile_phone)!] : []).slice(0, 6),
      address: addr
        ? [addr.street_address, addr.locality, addr.region, addr.postal_code].filter(Boolean).join(", ")
        : null,
      location: arr(d.location_names)[0] ?? str(d.location_region),
      jobTitle: d.job_title ? capWords(d.job_title) : null,
      company: d.job_company_name ? capWords(d.job_company_name) : null,
      industry: d.industry ? capWords(d.industry) : null,
      profiles: clean,
    };
  } catch {
    return null;
  }
}

/**
 * Numverify validation - free tier, email-only signup.
 * Extra validation/carrier/location source alongside CNAM.
 */
export interface NumverifyResult {
  valid: boolean;
  carrier: string | null;
  lineType: string | null;
  location: string | null;
  countryCode: string | null;
}

export async function numverifyLookup(digits: string): Promise<NumverifyResult | null> {
  const key = process.env.NUMVERIFY_KEY;
  if (!key || !/^\d{10}$/.test(digits)) return null;
  try {
    const res = await fetch(
      `http://apilayer.net/api/validate?access_key=${key}&number=1${digits}&country_code=US&format=1`,
      { signal: AbortSignal.timeout(T) }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      valid?: boolean;
      carrier?: string;
      line_type?: string;
      location?: string;
      country_code?: string;
      success?: boolean;
    };
    if (j.success === false || j.valid === undefined) return null;
    return {
      valid: j.valid,
      carrier: j.carrier ?? null,
      lineType: j.line_type ?? null,
      location: j.location ?? null,
      countryCode: j.country_code ?? null,
    };
  } catch {
    return null;
  }
}

export async function ipqsLookup(digits: string): Promise<IpqsPhoneResult | null> {
  const key = process.env.IPQS_API_KEY;
  if (!key || !/^\d{10}$/.test(digits)) return null;
  try {
    const url = `https://ipqualityscore.com/api/json/phone/${key}/${encodeURIComponent(
      `1${digits}`
    )}?strictness=1&country[]=US`;
    const res = await fetch(url, { signal: AbortSignal.timeout(T) });
    if (!res.ok) return null;
    const j = (await res.json()) as IpqsRaw;
    if (j.success === false) return null;

    const emails =
      j.associated_email_addresses?.status === "success"
        ? (j.associated_email_addresses.emails ?? []).slice(0, 6)
        : [];

    return {
      valid: j.valid ?? null,
      activeStatus: j.active_status ?? (j.active === true ? "Active Line" : null),
      active: j.active ?? null,
      carrier: j.carrier ?? null,
      lineType: j.line_type ?? null,
      name: j.name && j.name !== "N/A" ? j.name : null,
      city: j.city && j.city !== "N/A" ? j.city : null,
      region: j.region && j.region !== "N/A" ? j.region : null,
      zip: j.zip_code && j.zip_code !== "N/A" ? j.zip_code : null,
      timezone: j.timezone ?? null,
      fraudScore: j.fraud_score ?? null,
      emails,
      flags: {
        voip: !!j.VOIP,
        disposable: !!j.disposable,
        prepaid: !!j.prepaid,
        tollFree: !!j.toll_free,
        doNotCall: !!j.do_not_call,
        leaked: !!j.leaked,
        spammer: !!j.spammer,
        recentAbuse: !!j.recent_abuse,
      },
    };
  } catch {
    return null;
  }
}
