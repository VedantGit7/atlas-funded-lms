"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import { currencyName, getAllCurrencies } from "./currency-options";

/**
 * Currency picker built on the shared animated DropdownField primitive (portaled,
 * transition-respecting panel) rather than a native select, per the admin
 * frontend rules. Searchable because the catalog spans every ISO 4217 currency.
 */
export function CurrencyDropdown({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const currencies = useMemo(() => getAllCurrencies(), []);
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
    if (!normalized) return currencies;
    return currencies.filter(
      (currency) =>
        currency.name.toLowerCase().includes(normalized) ||
        currency.code.toLowerCase().includes(normalized),
    );
  }, [currencies, query]);

  const selectedName = currencyName(value);

  return (
    <DropdownField
      label={
        <span className="text-sm font-bold text-[var(--admin-on-surface)]">
          Currency<span className="text-[var(--admin-danger)]">*</span>
        </span>
      }
      labelId={id}
      open={open}
      onToggle={() => {
        setOpen((current) => !current);
      }}
      triggerContent={selectedName ? `${selectedName} (${value})` : "Select currency"}
      panelRole="listbox"
      panelAriaLabel="Currencies"
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
            placeholder="Search currencies"
            aria-label="Search currencies"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2 pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Currencies">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No currencies match your search.
          </p>
        ) : (
          filtered.map((currency) => {
            const active = currency.code === value;
            return (
              <button
                key={currency.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(currency.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                }`}
              >
                <span className="min-w-0 truncate">
                  {currency.name}{" "}
                  <span className="text-[var(--admin-on-surface-variant)]">({currency.code})</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            );
          })
        )}
      </div>
    </DropdownField>
  );
}
