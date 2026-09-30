import { lookupPhone } from "@/lib/repo";
import LookupBar from "@/components/LookupBar";

const LINE_LABELS: Record<string, string> = {
  fixed_line_or_mobile: "Landline or Mobile",
  fixed_line: "Landline",
  mobile: "Mobile",
  voip: "VoIP",
  toll_free: "Toll-Free",
};

const CONFIDENCE = {
  high: { label: "High confidence", cls: "text-good bg-good/10 border-good/30" },
  medium: { label: "Medium confidence", cls: "text-warn bg-warn/10 border-warn/30" },
  low: { label: "Low confidence", cls: "text-bad bg-bad/10 border-bad/30" },
} as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-ink-2/60 px-4 py-3.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-mist">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium text-frost">{value}</dd>
    </div>
  );
}

export default async function PhonePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const phone = String(sp.phone ?? "").trim();
  const result = phone ? await lookupPhone(phone) : null;
  const searched = phone.length > 0;

  const conf = result ? CONFIDENCE[result.confidence] : null;

  return (
    <div className="shell py-10 sm:py-14 max-w-2xl">
      <div className="flex justify-center">
        <LookupBar initialMode="phone" initial={phone} />
      </div>

      <div className="mt-10">
        {!searched ? (
          <p className="text-center text-mist">Enter a US number above to trace it.</p>
        ) : !result ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="mono-num text-lg text-frost">{phone}</p>
            <h1 className="mt-3 text-xl font-bold text-frost">No record found</h1>
            <p className="mt-2 text-sm text-mist max-w-md mx-auto leading-relaxed">
              The carrier lookup returned nothing for that number — it may be unassigned or
              outside CNAM coverage. We never invent a result.
            </p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            {/* identity header */}
            <div className="border-b border-line bg-gradient-to-br from-accent/10 via-transparent to-accent-2/10 px-6 py-7 sm:px-8">
              <p className="mono-num text-sm text-mist">{result.phone}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-frost">
                  {result.cnam ??
                    (result.genericName ? "No name on record" : "Unregistered caller")}
                </h1>
                {conf && (
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${conf.cls}`}>
                    {conf.label}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-mist">
                {result.cnam
                  ? "Registered caller name (carrier CNAM billing record)"
                  : result.genericName
                    ? "This number's CNAM entry is a generic carrier label, not a person"
                    : "No caller name is registered for this number"}
              </p>
            </div>

            {/* detail grid */}
            <dl className="grid sm:grid-cols-2 gap-3 p-5 sm:p-6">
              <Field
                label="Status"
                value={
                  result.valid ? (
                    <span className="text-good">Active · valid number</span>
                  ) : (
                    <span className="text-bad">Invalid / unassigned</span>
                  )
                }
              />
              <Field
                label="Location"
                value={
                  result.city || result.state
                    ? [result.city, result.state].filter(Boolean).join(", ")
                    : "Not reported"
                }
              />
              <Field
                label="Carrier"
                value={result.carrier ?? "Not reported"}
              />
              {result.network && (
                <Field label="Underlying network" value={result.network} />
              )}
              <Field
                label="Line type"
                value={LINE_LABELS[result.lineType ?? ""] ?? result.lineType ?? "Unknown"}
              />
              {result.activeStatus && (
                <Field
                  label="Line status"
                  value={
                    /active/i.test(result.activeStatus) ? (
                      <span className="text-good">{result.activeStatus}</span>
                    ) : (
                      <span className="text-warn">{result.activeStatus}</span>
                    )
                  }
                />
              )}
              <Field
                label="Spam risk"
                value={
                  result.riskLevel ? (
                    <span
                      className={
                        result.riskLevel === "high"
                          ? "text-bad"
                          : result.riskLevel === "medium"
                            ? "text-warn"
                            : "text-good"
                      }
                    >
                      {result.riskLevel[0].toUpperCase() + result.riskLevel.slice(1)}
                      {result.spamScore != null && ` · ${result.spamScore}/100`}
                    </span>
                  ) : (
                    "Not scored"
                  )
                }
              />
              {result.fraudScore != null && (
                <Field
                  label="Fraud score"
                  value={
                    <span
                      className={
                        result.fraudScore >= 75
                          ? "text-bad"
                          : result.fraudScore >= 40
                            ? "text-warn"
                            : "text-good"
                      }
                    >
                      {result.fraudScore}/100
                    </span>
                  }
                />
              )}
              {result.zip && <Field label="ZIP" value={result.zip} />}
              {result.timezone && <Field label="Timezone" value={result.timezone} />}
            </dl>

            {result.flags && Object.values(result.flags).some(Boolean) && (
              <div className="border-t border-line px-5 sm:px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["voip", "VoIP"],
                    ["disposable", "Disposable / burner"],
                    ["prepaid", "Prepaid"],
                    ["tollFree", "Toll-free"],
                    ["doNotCall", "Do-Not-Call list"],
                    ["leaked", "Leaked online"],
                    ["spammer", "Reported spammer"],
                    ["recentAbuse", "Recent abuse"],
                  ] as const).map(([k, label]) =>
                    result.flags![k] ? (
                      <span
                        key={k}
                        className="rounded-full border border-bad/40 bg-bad/10 px-3 py-1 text-[11px] font-medium text-bad"
                      >
                        {label}
                      </span>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {(result.extraEmails.length > 0 || result.extraNames.length > 0) && (
              <div className="border-t border-line px-5 sm:px-6 py-4">
                {result.extraNames.length > 0 && (
                  <p className="text-xs text-mist">
                    Also associated:{" "}
                    <span className="text-frost">{result.extraNames.join(", ")}</span>
                  </p>
                )}
                {result.extraEmails.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-mist">Emails linked by carrier/reputation data</p>
                    {result.extraEmails.map((e) => (
                      <p key={e} className="mono-num text-sm text-accent break-all">{e}</p>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-mist/60">
                  Carrier/reputation data — not identity-verified.
                </p>
              </div>
            )}

            <div className="border-t border-line px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mist/80">
              <span>Source: {result.sourceLabel}</span>
              <span className="hidden sm:inline">·</span>
              <span>
                CNAM shows the carrier&apos;s billing name — accurate for landlines/businesses,
                sometimes stale for mobiles.
              </span>
            </div>
          </div>
        )}

        {result?.person && (
          <div className="glass rounded-2xl mt-6 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
              Matched profile
            </p>
            {result.person.name && (
              <p className="mt-3 text-xl font-semibold text-frost">{result.person.name}</p>
            )}
            {(result.person.jobTitle || result.person.company) && (
              <p className="mt-1 text-xs text-mist">
                {[result.person.jobTitle, result.person.company].filter(Boolean).join(" · ")}
              </p>
            )}
            {result.person.address && (
              <p className="mt-1 text-xs text-mist">{result.person.address}</p>
            )}
            {result.person.emails.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Emails</p>
                <div className="space-y-1.5">
                  {result.person.emails.map((e) => (
                    <p key={e} className="mono-num text-sm text-accent break-all">{e}</p>
                  ))}
                </div>
              </div>
            )}
            {result.person.phones.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Other numbers</p>
                <div className="flex flex-wrap gap-2">
                  {result.person.phones.map((p) => (
                    <a
                      key={p}
                      href={`/phone?phone=${encodeURIComponent(p)}`}
                      className="mono-num rounded-full border border-line px-3 py-1.5 text-xs text-frost hover:border-accent hover:text-accent transition-colors"
                    >
                      {p}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {result.person.profiles.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Profiles</p>
                <div className="flex flex-wrap gap-2">
                  {result.person.profiles.map((l) => (
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
            )}
            <p className="mt-4 text-[10px] text-mist/60 leading-relaxed">
              Aggregated public-record profile (PeopleDataLabs) — a confident match, but
              records can be stale or merged across household members.
            </p>
          </div>
        )}

        {result?.web && (result.web.emails.length > 0 || result.web.phones.length > 0 || result.web.links.length > 0 || result.web.pages.length > 0) && (
          <div className="glass rounded-2xl mt-6 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-mist">
              Found on the public web
            </p>

            {result.web.emails.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-mist mb-2">Emails on pages mentioning this number</p>
                <div className="space-y-1.5">
                  {result.web.emails.slice(0, 5).map((e) => (
                    <p key={e} className="mono-num text-sm text-accent break-all">{e}</p>
                  ))}
                </div>
              </div>
            )}

            {result.web.phones.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Other numbers on those pages</p>
                <div className="flex flex-wrap gap-2">
                  {result.web.phones.map((p) => (
                    <a
                      key={p}
                      href={`/phone?phone=${encodeURIComponent(p)}`}
                      className="mono-num rounded-full border border-line px-3 py-1.5 text-xs text-frost hover:border-accent hover:text-accent transition-colors"
                    >
                      {p}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {result.web.links.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Possible profiles</p>
                <div className="flex flex-wrap gap-2">
                  {result.web.links.map((l) => (
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
            )}

            {result.web.pages.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-mist mb-2">Pages mentioning this number</p>
                <div className="space-y-2">
                  {result.web.pages.slice(0, 6).map((p) => (
                    <a
                      key={p.url}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <span className="block text-xs text-frost/80 group-hover:text-accent truncate transition-colors">
                        {p.title || p.url}
                      </span>
                      {p.snippet && (
                        <span className="block text-[11px] text-mist/70 line-clamp-3 mt-0.5">
                          {p.snippet}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-[10px] text-mist/60 leading-relaxed">
              Public web mentions only — appearing on the same page does not verify the
              email or profile belongs to the number&apos;s owner.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
