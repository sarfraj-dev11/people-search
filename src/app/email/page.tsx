import { lookupEmail } from "@/lib/repo";
import LookupBar from "@/components/LookupBar";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const email = String(sp.email ?? "").trim();
  const result = email ? await lookupEmail(email) : null;
  const searched = email.length > 0;
  const found = result && (result.gravatar || result.github.length > 0);

  return (
    <div className="shell py-10 sm:py-14 max-w-2xl">
      <div className="flex justify-center">
        <LookupBar initialMode="email" initial={email} />
      </div>

      <div className="mt-10">
        {!searched ? (
          <p className="text-center text-mist">Enter an email to trace its public footprint.</p>
        ) : !result ? (
          <div className="glass rounded-2xl p-10 text-center">
            <h1 className="text-xl font-bold text-frost">Invalid email</h1>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="border-b border-line bg-gradient-to-br from-accent/10 via-transparent to-accent-2/10 px-6 py-6">
              <p className="mono-num text-sm text-mist break-all">{result.email}</p>
              <h1 className="mt-2 text-2xl font-bold text-frost">
                {result.gravatar?.name ?? (found ? "Public profiles found" : "No public footprint")}
              </h1>
              <p className="mt-1.5 text-xs text-mist">
                Public-profile data only — Gravatar &amp; GitHub. Private emails can&apos;t be
                resolved to a person.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-3">
              {result.gravatar && (
                <div className="rounded-xl border border-line bg-ink-2/60 p-4 flex gap-4 items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.gravatar.avatar ?? ""}
                    alt=""
                    className="size-14 rounded-full border border-line object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-frost">
                      {result.gravatar.name ?? result.gravatar.username ?? "Gravatar profile"}
                    </p>
                    {result.gravatar.location && (
                      <p className="text-sm text-mist">{result.gravatar.location}</p>
                    )}
                    {result.gravatar.bio && (
                      <p className="mt-1 text-xs text-mist line-clamp-2">{result.gravatar.bio}</p>
                    )}
                    <p className="mt-1 text-[11px] text-accent">gravatar.com</p>
                  </div>
                </div>
              )}

              {result.gravatar && result.gravatar.accounts.length > 0 && (
                <div className="rounded-xl border border-line bg-ink-2/60 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
                    Linked public accounts
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.gravatar.accounts.map((a) => (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-line px-3 py-1 text-xs text-frost hover:border-accent hover:text-accent transition-colors"
                      >
                        {a.platform}{a.username ? ` · ${a.username}` : ""}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {result.github.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-line bg-ink-2/60 p-4 flex gap-4 items-center hover:border-accent/50 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar ?? ""} alt="" className="size-12 rounded-full border border-line" />
                  <div className="min-w-0">
                    <p className="font-semibold text-frost">{p.username}</p>
                    {p.stats && <p className="text-xs text-mist">{p.stats}</p>}
                    <p className="mt-0.5 text-[11px] text-accent">{p.platform}</p>
                  </div>
                </a>
              ))}

              {!found && (
                <p className="text-sm text-mist text-center py-4">
                  No public Gravatar or GitHub profile is registered to this email.
                  That&apos;s normal — most emails have no public footprint.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
