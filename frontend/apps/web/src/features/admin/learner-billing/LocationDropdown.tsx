"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import { getAllLocations, locationTitle } from "./location-options";

/** Animated location (country) picker on the shared DropdownField primitive. */
export function LocationDropdown({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string | null;
  onChange: (key: string) => void;
}) {
  const locations = useMemo(() => getAllLocations(), []);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return locations;
    return locations.filter(
      (location) =>
        location.title.toLowerCase().includes(normalized) ||
        location.key.toLowerCase().includes(normalized),
    );
  }, [locations, query]);

  return (
    <DropdownField
      label={
        <span className="text-sm font-bold text-[var(--admin-on-surface)]">
          Location<span className="text-[var(--admin-danger)]">*</span>
        </span>
      }
      labelId={id}
      open={open}
      onToggle={() => {
        setOpen((current) => !current);
      }}
      triggerContent={value ? locationTitle(value) : "Select location"}
      panelRole="listbox"
      panelAriaLabel="Locations"
    >
      <div className="shrink-0 border-b border-[var(--admin-border)] p-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search locations"
            aria-label="Search locations"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2 pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Locations">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No locations match your search.
          </p>
        ) : (
          filtered.map((location) => {
            const active = location.key === value;
            return (
              <button
                key={location.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(location.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {location.flag}
                </span>
                <span className="min-w-0 flex-1 truncate">{location.title}</span>
                {active ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })
        )}
      </div>
    </DropdownField>
  );
}
