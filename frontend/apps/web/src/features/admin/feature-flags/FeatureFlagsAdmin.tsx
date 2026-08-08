"use client";

import { History, Info, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FeatureFlagView } from "@atlas/domain-config/schemas/feature-flags";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  formatEffectiveFeatureFlagValue,
  getFeatureFlagPresentation,
  isBooleanFeatureFlagValue,
  matchesFeatureFlagFilter,
  parseFeatureFlagOverrideValue,
  serializeFeatureFlagOverrideValue,
} from "./feature-flag-catalogue";
import {
  PAGE_SIZE,
  cardClassName,
  cardHeaderClassName,
  columnLabelClassName,
  compactInputClassName,
  enabledBadgeClassName,
  fieldClassName,
  flagDescriptionClassName,
  flagKeyClassName,
  flagTitleClassName,
  infoBannerClassName,
  isEffectiveValueEnabled,
  paginationButtonClassName,
  primaryButtonClassName,
  resolveSourceBadge,
  rowClassName,
  saveButtonClassName,
  sourceBadgeClassName,
  statusBannerClassName,
} from "./feature-flags-admin-shared";

type FeatureFlagsAdminProps = {
  flags: FeatureFlagView[];
};

type PendingOverride = {
  flag: FeatureFlagView;
  rawValue: string;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function FeatureFlagsAdmin({ flags }: FeatureFlagsAdminProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(
    null,
  );
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);

  const filteredFlags = useMemo(
    () => flags.filter((flag) => matchesFeatureFlagFilter(flag, filter)),
    [flags, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredFlags.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageFlags = filteredFlags.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const rangeStart = filteredFlags.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredFlags.length);

  async function saveFlag(flag: FeatureFlagView, rawValue: string) {
    if (flag.readOnly) {
      setMessage({
        tone: "error",
        text: "This flag is entitlement-managed and read-only.",
      });
      return;
    }

    setBusyKey(flag.key);
    setMessage(null);

    try {
      const value = parseFeatureFlagOverrideValue(rawValue);
      await clientApi.put(
        `/api/v1/feature-flags/${encodeURIComponent(flag.key)}`,
        { value },
        `feature-flag-${flag.key}`,
      );
      setPendingOverride(null);
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: formatError(error) });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-[22px]">
              Feature Flags
            </h1>
            <span className="rounded-full bg-[var(--admin-primary-container)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-on-primary-container)]">
              {flags.length} {flags.length === 1 ? "flag" : "flags"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Review effective flag values and override tenant-level flags where permitted.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className={`${primaryButtonClassName} inline-flex items-center gap-2`}
        >
          <History className="h-4 w-4" aria-hidden="true" />
          Audit logs
        </Link>
      </header>

      <div className={infoBannerClassName}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--admin-on-primary-container)]">
          Entitlement-managed flags are read-only and governed by the current institution&apos;s
          license tier.
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className={`${statusBannerClassName} ${
            message.tone === "error"
              ? "border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]"
              : "border-[var(--admin-success)]/30 bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className={cardClassName}>
        <div className={cardHeaderClassName}>
          <h2 className="text-[15px] font-semibold text-[var(--admin-on-surface)]">Feature flags</h2>
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Filter flags..."
              aria-label="Filter feature flags"
              className={`${fieldClassName} py-2 pl-8 pr-3 text-xs motion-safe:transition-[width] motion-safe:duration-200 focus:w-full`}
            />
          </div>
        </div>

        <div className="hidden border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/40 px-6 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_9rem_11rem] sm:gap-6">
          <span className={columnLabelClassName}>Flag</span>
          <span className={columnLabelClassName}>Value</span>
          <span className={columnLabelClassName}>Source</span>
          <span className={columnLabelClassName}>Control</span>
        </div>

        <div className="divide-y divide-[var(--admin-border)]">
          {pageFlags.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
              No feature flags match your filter.
            </div>
          ) : (
            pageFlags.map((flag) => (
              <FeatureFlagRow
                key={flag.key}
                flag={flag}
                busy={busyKey === flag.key}
                onSave={(value) => {
                  setPendingOverride({ flag, rawValue: value });
                }}
              />
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {rangeStart}-{rangeEnd} of {filteredFlags.length}{" "}
            {filteredFlags.length === 1 ? "flag" : "flags"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={paginationButtonClassName(false)}
              disabled={currentPage <= 1}
              onClick={() => {
                setPage((value) => Math.max(1, value - 1));
              }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={paginationButtonClassName(pageNumber === currentPage)}
                onClick={() => {
                  setPage(pageNumber);
                }}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              className={paginationButtonClassName(false)}
              disabled={currentPage >= totalPages}
              onClick={() => {
                setPage((value) => Math.min(totalPages, value + 1));
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AdminConfirmDialog
        open={pendingOverride != null}
        title="Override feature flag?"
        description={
          pendingOverride
            ? `Save tenant override for "${getFeatureFlagPresentation(pendingOverride.flag).displayKey}" with value ${pendingOverride.rawValue}?`
            : ""
        }
        confirmLabel="Save override"
        busy={busyKey != null}
        onConfirm={() => {
          if (pendingOverride) {
            void saveFlag(pendingOverride.flag, pendingOverride.rawValue);
          }
        }}
        onCancel={() => {
          setPendingOverride(null);
        }}
      />
    </section>
  );
}

function FeatureFlagRow({
  flag,
  busy,
  onSave,
}: {
  flag: FeatureFlagView;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const presentation = getFeatureFlagPresentation(flag);
  const source = resolveSourceBadge(flag);
  const booleanValue = isBooleanFeatureFlagValue(flag.value);
  const enabled = isEffectiveValueEnabled(flag.value);
  const [value, setValue] = useState(serializeFeatureFlagOverrideValue(flag.value));

  return (
    <article className={rowClassName}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={flagTitleClassName}>{presentation.title}</p>
        <p className={flagKeyClassName}>{presentation.displayKey}</p>
        <p className={flagDescriptionClassName}>{presentation.description}</p>
        {presentation.hasInstanceKey ? (
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]/80">
            Instance key: {flag.key}
          </p>
        ) : null}
      </div>

      <div className="w-full sm:w-28">
        {booleanValue || (flag.value && typeof flag.value === "object" && "enabled" in flag.value) ? (
          <span className={enabledBadgeClassName(enabled)}>{enabled ? "Enabled" : "Disabled"}</span>
        ) : (
          <span className="inline-flex rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-xs text-[var(--admin-on-surface)]">
            {formatEffectiveFeatureFlagValue(flag.value)}
          </span>
        )}
      </div>

      <div className="w-full sm:w-36">
        <span className={sourceBadgeClassName(source.id)}>{source.label}</span>
      </div>

      <div className="w-full sm:w-44">
        {flag.readOnly ? (
          <div className="flex items-center gap-2 text-[var(--admin-on-surface-variant)]/70">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs italic">Entitlement-managed</span>
          </div>
        ) : booleanValue ? (
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={enabled}
              disabled={busy}
              onChange={(event) => {
                onSave(event.target.checked ? "true" : "false");
              }}
              aria-label={`Toggle ${presentation.displayKey}`}
            />
            <span className="h-5 w-9 rounded-full bg-[var(--admin-outline)] transition-colors peer-checked:bg-[var(--admin-primary-container)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--admin-primary)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-[var(--admin-border)] after:bg-[var(--admin-surface)] after:transition-transform peer-checked:after:translate-x-full" />
          </label>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSave(value);
            }}
          >
            <input
              className={`${compactInputClassName} min-w-[3rem] max-w-[6rem]`}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
              aria-label={`Override value for ${presentation.displayKey}`}
            />
            <button type="submit" className={saveButtonClassName} disabled={busy}>
              Save
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
