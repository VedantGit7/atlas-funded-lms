"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Info, Loader2, Search, ShieldCheck, UserPlus, X } from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { searchLearners, type LearnerSearchResult } from "./learner-products-api";

export type EnrolSubmission = {
  membershipId: string;
  enrolledType: string;
  expiresAt?: string;
};

type LearnerProductEnrolDrawerProps = {
  open: boolean;
  productTitle: string;
  productKindLabel: string;
  productStatusLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (submission: EnrolSubmission) => void;
  onCancel: () => void;
};

/**
 * Enrolment types are free text on the API (`max(64)`), but these are the values
 * the billing and entitlement paths recognise, so the picker offers them rather
 * than inviting a typo that silently creates a class of enrolment nobody
 * reports on.
 */
const ENROLMENT_TYPES = [
  { value: "free", label: "Free", hint: "No charge, no invoice" },
  { value: "paid", label: "Paid", hint: "Already paid for elsewhere" },
  { value: "trial", label: "Trial", hint: "Time-boxed evaluation" },
  { value: "comp", label: "Complimentary", hint: "Granted by the school" },
] as const;

const fieldLabelClassName =
  "block text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

const fieldInputClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() ?? email?.split("@")[0] ?? "";
  if (!source) return "?";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * Places a learner into a product directly.
 *
 * A drawer rather than a modal because the operator is reading the product
 * behind it while they choose — and it is a two-step flow: pick the learner,
 * then confirm, because this grants paid access with no payment and no invoice,
 * and that is worth one deliberate pause.
 */
