import crypto from "node:crypto";

/**
 * Free, legal public-profile lookups — no scraping.
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
    stats: `${j.followers ?? 0} followers · ${j.public_repos ?? 0} repos`,
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

/** GitHub user search — works best with exact emails/usernames; unauth rate limits apply */
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
