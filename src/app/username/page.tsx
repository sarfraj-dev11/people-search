import { lookupUsername } from "@/lib/repo";
import LookupBar from "@/components/LookupBar";

export default async function UsernamePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const username = String(sp.u ?? "").trim();
  const result = username ? await lookupUsername(username) : null;
  const searched = username.length > 0;

  return (
    <div className="shell py-10 sm:py-14 max-w-2xl">
      <div className="flex justify-center">
        <LookupBar initialMode="username" initial={username} />
      </div>

      <div className="mt-10">
        {!searched ? (
          <p className="text-center text-mist">Enter a username to find matching public profiles.</p>
        ) : !result ? (
          <div className="glass rounded-2xl p-10 text-center">
            <h1 className="text-xl font-bold text-frost">Invalid username</h1>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="border-b border-line bg-gradient-to-br from-accent/10 via-transparent to-accent-2/10 px-6 py-6">
              <h1 className="text-2xl font-bold text-frost mono-num">@{result.username}</h1>
              <p className="mt-1.5 text-xs text-mist">
                {result.profiles.length} verified public profile
                {result.profiles.length === 1 ? "" : "s"} found
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-3">
              {result.profiles.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-line bg-ink-2/60 p-4 flex gap-4 items-center hover:border-accent/50 transition-colors"
                >
                  {p.avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar} alt="" className="size-12 rounded-full border border-line" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-frost">{p.name ?? p.username}</p>
                    {p.bio && <p className="text-sm text-mist line-clamp-1">{p.bio}</p>}
                    <p className="mt-0.5 text-xs text-mist">
                      {[p.stats, p.location].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[11px] text-accent">{p.platform} · verified</p>
                  </div>
                </a>
              ))}

              <div className="rounded-xl border border-line bg-ink-2/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
                  Check these platforms
                </p>
                <p className="mt-1 text-xs text-mist/70">
                  Direct links — we don&apos;t scrape, so open them to see if the username exists.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.links.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-frost hover:border-accent hover:text-accent transition-colors"
                    >
                      {l.platform} →
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
