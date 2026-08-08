"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  getAllLanguages,
  isRtlLanguage,
  languageName,
  nativeLanguageName,
} from "./language-catalog";
import type { LanguageRow } from "./LanguagesListPanel";

const LANGUAGES_HREF = "/admin/languages";

export function AddLanguagePanel({ supported }: { supported: LanguageRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedCodes = useMemo(
    () => new Set(supported.map((row) => row.locale)),
    [supported],
  );

  const available = useMemo(
    () => getAllLanguages().filter((language) => !supportedCodes.has(language.code)),
    [supportedCodes],
  );

  const supportedList = useMemo(
    () =>
      supported
        .map((row) => ({ code: row.locale, name: languageName(row.locale), isDefault: row.isDefault }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name)),
    [supported],
  );

  async function onAdd() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/locales/metadata/${selected}`,
        { nativeName: nativeLanguageName(selected), isRtl: isRtlLanguage(selected) },
        "locale-add-language",
        { successMessage: `${languageName(selected)} added.` },
      );
      router.push(LANGUAGES_HREF);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not add the language. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Link href={LANGUAGES_HREF} prefetch={false} className="text-[var(--admin-primary)] transition-colors hover:opacity-80">
          Languages
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">/</span>
        <span className="text-[var(--admin-on-surface-variant)]">Add Language</span>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
          Add Language
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Add language for translation</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Supported Languages</h2>
        <ul className="divide-y divide-[var(--admin-border)] border-b border-[var(--admin-border)]">
          {supportedList.length === 0 ? (
            <li className="py-3 text-sm text-[var(--admin-on-surface-variant)]">No languages added yet.</li>
          ) : (
            supportedList.map((language) => (
              <li key={language.code} className="flex items-center justify-between gap-3 py-3">
                <span className="font-medium text-[var(--admin-on-surface)]">{language.name}</span>
                {language.isDefault ? (
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] px-2 py-0.5 text-xs font-semibold text-[var(--admin-primary)]">
                    Default
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Other Languages</h2>
        <LanguageSelect available={available} value={selected} onChange={setSelected} />
      </section>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!selected || saving}
          onClick={() => void onAdd()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-100 disabled:shadow-none"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Add language
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            router.push(LANGUAGES_HREF);
          }}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LanguageSelect({
  available,
  value,
  onChange,
}: {
  available: ReadonlyArray<{ code: string; name: string; nativeName: string }>;
  value: string | null;
  onChange: (code: string) => void;
}) {
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
    if (!normalized) return available;
    return available.filter(
      (language) =>
        language.name.toLowerCase().includes(normalized) ||
        language.nativeName.toLowerCase().includes(normalized) ||
        language.code.toLowerCase().includes(normalized),
    );
  }, [available, query]);

  return (
    <DropdownField
      label={<span className="sr-only">Select other language</span>}
      labelId="language-select"
      open={open}
      onToggle={() => {
        setOpen((current) => !current);
      }}
      triggerContent={value ? languageName(value) : "Select Other Language"}
      panelRole="listbox"
      panelAriaLabel="Languages"
    >
      <div className="shrink-0 border-b border-[var(--admin-border)] p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search languages"
            aria-label="Search languages"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2 pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Languages">
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No languages match your search.
          </p>
        ) : (
          filtered.map((language) => {
            const active = language.code === value;
            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(language.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                }`}
              >
                <span className="min-w-0 truncate">
                  {language.name}
                  {language.nativeName && language.nativeName !== language.name ? (
                    <span className="text-[var(--admin-on-surface-variant)]"> · {language.nativeName}</span>
                  ) : null}
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
