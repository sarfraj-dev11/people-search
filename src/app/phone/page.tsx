import { lookupPhone } from "@/lib/repo";
import PhoneInput from "@/components/PhoneInput";

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
        <PhoneInput initial={phone} />
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
            </dl>

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
      </div>
    </div>
  );
}
