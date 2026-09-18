"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchCustomFieldLearnerDetail,
  formatMoney,
  sendCustomFieldReportMessage,
  updateCustomFieldLearnerValues,
  type CustomFieldLearnerDetailData,
  type CustomFieldLearnerField,
  type CustomFieldLearnerHistoryItem,
} from "./admin-custom-field-roster-api";

const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const labelClassName =
  "mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

type Mode = "view" | "edit";
type Variant = "page" | "drawer";

type Props = {
  membershipId: string;
  variant?: Variant;
  onClose?: () => void;
  initialMode?: Mode;
};

type DraftMap = Record<string, string>;

type ChangePreview = {
  definitionId: string;
  label: string;
  fieldType: string;
  before: string | null;
  after: string | null;
  valueJson: unknown;
};

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays < 1) {
    const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    if (absHours < 1) return "Just now";
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  if (absDays < 14) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absDays,
      "day",
    );
  }
  if (absDays < 60) {
    const weeks = Math.round(absDays / 7);
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * weeks,
      "week",
    );
  }
  return formatDateShort(value);
}

function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number" || normalized === "num") return "num";
  if (normalized === "boolean" || normalized === "bool" || normalized === "boo") return "boo";
  if (normalized === "select" || normalized === "sel") return "sel";
  if (normalized === "date" || normalized === "dat") return "dat";
  return "txt";
}

function statusPillClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (upper === "INACTIVE") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "INVITED" || upper === "PENDING") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "SUSPENDED" || upper === "REMOVED") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isAvatarUrl(value: string | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith("/");
}

function isTruthyBoolean(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

function unwrapValueJson(valueJson: unknown): unknown {
  if (valueJson != null && typeof valueJson === "object" && !Array.isArray(valueJson)) {
    const record = valueJson as Record<string, unknown>;
    if ("value" in record) return unwrapValueJson(record["value"]);
  }
  return valueJson;
}

/**
 * Custom-field values are `unknown` (free-form jsonb). A plain `String()` on an
 * object or array yields "[object Object]", which would be shown in an editable
 * input and then saved back over the real value.
 */
function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") return value.description ?? "";
  if (typeof value === "function") return "";
  return JSON.stringify(value);
}

function valueJsonToDraft(valueJson: unknown, fieldType: string): string {
  const raw = unwrapValueJson(valueJson);
  if (raw == null) return "";
  const type = fieldType.toLowerCase();
  if (type === "boolean" || type === "bool" || type === "boo") {
    if (typeof raw === "boolean") return raw ? "true" : "false";
    return isTruthyBoolean(stringifyFieldValue(raw)) ? "true" : "false";
  }
  if (type === "date" || type === "dat") {
    const text = stringifyFieldValue(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return text;
  }
  if (typeof raw === "boolean" || typeof raw === "number") return String(raw);
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return "";
  }
}

