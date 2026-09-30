import crypto from "node:crypto";

/**
 * Free, legal public-profile lookups --- no scraping.
 * GitHub + Reddit public APIs and Gravatar's public profile endpoint.
 */

export interface SocialProfile {
  platform: string;
  username: string | null;
  name: string | null;
  url: string;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  stats: string | null;
}

const UA = { "User-Agent": "numtrace-lookup/1.0" };
const T = 8_000;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(T) });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function githubUser(username: string): Promise<SocialProfile | null> {
  const j = await getJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
  if (!j?.login) return null;
  return {
    platform: "GitHub",
    username: j.login as string,
    name: (j.name as string) ?? null,
    url: j.html_url as string,
    avatar: (j.avatar_url as string) ?? null,
    bio: (j.bio as string) ?? null,
    location: (j.location as string) ?? null,
    stats: `${j.followers ?? 0} followers -- ${j.public_repos ?? 0} repos`,
  };
}

export async function redditUser(username: string): Promise<SocialProfile | null> {
  const j = await getJson(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`);
  const d = j?.data as Record<string, unknown> | undefined;
  if (!d?.name) return null;
  const karma = (d.total_karma as number) ?? 0;
  const icon = (d.icon_img as string)?.split("?")[0] ?? null;
  return {
    platform: "Reddit",
    username: `u/${d.name}`,
    name: (d.name as string) ?? null,
    url: `https://www.reddit.com/user/${d.name}`,
    avatar: icon,
    bio: null,
    location: null,
    stats: `${karma.toLocaleString()} karma`,
  };
}

export interface GravatarProfile {
  name: string | null;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  /** linked public accounts Gravatar knows about (Twitter, WordPress, etc.) */
  accounts: { platform: string; username: string; url: string }[];
}

export async function gravatarProfile(email: string): Promise<GravatarProfile | null> {
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  const j = await getJson(`https://www.gravatar.com/${hash}.json`);
  const e = (j?.entry as Record<string, unknown>[])?.[0];
  if (!e) return null;
  const name = (e.name as { formatted?: string })?.formatted ?? (e.displayName as string) ?? null;
  const photos = e.photos as { value?: string }[] | undefined;
  const accounts = (e.accounts as { name?: string; username?: string; url?: string }[] | undefined) ?? [];
  return {
    name,
    username: (e.preferredUsername as string) ?? null,
    avatar: photos?.[0]?.value ?? `https://www.gravatar.com/avatar/${hash}`,
    bio: (e.aboutMe as string) ?? null,
    location: (e.currentLocation as string) ?? null,
    accounts: accounts
      .filter((a) => a.url)
      .map((a) => ({ platform: a.name ?? "profile", username: a.username ?? "", url: a.url! })),
  };
}

/** GitHub user search --- works best with exact emails/usernames; unauth rate limits apply */
export async function githubSearch(query: string): Promise<SocialProfile[]> {
  const j = await getJson(`https://api.github.com/search/users?q=${encodeURIComponent(query)}`);
  const items = (j?.items as Record<string, unknown>[] | undefined) ?? [];
  return items.slice(0, 5).map((u) => ({
    platform: "GitHub",
    username: u.login as string,
    name: null,
    url: u.html_url as string,
    avatar: (u.avatar_url as string) ?? null,
    bio: null,
    location: null,
    stats: null,
  }));
}

// ---------- public-web mentions (OSINT-lite) ----------

