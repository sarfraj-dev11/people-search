"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "phone" | "email" | "username" | "address";

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: "phone", label: "Phone", placeholder: "Enter a phone number" },
  { id: "email", label: "Email", placeholder: "Enter an email address" },
  { id: "username", label: "Username", placeholder: "Enter a username" },
  { id: "address", label: "Address", placeholder: "Enter a street address" },
];

function formatUs(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function LookupBar({
  initialMode = "phone",
  initial = "",
  large = false,
}: {
  initialMode?: Mode;
  initial?: string;
  large?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [value, setValue] = useState(initialMode === "phone" ? formatUs(initial) : initial);
  const [error, setError] = useState("");

  const current = MODES.find((m) => m.id === mode)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) { setError("Enter something to search"); return; }
    if (mode === "phone") {
      const digits = v.replace(/\D/g, "").slice(-10);
      if (digits.length !== 10) { setError("Enter a 10-digit US number"); return; }
      router.push(`/phone?phone=${digits}`);
    } else if (mode === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setError("Enter a valid email"); return; }
      router.push(`/email?email=${encodeURIComponent(v)}`);
    } else if (mode === "username") {
      const u = v.replace(/^@/, "");
      if (!/^[A-Za-z0-9._-]{2,30}$/.test(u)) { setError("Enter a valid username"); return; }
      router.push(`/username?u=${encodeURIComponent(u)}`);
    } else {
      router.push(`/address?address=${encodeURIComponent(v)}`);
    }
  }

  return (
    <div className="w-full">
      <div className="flex justify-center gap-1 mb-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setMode(m.id); setValue(""); setError(""); }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              mode === m.id
                ? "bg-frost text-ink"
                : "text-mist hover:text-frost border border-line"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <div
          data-phone-input
          className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-xl p-2 pl-6 shadow-[0_20px_60px_-15px_rgba(2,6,23,0.5)]"
        >
          <input
            value={value}
            onChange={(e) => {
              const raw = e.target.value;
              setValue(mode === "phone" ? formatUs(raw.replace(/\D/g, "")) : raw);
              setError("");
            }}
            inputMode={mode === "phone" ? "tel" : "text"}
            autoComplete="off"
            placeholder={current.placeholder}
            aria-label={current.label}
            className={`min-w-0 flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 outline-none ${
              mode === "phone" ? "mono-num " : ""
            }${large ? "py-3 text-base sm:text-lg" : "py-2 text-sm"}`}
          />
          <button
            type="submit"
            className={`shrink-0 rounded-full bg-ink font-semibold text-white hover:bg-slate-800 transition-colors ${
              large ? "px-7 py-3 text-sm sm:text-base" : "px-5 py-2 text-sm"
            }`}
          >
            Search
          </button>
        </div>
      </form>
      {error && <p className="mt-2.5 text-center text-sm text-bad">{error}</p>}
    </div>
  );
}
