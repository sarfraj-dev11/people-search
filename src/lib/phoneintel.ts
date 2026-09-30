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