export function LearnerProductEnrolDrawer({
  open,
  productTitle,
  productKindLabel,
  productStatusLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: LearnerProductEnrolDrawerProps) {
  const headingId = useId();
  const searchFieldId = useId();
  const typeFieldId = useId();
  const expiryFieldId = useId();

  const searchRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<LearnerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LearnerSearchResult | null>(null);

  const [enrolledType, setEnrolledType] = useState<string>("free");
  const [expiresAt, setExpiresAt] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;

    setTerm("");
    setResults([]);
    setSelected(null);
    setEnrolledType("free");
    setExpiresAt("");
    setTypeOpen(false);
    setConfirming(false);
    setSearchError(null);

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();

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
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy, onCancel]);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    if (!open || selected) return;
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchLearners(trimmed)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setSearchError("Could not search learners.");
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, open, selected]);

  if (!open) return null;

  const selectedType = ENROLMENT_TYPES.find((entry) => entry.value === enrolledType);

  function submit() {
    if (!selected || busy) return;
    onSubmit({
      membershipId: selected.membershipId,
      enrolledType,
      // A date input yields a day; the API wants a datetime, and end of day
      // keeps access for the whole of the chosen date.
      ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59Z`).toISOString() } : {}),
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        aria-label="Cancel enrolment"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-drawer-in_0.24s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Enrol a learner
            </h2>
            <p className="mt-0.5 truncate text-sm text-[var(--admin-on-surface-variant)]">
              {productTitle} · {productKindLabel} · {productStatusLabel}
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
        </header>

        {confirming ? (
          <ConfirmStep
            learner={selected}
            productTitle={productTitle}
            enrolledType={selectedType?.label ?? enrolledType}
            expiresAt={expiresAt}
            busy={busy}
            error={error}
            onBack={() => {
              setConfirming(false);
            }}
            onConfirm={submit}
          />
        ) : (
          <>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div>
                <label className={fieldLabelClassName} htmlFor={searchFieldId}>
                  Learner
                </label>

                {selected ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-sm font-bold text-[var(--admin-on-primary-container)]">
                      {initials(selected.displayName, selected.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                        {selected.displayName ?? selected.email ?? "Unnamed learner"}
                      </span>
                      <span className="font-data block truncate text-xs text-[var(--admin-on-surface-variant)]">
                        {selected.email ?? selected.membershipId}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
                      aria-label="Choose a different learner"
                      onClick={() => {
                        setSelected(null);
                        setTerm("");
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-2">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <input
                        ref={searchRef}
                        id={searchFieldId}
                        type="search"
                        autoComplete="off"
                        className={`${fieldInputClassName} pl-9`}
                        placeholder="Search by name or email"
                        value={term}
                        onChange={(event) => {
                          setTerm(event.target.value);
                        }}
                      />
                      {searching ? (
                        <Loader2
                          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)] motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>

                    <p aria-live="polite" className="sr-only">
                      {searching
                        ? "Searching learners"
                        : `${String(results.length)} learners found`}
                    </p>

                    {searchError ? (
                      <p role="alert" className="mt-2 text-xs text-[var(--admin-danger)]">
                        {searchError}
                      </p>
                    ) : null}

                    {results.length > 0 ? (
                      <ul className="mt-2 divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl border border-[var(--admin-border)]">
                        {results.map((learner) => (
                          <li key={learner.membershipId}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:bg-[var(--admin-surface-high)] focus-visible:outline-none"
                              onClick={() => {
                                setSelected(learner);
                                setResults([]);
                              }}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                                {initials(learner.displayName, learner.email)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-[var(--admin-on-surface)]">
                                  {learner.displayName ?? learner.email ?? "Unnamed learner"}
                                </span>
                                <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                                  {learner.email ?? learner.membershipId}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {!searching && term.trim().length >= 2 && results.length === 0 ? (
                      <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                        No active learners match that search.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <DropdownField
                label={<span className={fieldLabelClassName}>Enrolment type</span>}
                labelId={typeFieldId}
                open={typeOpen}
                disabled={busy}
                portalZIndex={85}
                panelAriaLabel="Enrolment type"
                onToggle={() => {
                  setTypeOpen((previous) => !previous);
                }}
                triggerContent={selectedType?.label ?? "Free"}
              >
                <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                  {ENROLMENT_TYPES.map((entry) => (
                    <button
                      key={entry.value}
                      type="button"
                      role="option"
                      aria-selected={entry.value === enrolledType}
                      className={dropdownItemClassName}
                      onClick={() => {
                        setEnrolledType(entry.value);
                        setTypeOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{entry.label}</span>
                        <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                          {entry.hint}
                        </span>
                      </span>
                      {entry.value === enrolledType ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </DropdownField>

              <div>
                <label className={fieldLabelClassName} htmlFor={expiryFieldId}>
                  Access expires <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  id={expiryFieldId}
                  type="date"
                  className={`${fieldInputClassName} mt-2`}
                  value={expiresAt}
                  onChange={(event) => {
                    setExpiresAt(event.target.value);
                  }}
                />
                <p className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Leave empty for access that does not expire.
                </p>
              </div>

              <p className="flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                No payment is taken and no invoice is created.
              </p>
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
              <button type="button" onClick={onCancel} className={manageSecondaryButtonClassName}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!selected}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Continue
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function ConfirmStep({
  learner,
  productTitle,
  enrolledType,
  expiresAt,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  learner: LearnerSearchResult | null;
  productTitle: string;
  enrolledType: string;
  expiresAt: string;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const learnerName = learner?.displayName ?? learner?.email ?? "This learner";

  return (
    <>
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>

        <div>
          <h3 className="text-base font-bold text-[var(--admin-on-surface)]">Confirm enrolment</h3>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            <span className="font-semibold text-[var(--admin-on-surface)]">{learnerName}</span> will
            be enrolled into{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">{productTitle}</span>.
          </p>
        </div>

        <dl className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-[var(--admin-on-surface-variant)]">Membership</dt>
            <dd className="font-data truncate text-xs text-[var(--admin-on-surface)]">
              {learner?.membershipId ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-[var(--admin-on-surface-variant)]">Enrolment type</dt>
            <dd className="font-medium text-[var(--admin-on-surface)]">{enrolledType}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-[var(--admin-on-surface-variant)]">Access expires</dt>
            <dd className="font-medium text-[var(--admin-on-surface)]">{expiresAt || "Never"}</dd>
          </div>
        </dl>

        <p className="flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-3 text-xs text-[var(--admin-on-surface)]">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
            aria-hidden="true"
          />
          This grants access immediately. No payment is taken and no invoice is created.
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-sm font-medium text-[var(--admin-danger)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={onBack}
          className={manageSecondaryButtonClassName}
        >
          Go back
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={managePrimaryButtonClassName}
        >
          {busy ? "Enrolling…" : "Confirm and enrol"}
        </button>
      </footer>
    </>
  );
}
