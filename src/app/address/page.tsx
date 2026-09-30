import { lookupAddress } from "@/lib/repo";
import LookupBar from "@/components/LookupBar";

const SOURCE_LABELS: Record<string, string> = {
  miamidade: "Miami-Dade Property Appraiser",
  philly: "Philadelphia OPA",
  acris: "NYC ACRIS",
};

export default async function AddressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const address = String(sp.address ?? "").trim();
  const where = String(sp.where ?? "").trim();
  const result = address ? await lookupAddress(address, where) : null;
  const searched = address.length > 0;

  return (
    <div className="shell py-10 sm:py-14 max-w-2xl">
      <div className="flex justify-center">
        <LookupBar initialMode="address" initial={address} />
      </div>

      <div className="mt-10">
        {!searched ? (
          <p className="text-center text-mist">
            Enter a street address — real county property records.
          </p>
        ) : !result || result.real.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <h1 className="text-xl font-bold text-frost">No public record for that address</h1>
            <p className="mt-2 text-sm text-mist max-w-md mx-auto">
              Coverage: Miami-Dade FL, Philadelphia PA, NYC deed records. We never invent results.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-mist mb-4">
              {result.real.length} real property record{result.real.length === 1 ? "" : "s"} for{" "}
              <span className="text-frost">{address}</span>
            </p>
            <div className="space-y-3">
              {result.real.slice(0, 15).map((p, i) => {
                const d = p.detail as Record<string, unknown>;
                return (
                  <div key={i} className="glass rounded-xl p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-frost">{p.address}</p>
                      <span className="rounded-full bg-good/10 border border-good/30 px-2 py-0.5 text-[10px] font-bold text-good">
                        PUBLIC RECORD
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-mist">
                      {[p.city, p.state, p.zip].filter(Boolean).join(", ")} ·{" "}
                      {SOURCE_LABELS[p.source] ?? p.source}
                    </p>
                    {p.owners.length > 0 && (
                      <p className="mt-2 text-sm text-frost">
                        Owner{p.owners.length > 1 ? "s" : ""}:{" "}
                        <span className="text-accent">{p.owners.join(", ")}</span>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-mist">
                      {[
                        d.market_value || d.total_value ? `Value $${Number(d.market_value ?? d.total_value).toLocaleString()}` : null,
                        d.year_built ? `Built ${d.year_built}` : null,
                        d.sale_price ? `Last sold $${Number(d.sale_price).toLocaleString()}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
