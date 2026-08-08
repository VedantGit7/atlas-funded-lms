"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { CopySelectableItem } from "./copy-product-flows";

type CopySelectDialogProps = {
  open: boolean;
  title: string;
  emptyMessage: string;
  items: CopySelectableItem[];
  selectedIds: string[];
  multi?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (selected: CopySelectableItem[]) => void;
};

export function CopySelectDialog({
  open,
  title,
  emptyMessage,
  items,
  selectedIds,
  multi = false,
  busy = false,
  onClose,
  onConfirm,
}: CopySelectDialogProps) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (!open) return;
    setDraftIds(selectedIds);
    setQuery("");
    searchRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, selectedIds, onClose]);

  if (!open) return null;

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function toggle(id: string) {
    setDraftIds((previous) => {
      if (multi) {
        return previous.includes(id)
          ? previous.filter((value) => value !== id)
          : [...previous, id];
      }
      return previous.includes(id) ? [] : [id];
    });
  }

  function confirm() {
    const selected = items.filter((item) => draftIds.includes(item.id));
    onConfirm(selected);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-[var(--admin-scrim)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(32rem,85dvh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-[var(--admin-on-surface)]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-[var(--admin-border)] px-5 py-3">
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
              placeholder="Search"
              aria-label="Search"
              className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] py-2 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {busy ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
              Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
              {items.length === 0 ? emptyMessage : "No matches for your search."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((item) => {
                const selected = draftIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        toggle(item.id);
                      }}
                      className={[
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        selected
                          ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                          : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                      {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={draftIds.length === 0}
            onClick={confirm}
            className="rounded-lg bg-[var(--admin-on-surface)] px-4 py-2 text-sm font-bold text-[var(--admin-surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
