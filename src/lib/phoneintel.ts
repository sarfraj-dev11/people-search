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
 * PeopleDataLabs person enrichment - free tier (100 credits/mo).
 * Phone -> real person profile: name, emails, social URLs, address, job.
 * This is actual aggregated-record data (same category brokers sell).
 */
export interface PdlPerson {
  name: string | null;
  emails: string[];
  phones: string[];
  address: string | null;
  location: string | null;
  jobTitle: string | null;
  company: string | null;
  profiles: { platform: string; url: string }[];
}

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
    const j = (await res.json()) as {
      status?: number;
      data?: {
        full_name?: string;
        emails?: { address?: string }[];
        phone_numbers?: string[];
        street_addresses?: { street_address?: string; locality?: string; region?: string; postal_code?: string }[];
        location_names?: string[];
        job_title?: string;
        job_company_name?: string;
        linkedin_url?: string;
        twitter_url?: string;
        facebook_url?: string;
        github_url?: string;
      };
    };
    const d = j.data;
    if (j.status !== 200 || !d) return null;

    const addr = d.street_addresses?.[0];
    const profiles = [
      d.linkedin_url && { platform: "LinkedIn", url: d.linkedin_url },
      d.twitter_url && { platform: "X (Twitter)", url: d.twitter_url },
      d.facebook_url && { platform: "Facebook", url: d.facebook_url },
      d.github_url && { platform: "GitHub", url: d.github_url },
    ].filter((p): p is { platform: string; url: string } => !!p);

    return {
      name: d.full_name ?? null,
      emails: (d.emails ?? []).map((e) => e.address).filter((e): e is string => !!e).slice(0, 6),
      phones: (d.phone_numbers ?? []).slice(0, 6),
      address: addr
        ? [addr.street_address, addr.locality, addr.region, addr.postal_code].filter(Boolean).join(", ")
        : null,
      location: d.location_names?.[0] ?? null,
      jobTitle: d.job_title ?? null,
      company: d.job_company_name ?? null,
      profiles,
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