export interface WebMentions {
  /** emails appearing on public pages that mention this query */
  emails: string[];
  /** social profile links found on those pages */
  links: { platform: string; url: string }[];
  /** pages mentioning the query */
  pages: { title: string; url: string; snippet: string }[];
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SOCIAL_HOSTS: [RegExp, string][] = [
  [/instagram\.com\/[\w.]+/i, "Instagram"],
  [/twitter\.com\/[\w]+|x\.com\/[\w]+/i, "X (Twitter)"],
  [/facebook\.com\/[\w.]+/i, "Facebook"],
  [/linkedin\.com\/in\/[\w-]+/i, "LinkedIn"],
  [/tiktok\.com\/@[\w.]+/i, "TikTok"],
  [/youtube\.com\/@[\w.-]+|youtube\.com\/channel\/[\w-]+/i, "YouTube"],
  [/github\.com\/[\w-]+/i, "GitHub"],
  [/reddit\.com\/user\/[\w-]+/i, "Reddit"],
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function getText(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(T),
      ...init,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
}

/** Junk/non-personal emails that appear in page chrome, assets and tracking code. */
const JUNK_EMAIL =
  /(?:example\.|sentry|wixpress|duckduckgo|@2x\.|@3x\.|\.png$|\.jpe?g$|\.gif$|\.svg$|\.webp$|\.css$|\.js$|noreply|no-reply|donotreply|@sentry|w3\.org|schema\.org|godaddy\.com\/|@font)/i;

function emailsIn(text: string): string[] {
  const found = decodeEntities(text).match(EMAIL_RE) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()).filter((e) => !JUNK_EMAIL.test(e)))];
}

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/** Brave Search API - reliable JSON results when BRAVE_API_KEY is set (free tier). */
async function searchBrave(query: string): Promise<SearchHit[]> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`,
      {
        headers: {
          "X-Subscription-Token": key,
          Accept: "application/json",
          "User-Agent": BROWSER_UA,
        },
        signal: AbortSignal.timeout(T),
      }
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      web?: { results?: { url?: string; title?: string; description?: string }[] };
    };
    return (j.web?.results ?? [])
      .filter((r) => r.url && /^https?:/.test(r.url))
      .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: r.description ?? "" }));
  } catch {
    return [];
  }
}

/** Tavily search API - reliable JSON results when TAVILY_API_KEY is set (free tier). */
async function searchTavily(query: string): Promise<SearchHit[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: 10 }),
      signal: AbortSignal.timeout(T),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      results?: { url?: string; title?: string; content?: string }[];
    };
    return (j.results ?? [])
      .filter((r) => r.url && /^https?:/.test(r.url))
      .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: r.content ?? "" }));
  } catch {
    return [];
  }
}

/** DuckDuckGo lite (POST - GET is captcha-walled). Best-effort, keyless. */
async function searchLite(query: string): Promise<SearchHit[]> {
  let html: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    html = await getText("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!html) return [];
    if (!html.includes("anomaly-modal")) break;
    html = null;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!html) return [];

  const hits: SearchHit[] = [];
  const snippets = [...html.matchAll(/<td class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi)].map(
    (m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
  );
  // anchors: <a rel="nofollow" href="URL" class='result-link'>TITLE</a>
  // attribute order/quotes vary, so match every <a> tag then filter by class.
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) && hits.length < 8) {
    const attrs = m[1];
    if (!/class=['"][^'"]*result-link/.test(attrs)) continue;
    const rawHref = decodeEntities(attrs.match(/href=["']([^"']+)["']/)?.[1] ?? "");
    const uddg = rawHref.match(/uddg=([^&]+)/);
    const url = uddg ? decodeURIComponent(uddg[1]) : rawHref;
    if (!/^https?:/.test(url) || seen.has(url)) continue;
    seen.add(url);
    hits.push({
      title: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
      url,
      snippet: snippets[hits.length] ?? "",
    });
  }
  return hits;
}

/**
 * Search the public web for pages mentioning a query; extract emails + profile links.
 * `mustContainDigits` (phone lookups) keeps only pages that literally show the number -
 * search engines return fuzzy hits otherwise.
 */
export async function webMentions(query: string, mustContainDigits?: string): Promise<WebMentions> {
  const out: WebMentions = { emails: [], links: [], pages: [] };
  const hits = (await searchBrave(`"${query}"`))
    .concat(await searchTavily(`"${query}"`))
    .concat(await searchLite(`"${query}"`));

  const seen = new Set<string>();
  const candidates: SearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url) || candidates.length >= 10) continue;
    seen.add(h.url);
    candidates.push(h);
  }

  const digitsOnlyLocal = (s: string) => s.replace(/\D/g, "");
  // Fast-pass: digits already visible in title/snippet. Otherwise fetch the page and verify.
  const verified = await Promise.all(
    candidates.map(async (h) => {
      const textDigits = digitsOnlyLocal(`${h.title} ${h.snippet}`);
      if (mustContainDigits && !textDigits.includes(mustContainDigits)) {
        const page = await getText(h.url);
        if (!page) return null;
        if (!digitsOnlyLocal(page).includes(mustContainDigits)) return null;
        for (const e of emailsIn(page)) {
          if (!out.emails.includes(e)) out.emails.push(e);
          if (out.emails.length >= 6) break;
        }
      }
      return h;
    })
  );

  for (const h of verified) {
    if (!h || out.pages.length >= 10) continue;
    out.pages.push(h);
    for (const [re, platform] of SOCIAL_HOSTS) {
      if (re.test(h.url)) out.links.push({ platform, url: h.url.split("?")[0] });
    }
    out.emails.push(...emailsIn(h.snippet));
  }
  out.emails = [...new Set(out.emails)];

  // de-dupe links
  const seenLinks = new Set<string>();
  out.links = out.links.filter((l) => !seenLinks.has(l.url) && seenLinks.add(l.url));
  return out;
}

/**
 * Public caller-ID directories that serve a page per reported number.
 * 404 = the number simply isn't listed there - a clean negative signal.
 */
const PHONE_DIRECTORIES: { name: string; url: (d: string) => string }[] = [
  { name: "800notes", url: (d) => `https://800notes.com/Phone.aspx/1-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` },
  { name: "WhoCallsMe", url: (d) => `https://whocallsme.com/Phone-Number.aspx/${d}` },
];

async function directoryMentions(digits: string): Promise<SearchHit[]> {
  const hits = await Promise.all(
    PHONE_DIRECTORIES.map(async ({ name, url }) => {
      const u = url(digits);
      const html = await getText(u);
      if (!html) return null;
      const title = decodeEntities(
        (html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? `${name} reports`).trim()
      );
      const desc = decodeEntities(
        (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ?? "").trim()
      );
      return {
        title,
        url: u,
        snippet: desc || `Community-reported calls and comments about this number on ${name}.`,
      };
    })
  );
  return hits.filter((h): h is SearchHit => h !== null);
}

/** Phone-specific web search - queries common written formats of the number. */
export async function phoneWebMentions(digits: string): Promise<WebMentions> {
  const fmt = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  const merged: WebMentions = { emails: [], links: [], pages: [] };
  merged.pages.push(...(await directoryMentions(digits)));
  for (const q of [digits, fmt]) {
    const r = await webMentions(q, digits);
    merged.emails.push(...r.emails);
    merged.links.push(...r.links);
    merged.pages.push(...r.pages);
    if (merged.pages.length >= 8) break;
  }
  merged.emails = [...new Set(merged.emails)];
  merged.pages = merged.pages.filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i).slice(0, 10);
  merged.links = merged.links.filter((l, i, a) => a.findIndex((x) => x.url === l.url) === i);
  return merged;
}
