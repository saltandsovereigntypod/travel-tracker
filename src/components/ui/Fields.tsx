"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { Place } from "@/lib/types";
import { searchPlaces, type PlaceResult } from "@/lib/services";
import { initials } from "@/lib/format";

export function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={clsx("field", full && "field-full")}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Avatar({
  name,
  color,
  src,
  size = 32,
  ring,
  title,
}: {
  name: string;
  color?: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  title?: string;
}) {
  return (
    <span
      className={clsx("avatar", ring && "avatar-ring")}
      title={title ?? name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: color ?? "var(--accent)" }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function PersonPicker({
  people,
  value,
  onChange,
  nameOf,
  colorOf,
}: {
  people: string[];
  value: string[];
  onChange: (ids: string[]) => void;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}) {
  return (
    <div className="chip-row">
      {people.map((id) => {
        const on = value.includes(id);
        return (
          <button
            type="button"
            key={id}
            className={clsx("chip chip-toggle", on && "chip-on")}
            onClick={() => onChange(on ? value.filter((v) => v !== id) : [...value, id])}
            aria-pressed={on}
          >
            <Avatar name={nameOf(id)} color={colorOf(id)} size={20} />
            {nameOf(id)}
          </button>
        );
      })}
    </div>
  );
}

/** Search-as-you-type place picker backed by OpenStreetMap data. */
export function PlaceSearch({
  value,
  onChange,
  near,
  placeholder = "Search for a place or address",
}: {
  value: Place;
  onChange: (p: Place) => void;
  near?: { lat: number; lng: number } | null;
  placeholder?: string;
}) {
  const [q, setQ] = useState(value?.name || value?.address || "");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = (text: string) => {
    setQ(text);
    onChange({ name: text });
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await searchPlaces(text, near));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 350);
  };

  return (
    <div className="place-search">
      <div className="input-icon">
        <MapPin size={16} />
        <input
          className="input"
          value={q}
          placeholder={placeholder}
          onChange={(e) => run(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {busy && <Loader2 size={16} className="spin" />}
      </div>
      {value?.lat != null && <span className="field-hint">📍 Pinned on the map{value.address ? ` · ${value.address}` : ""}</span>}
      {open && results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ name: r.name, address: r.address, lat: r.lat, lng: r.lng });
                  setQ(r.name ?? "");
                  setOpen(false);
                }}
              >
                <strong>{r.name}</strong>
                <span>{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size,
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm";
}) {
  return (
    <div className={clsx("segmented", size === "sm" && "segmented-sm")} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={clsx(o.value === value && "on")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Text that saves itself shortly after you stop typing. */
export function AutoTextarea({
  value,
  onSave,
  placeholder,
  rows = 4,
  disabled,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Take outside updates (from collaborators) when not mid-edit.
  if (value !== lastValue) {
    setLastValue(value);
    if (!dirty) setText(value);
  }

  return (
    <textarea
      className={clsx("input textarea", className)}
      value={text}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        setDirty(true);
        if (timer.current) clearTimeout(timer.current);
        const v = e.target.value;
        timer.current = setTimeout(() => {
          onSave(v);
          setDirty(false);
        }, 700);
      }}
      onBlur={() => {
        if (dirty) {
          if (timer.current) clearTimeout(timer.current);
          onSave(text);
          setDirty(false);
        }
      }}
    />
  );
}
