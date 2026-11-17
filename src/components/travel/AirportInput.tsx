"use client";

import { useState } from "react";
import { useAirports } from "./useTravel";
import { searchAirports } from "@/lib/geo";

/** Type a code or a city; picking a match fills in both the code and the city. */
export function AirportInput({
  code,
  name,
  onChange,
  label,
  placeholder,
}: {
  code: string;
  name: string;
  onChange: (code: string, name: string) => void;
  label: string;
  placeholder?: string;
}) {
  const airports = useAirports();
  const [q, setQ] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const text = q ?? (code ? `${code}${name ? ` · ${name}` : ""}` : name);
  const matches = q && airports ? searchAirports(airports, q, 7) : [];
  const known = code && airports?.get(code.toUpperCase());

  function pick(i: number) {
    const a = matches[i];
    if (!a) return;
    onChange(a.code, a.city || a.name);
    setQ(null);
  }

  return (
    <div className="airport-input">
      <input
        className="input"
        value={text}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setActive(0);
          // A bare 3-letter code counts right away, even if it's not in our list.
          if (/^[a-z]{3}$/i.test(v.trim())) onChange(v.trim().toUpperCase(), airports?.get(v.trim().toUpperCase())?.city ?? name);
          else if (!v.trim()) onChange("", "");
        }}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(matches.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === "Enter") { e.preventDefault(); pick(active); }
          if (e.key === "Escape") { e.stopPropagation(); setQ(null); }
        }}
        onBlur={() => setTimeout(() => setQ(null), 150)}
      />
      {matches.length > 0 && (
        <div className="airport-menu" role="listbox">
          {matches.map((a, i) => (
            <button key={a.code} type="button" role="option" aria-selected={i === active} className={i === active ? "active" : undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(i)}>
              <strong>{a.code}</strong>
              <span className="truncate">{a.city || a.name}<span className="tiny muted"> · {a.name}</span></span>
            </button>
          ))}
        </div>
      )}
      {code && !q && airports && !known && <span className="tiny muted">Not in our airport list, so distances won&apos;t show for {code}.</span>}
    </div>
  );
}