function draftToValueJson(draft: string, fieldType: string): unknown {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  const type = fieldType.toLowerCase();
  if (type === "number" || type === "num") {
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (type === "boolean" || type === "bool" || type === "boo") {
    return isTruthyBoolean(trimmed);
  }
  return trimmed;
}

function displayValueForDraft(draft: string, fieldType: string): string | null {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  const type = fieldType.toLowerCase();
  if (type === "boolean" || type === "bool" || type === "boo") {
    return isTruthyBoolean(trimmed) ? "Yes" : "No";
  }
  if (type === "date" || type === "dat") return formatDateShort(trimmed);
  return trimmed;
}

function FieldValueDisplay({ value, fieldType }: { value: string | null; fieldType: string }) {
  if (value == null || value.trim() === "") {
    return <span className="text-[var(--admin-on-surface-variant)]">—</span>;
  }

  const type = fieldType.toLowerCase();
  if (type === "boolean" || type === "bool" || type === "boo") {
    const yes = isTruthyBoolean(value);
    return (
      <span
        className={[
          "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
          yes
            ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
            : "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {yes ? "Yes" : "No"}
      </span>
    );
  }

  if (type === "select" || type === "sel") {
    return (
      <span className="inline-flex max-w-[220px] truncate rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "number" || type === "num") {
    return (
      <span className="font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "date" || type === "dat") {
    return (
      <span className="font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
        {formatDateShort(value)}
      </span>
    );
  }

  return (
    <span
      className="max-w-[280px] truncate text-[13px] text-[var(--admin-on-surface)]"
      title={value}
    >
      {value}
    </span>
  );
}

function buildDrafts(fields: CustomFieldLearnerField[]): DraftMap {
  const next: DraftMap = {};
  for (const field of fields) {
    next[field.definitionId] = valueJsonToDraft(field.valueJson, field.fieldType);
  }
  return next;
}

function LearnerSkeleton({ variant }: { variant: Variant }) {
  return (
    <div
      className={variant === "drawer" ? "space-y-4 p-6" : "flex flex-col gap-6"}
      aria-busy="true"
      aria-label="Loading learner field values"
    >
      {variant === "page" ? <Shimmer className="h-4 w-40" /> : null}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex items-start gap-3">
          <Shimmer className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-7 w-48" />
            <Shimmer className="h-4 w-56" />
            <div className="flex gap-2">
              <Shimmer className="h-5 w-16" />
              <Shimmer className="h-5 w-28" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-[var(--admin-surface)] p-4">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex h-14 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  defaultOpen,
  sticky,
}: {
  history: CustomFieldLearnerHistoryItem[];
  defaultOpen?: boolean;
  sticky?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <section
      className={[
        "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]",
        sticky ? "xl:sticky xl:top-4" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
      >
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
          Value history
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="border-t border-[var(--admin-border)] px-4 py-3">
          {history.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No changes recorded since these values were first set.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {history.map((item) => (
                <li key={item.id} className="relative border-l-2 border-[var(--admin-border)] pl-3">
                  <div className="font-mono text-[11px] tabular-nums text-[var(--admin-on-surface-variant)]">
                    <span title={formatDateTime(item.changedAt)}>
                      {formatRelativeDate(item.changedAt)}
                    </span>
                    <span className="ml-2 opacity-70">{formatDateTime(item.changedAt)}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-[var(--admin-on-surface)]">
                    {item.fieldLabel}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                    <span className="text-[var(--admin-on-surface-variant)]">
                      {item.oldValue ?? "—"}
                    </span>
                    <span className="text-[var(--admin-on-surface-variant)]">→</span>
                    <span className="font-medium text-[var(--admin-on-surface)]">
                      {item.newValue ?? "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                    {item.changedByName ? `by ${item.changedByName}` : "Unknown editor"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ConfirmUpdatesModal({
  open,
  learnerName,
  changes,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  learnerName: string;
  changes: ChangePreview[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-bg)_40%,#000)] backdrop-blur-[2px]"
        aria-label="Close confirmation"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
      >
        <div className="border-b border-[var(--admin-border)] px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--admin-on-surface)]">
            Confirm updates for {learnerName}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
            Value history is kept for audit.
          </p>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <ul className="flex flex-col gap-3">
            {changes.map((change) => (
              <li
                key={change.definitionId}
                className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
              >
                <div className="text-[13px] font-medium text-[var(--admin-on-surface)]">
                  {change.label}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="text-[var(--admin-on-surface-variant)]">
                    {change.before ?? "—"}
                  </span>
                  <span className="text-[var(--admin-on-surface-variant)]">→</span>
                  <span className="font-medium text-[var(--admin-on-surface)]">
                    {change.after ?? "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-3">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={onConfirm}
          >
            Confirm Updates
          </button>
        </div>
      </div>
    </div>
  );
}

function MessagePanel({
  open,
  email,
  busy,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  email: string | null;
  busy: boolean;
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  if (!open) return null;

  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Message learner</p>
        <button
          type="button"
          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
          aria-label="Close message panel"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {email ? (
        <p className="mb-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          To: {email}
        </p>
      ) : null}
      <div className="space-y-2">
        <input
          className={filterInputClassName}
          placeholder="Subject"
          value={subject}
          onChange={(event) => {
            onSubjectChange(event.target.value);
          }}
        />
        <textarea
          className={`${filterInputClassName} min-h-[88px] py-2`}
          placeholder="Message"
          value={body}
          onChange={(event) => {
            onBodyChange(event.target.value);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !subject.trim() || !body.trim()}
            onClick={onSend}
          >
            Send message
          </button>
          {email ? (
            <a href={`mailto:${email}`} className={ghostButtonClassName}>
              <Mail className="h-4 w-4" aria-hidden />
              Open mail client
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FieldEditControl({
  field,
  draft,
  onChange,
  onClear,
}: {
  field: CustomFieldLearnerField;
  draft: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const type = field.fieldType.toLowerCase();
  const inputId = `cf-edit-${field.definitionId}`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        {type === "boolean" || type === "bool" || type === "boo" ? (
          <div
            className="inline-flex overflow-hidden rounded-sm border border-[var(--admin-outline)]"
            role="group"
            aria-label={`${field.label} yes or no`}
          >
            {[
              { key: "true", label: "Yes" },
              { key: "false", label: "No" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                className={[
                  "h-9 px-3 text-[12px] font-medium transition-colors",
                  draft === option.key
                    ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                    : "bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
                onClick={() => {
                  onChange(option.key);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : type === "select" || type === "sel" ? (
          <select
            id={inputId}
            className={filterInputClassName}
            value={draft}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          >
            <option value="">Select…</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {draft && !field.options.includes(draft) ? (
              <option value={draft}>{draft} (current)</option>
            ) : null}
          </select>
        ) : type === "number" || type === "num" ? (
          <input
            id={inputId}
            type="number"
            className={filterInputClassName}
            value={draft}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        ) : type === "date" || type === "dat" ? (
          <input
            id={inputId}
            type="date"
            className={filterInputClassName}
            value={draft}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        ) : (
          <input
            id={inputId}
            type="text"
            className={filterInputClassName}
            value={draft}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        )}
      </div>
      <button
        type="button"
        className="shrink-0 text-[12px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)] hover:underline disabled:opacity-40"
        disabled={!draft}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}

export function AdminCustomFieldLearnerValuesView({
  membershipId,
  variant = "page",
  onClose,
  initialMode = "view",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomFieldLearnerDetailData | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [baseline, setBaseline] = useState<DraftMap>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldLearnerDetail(membershipId);
      setDetail(response.data);
      const nextDrafts = buildDrafts(response.data.fields);
      setDrafts(nextDrafts);
      setBaseline(nextDrafts);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load learner field values.",
      );
    } finally {
      setLoading(false);
    }
  }, [membershipId]);

  useEffect(() => {
    void load();
    setMode(initialMode);
    setConfirmOpen(false);
    setMessageOpen(false);
  }, [load, initialMode]);

  useEffect(() => {
    if (variant !== "drawer" || confirmOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (mode === "edit") {
        setMode("view");
        setDrafts(baseline);
        return;
      }
      onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [variant, onClose, confirmOpen, mode, baseline]);

  const changes = useMemo((): ChangePreview[] => {
    if (!detail) return [];
    const result: ChangePreview[] = [];
    for (const field of detail.fields) {
      const draft = drafts[field.definitionId] ?? "";
      const original = baseline[field.definitionId] ?? "";
      if (draft === original) continue;
      result.push({
        definitionId: field.definitionId,
        label: field.label,
        fieldType: field.fieldType,
        before: displayValueForDraft(original, field.fieldType),
        after: displayValueForDraft(draft, field.fieldType),
        valueJson: draftToValueJson(draft, field.fieldType),
      });
    }
    return result;
  }, [baseline, detail, drafts]);

  function enterEdit() {
    if (!detail) return;
    const next = buildDrafts(detail.fields);
    setDrafts(next);
    setBaseline(next);
    setMode("edit");
    setMessageOpen(false);
  }

  function discardEdit() {
    setDrafts(baseline);
    setMode("view");
    setConfirmOpen(false);
  }

  async function handleConfirmSave() {
    if (changes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await updateCustomFieldLearnerValues(membershipId, {
        values: changes.map((change) => ({
          definitionId: change.definitionId,
          valueJson: change.valueJson,
        })),
      });
      setConfirmOpen(false);
      setMode("view");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof ClientApiError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : "Unable to save field values.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendCustomFieldReportMessage({
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        membershipIds: [membershipId],
      });
      setMessageSubject("");
      setMessageBody("");
      setMessageOpen(false);
    } catch (messageError) {
      setError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  const learner = detail?.learner;
  const summary = detail?.summary;
  const displayName = learner?.learnerName?.trim() || learner?.email || "Learner";
  const filledFields = detail?.fields.filter((field) => field.filled) ?? [];
  const missingFields = detail?.fields.filter((field) => !field.filled) ?? [];

  const headerActions =
    mode === "view" && learner ? (
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href={`/admin/members/${learner.membershipId}`} className={ghostButtonClassName}>
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open member profile
        </Link>
        <button
          type="button"
          className={ghostButtonClassName}
          onClick={() => {
            setMessageOpen((open) => !open);
          }}
        >
          <Mail className="h-4 w-4" aria-hidden />
          Message learner
        </button>
        <button
          type="button"
          className={primaryButtonClassName}
          disabled={detail.zeroFieldsDefined}
          onClick={enterEdit}
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit values
        </button>
      </div>
    ) : null;

  const editFooter =
    mode === "edit" ? (
      <div
        className={[
          "flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3",
          variant === "drawer"
            ? "sticky bottom-0 z-20"
            : "sticky bottom-0 z-20 -mx-0 rounded-b-lg border border-[var(--admin-border)] shadow-[0_-8px_24px_-12px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]",
        ].join(" ")}
      >
        <span className="font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
          {formatCount(changes.length)} value{changes.length === 1 ? "" : "s"} changed
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={busy}
            onClick={discardEdit}
          >
            Discard
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || changes.length === 0}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Save changes
          </button>
        </div>
      </div>
    ) : null;

  const content = (() => {
    if (loading && !detail && !error) {
      return <LearnerSkeleton variant={variant} />;
    }

    if (error && !detail) {
      return (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load learner field values.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] px-3 text-[13px] font-medium text-[var(--admin-danger)] transition-transform active:translate-y-px"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
          <div className="pointer-events-none p-4 opacity-50">
            <LearnerSkeleton variant={variant} />
          </div>
        </div>
      );
    }

    if (!detail || !learner || !summary) return null;

    return (
      <div
        className={[
          "flex flex-col gap-6",
          mode === "edit" && variant === "page" ? "pb-20" : "",
        ].join(" ")}
      >
        {variant === "page" && mode === "view" ? (
          <Link
            href="/admin/reports/custom-field"
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Learner Report
          </Link>
        ) : null}

        {variant === "page" && mode === "edit" ? (
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            onClick={discardEdit}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Profile
          </button>
        ) : null}

        {variant === "drawer" && mode === "edit" ? (
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            onClick={discardEdit}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to view
          </button>
        ) : null}

        <div
          className={[
            "flex flex-col justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:flex-row md:items-start md:p-6",
            variant === "drawer" ? "border-0 bg-transparent p-0 md:p-0" : "",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-start gap-3">
            {learner.avatarUrl && isAvatarUrl(learner.avatarUrl) ? (
              <img
                src={learner.avatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[13px] font-semibold text-[var(--admin-on-surface-variant)]">
                {learnerInitials(learner.learnerName, learner.email)}
              </span>
            )}
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className={[
                    "truncate font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]",
                    variant === "drawer" ? "text-xl" : "text-2xl",
                  ].join(" ")}
                >
                  {displayName}
                </h1>
                <span
                  className={[
                    "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                    statusPillClass(learner.status),
                  ].join(" ")}
                >
                  {learner.status}
                </span>
                {mode === "edit" ? (
                  <span className="inline-flex items-center rounded-sm border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-primary)]">
                    Draft Mode
                  </span>
                ) : null}
              </div>
              {learner.email ? (
                <p className="truncate font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                  {learner.email}
                </p>
              ) : null}
              <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatCount(summary.fieldCount)} fields · {formatCount(summary.filledCount)} filled
              </p>
            </div>
          </div>

          {variant === "page" ? headerActions : null}
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <p className="text-sm font-medium text-[var(--admin-danger)]">{error}</p>
            <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          </div>
        ) : null}

        <MessagePanel
          open={messageOpen && mode === "view"}
          email={learner.email}
          busy={busy}
          subject={messageSubject}
          body={messageBody}
          onSubjectChange={setMessageSubject}
          onBodyChange={setMessageBody}
          onClose={() => {
            setMessageOpen(false);
          }}
          onSend={() => void handleSendMessage()}
        />

        {detail.zeroFieldsDefined ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <FileText
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              Your tenant has not defined any custom fields
            </h2>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Define attributes for learners, then return here to set and audit values.
            </p>
            <Link href="/admin/custom-fields" className={ghostButtonClassName}>
              <Settings2 className="h-4 w-4" aria-hidden />
              Manage fields
            </Link>
          </div>
        ) : detail.noValuesSet && mode === "view" ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Plus className="h-8 w-8 text-[var(--admin-on-surface-variant)]" strokeWidth={1.5} />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
              No custom field values are set for this learner
            </h2>
            <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
              Edit values to fill in the {formatCount(summary.fieldCount)} defined fields.
            </p>
            <button type="button" className={primaryButtonClassName} onClick={enterEdit}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit values
            </button>
          </div>
        ) : (
          <>
            {mode === "view" ? (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
                <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-1">
                  <span className={labelClassName}>Field completeness</span>
                  <span className="font-mono text-[24px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
                    {formatPct(summary.completenessPct)}
                  </span>
                  <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                    <div
                      className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, summary.completenessPct ?? 0))}%`,
                      }}
                    />
                  </div>
                  <span className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {formatCount(summary.filledCount)} of {formatCount(summary.fieldCount)} fields
                  </span>
                </div>
                <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
                  <span className={labelClassName}>Enrolments</span>
                  <span className="font-mono text-[24px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
                    {formatCount(learner.enrollmentCount)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
                  <span className={labelClassName}>Total spent</span>
                  <span className="font-mono text-[18px] leading-none font-medium tabular-nums text-[var(--admin-on-surface)]">
                    {formatMoney(learner.totalSpentCents, learner.currency)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
                  <span className={labelClassName}>Last active</span>
                  <span
                    className="text-[15px] font-medium text-[var(--admin-on-surface)]"
                    title={formatDateTime(learner.lastActiveAt)}
                  >
                    {formatRelativeDate(learner.lastActiveAt)}
                  </span>
                  {learner.lastActiveAt ? (
                    <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatDateShort(learner.lastActiveAt)}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
                  <span className={labelClassName}>Signed up</span>
                  <span className="font-mono text-[15px] font-medium tabular-nums text-[var(--admin-on-surface)]">
                    {formatDateShort(learner.signedUpAt)}
                  </span>
                </div>
              </div>
            ) : null}

            <div
              className={[
                "grid gap-6",
                variant === "page" && mode === "view" ? "xl:grid-cols-[1fr_300px]" : "",
              ].join(" ")}
            >
              <div className="min-w-0 space-y-4">
                {mode === "view" ? (
                  <>
                    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
                        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                          Filled fields · {formatCount(filledFields.length)}
                        </h2>
                      </div>
                      {filledFields.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                          No filled fields yet.
                        </p>
                      ) : (
                        <ul className="divide-y divide-[var(--admin-border)]">
                          {filledFields.map((field) => (
                            <li
                              key={field.definitionId}
                              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {fieldTypeMarker(field.fieldType)}
                                  </span>
                                  <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                                    {field.label}
                                  </span>
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {field.key}
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                                <FieldValueDisplay
                                  value={field.value}
                                  fieldType={field.fieldType}
                                />
                                <span
                                  className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]"
                                  title={formatDateTime(field.updatedAt)}
                                >
                                  {field.auditCaption}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {missingFields.length > 0 ? (
                      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
                          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                            Not set ({formatCount(missingFields.length)})
                          </h2>
                        </div>
                        <ul className="divide-y divide-[var(--admin-border)]">
                          {missingFields.map((field) => (
                            <li
                              key={field.definitionId}
                              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {fieldTypeMarker(field.fieldType)}
                                  </span>
                                  <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                                    {field.label}
                                  </span>
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {field.key}
                                </div>
                              </div>
                              <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                                <span className="text-[var(--admin-on-surface-variant)]">—</span>
                                <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  Never set
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                    <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5">
                      <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                        Edit field values
                      </h2>
                    </div>
                    <ul className="divide-y divide-[var(--admin-border)]">
                      {detail.fields.map((field) => {
                        const draft = drafts[field.definitionId] ?? "";
                        const original = baseline[field.definitionId] ?? "";
                        const changed = draft !== original;
                        return (
                          <li
                            key={field.definitionId}
                            className={[
                              "px-4 py-3",
                              changed
                                ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface))]"
                                : "border-l-2 border-l-transparent",
                            ].join(" ")}
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-sm bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {fieldTypeMarker(field.fieldType)}
                              </span>
                              <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                                {field.label}
                              </span>
                              <span className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {field.key}
                              </span>
                            </div>
                            <FieldEditControl
                              field={field}
                              draft={draft}
                              onChange={(value) => {
                                setDrafts((current) => ({
                                  ...current,
                                  [field.definitionId]: value,
                                }));
                              }}
                              onClear={() => {
                                setDrafts((current) => ({
                                  ...current,
                                  [field.definitionId]: "",
                                }));
                              }}
                            />
                            {changed ? (
                              <p className="mt-1.5 text-[11px] text-[var(--admin-warning)]">
                                Changed from{" "}
                                {displayValueForDraft(original, field.fieldType) ?? "—"}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {variant === "page" ? editFooter : null}
                  </div>
                )}
              </div>

              {mode === "view" ? (
                <HistoryPanel
                  history={detail.history}
                  defaultOpen={false}
                  sticky={variant === "page"}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  })();

  if (variant === "drawer") {
    return (
      <div className="fixed inset-0 z-50">
        <button
          type="button"
          className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-bg)_40%,#000)] backdrop-blur-[2px]"
          aria-label="Close learner drawer"
          onClick={() => {
            onClose?.();
          }}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} field values`}
          className="absolute inset-0 flex w-full flex-col border-l border-[var(--admin-outline)] bg-[var(--admin-bg)] shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-w-[560px]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--admin-outline)] bg-[var(--admin-bg)] px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-[var(--admin-on-surface)]">
                {loading && !learner ? "Learner" : displayName}
              </h2>
              {learner?.email ? (
                <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {learner.email}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-transparent bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] hover:text-[var(--admin-primary)]"
              aria-label="Close"
              onClick={() => {
                onClose?.();
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto bg-[var(--admin-surface-low)] p-4 sm:p-6">
            {content}
          </main>

          {mode === "edit" ? (
            editFooter
          ) : learner && !detail.zeroFieldsDefined ? (
            <footer className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-outline)] bg-[var(--admin-bg)] px-4 py-4 sm:px-6">
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/members/${learner.membershipId}`}
                  className={ghostButtonClassName}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setMessageOpen((open) => !open);
                  }}
                >
                  Message
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/reports/custom-field/learners/${learner.membershipId}`}
                  className={ghostButtonClassName}
                  onClick={() => {
                    onClose?.();
                  }}
                >
                  Open full page
                </Link>
                <button type="button" className={primaryButtonClassName} onClick={enterEdit}>
                  Edit values
                </button>
              </div>
            </footer>
          ) : null}
        </aside>

        <ConfirmUpdatesModal
          open={confirmOpen}
          learnerName={displayName}
          changes={changes}
          busy={busy}
          onCancel={() => {
            setConfirmOpen(false);
          }}
          onConfirm={() => void handleConfirmSave()}
        />
      </div>
    );
  }

  return (
    <>
      {content}
      <ConfirmUpdatesModal
        open={confirmOpen}
        learnerName={displayName}
        changes={changes}
        busy={busy}
        onCancel={() => {
          setConfirmOpen(false);
        }}
        onConfirm={() => void handleConfirmSave()}
      />
    </>
  );
}
