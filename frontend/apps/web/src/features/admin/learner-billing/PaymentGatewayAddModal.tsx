"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { PAYMENT_GATEWAY_CATALOG } from "@atlas/domain-config/schemas/payment-gateway-catalog";
import { PaymentGatewayLogo } from "./PaymentGatewayLogo";

type PaymentGatewayAddModalProps = {
  open: boolean;
  addedKeys: ReadonlySet<string>;
  busy: boolean;
  error: string | null;
  onSave: (gatewayKey: string) => void;
  onCancel: () => void;
};

export function PaymentGatewayAddModal({
  open,
  addedKeys,
  busy,
  error,
  onSave,
  onCancel,
}: PaymentGatewayAddModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setQuery("");
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 40);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy, onCancel]);

  const available = useMemo(
    () => PAYMENT_GATEWAY_CATALOG.filter((entry) => !addedKeys.has(entry.key)),
    [addedKeys],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return available;
    return available.filter(
      (entry) =>
        entry.name.toLowerCase().includes(normalized) ||
        entry.region.toLowerCase().includes(normalized) ||
        entry.key.includes(normalized),
    );
  }, [available, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-gateway-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id="add-gateway-title" className="text-lg font-bold text-[var(--admin-on-surface)]">
              Payment Gateway
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Select a payment gateway for your school.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search payment gateways"
              aria-label="Search payment gateways"
              className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Payment gateways"
          className="mt-3 flex-1 space-y-1.5 overflow-y-auto px-6 pb-2"
        >
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No payment gateways match your search.
            </p>
          ) : (
            filtered.map((entry) => {
              const active = selected === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setSelected(entry.key);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                    active
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
                  }`}
                >
                  <PaymentGatewayLogo gatewayKey={entry.key} name={entry.name} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {entry.name}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {entry.region}
                    </span>
                  </span>
                  {active ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary)] text-[var(--admin-on-primary)]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {error ? (
          <p role="alert" className="px-6 pb-1 text-sm font-medium text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => {
              if (selected) onSave(selected);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <RefreshCw
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Adding
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
