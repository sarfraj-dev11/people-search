"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function formatUs(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function PhoneInput({
  initial = "",
  large = false,
}: {
  initial?: string;
  large?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(() => formatUs(initial.replace(/\D/g, "").slice(-10)));
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = value.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      setError("Enter a 10-digit US number");
      return;
    }
    router.push(`/phone?phone=${digits}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div
        data-phone-input
        className="flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-xl p-2 pl-6 shadow-[0_20px_60px_-15px_rgba(2,6,23,0.5)]"
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(formatUs(e.target.value.replace(/\D/g, "")));
            setError("");
          }}
          inputMode="tel"
          autoComplete="tel"
          placeholder="Enter a phone number"
          aria-label="US phone number"
          className={`mono-num min-w-0 flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 outline-none ${
            large ? "py-3 text-base sm:text-lg" : "py-2 text-sm"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-ink font-semibold text-white hover:bg-slate-800 transition-colors ${
            large ? "px-7 py-3 text-sm sm:text-base" : "px-5 py-2 text-sm"
          }`}
        >
          Trace
        </button>
      </div>
      {error && <p className="mt-2.5 pl-2 text-sm text-bad">{error}</p>}
    </form>
  );
}
