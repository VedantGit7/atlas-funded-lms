"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  CUSTOM_FIELD_BASE_COLUMN_OPTIONS,
  createCustomFieldReportGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportCustomFieldReport,
  fetchCustomFieldRoster,
  formatMoney,
  sendCustomFieldReportMessage,
  type CustomFieldDefinitionColumn,
  type CustomFieldRosterItem,
  type CustomFieldRosterSummary,
  fetchCustomFieldReportDefinitions,
} from "./admin-custom-field-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { AdminCustomFieldLearnerDrawer } from "./AdminCustomFieldLearnerDrawer";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REMOVED", label: "Removed" },
];

const PAGE_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
];

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const filterInputClassName =
  "h-9 w-full rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

const labelClassName =
  "ml-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

type ExtraFilter = {
  id: string;
  field: "email" | "status" | "minTotalSpent" | "maxTotalSpent";
  value: string;
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
  return formatDateShort(value);
}

function moneyToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const amount = Number(trimmed);
  if (Number.isNaN(amount) || amount < 0) return undefined;
  return Math.round(amount * 100);
}

function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number" || normalized === "num") return "num";
  if (normalized === "boolean" || normalized === "bool") return "bol";
  if (normalized === "select" || normalized === "sel") return "sel";
  if (normalized === "date" || normalized === "dat") return "dat";
  return "txt";
}

function statusPillClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (upper === "INVITED" || upper === "PENDING") {
    return "border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (upper === "SUSPENDED" || upper === "REMOVED") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

function learnerInitials(row: CustomFieldRosterItem): string {
  const source = row.learnerName?.trim() || row.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isTruthyBoolean(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return lower === "true" || lower === "yes" || lower === "1";
}

function CustomFieldCell({ value, fieldType }: { value: string | null; fieldType: string }) {
  if (value == null || value.trim() === "") {
    return <span className="text-[var(--admin-on-surface-variant)]">—</span>;
  }

  const type = fieldType.toLowerCase();
  if (type === "boolean" || type === "bool") {
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
      <span className="inline-flex max-w-[160px] truncate rounded-sm bg-[var(--admin-surface-high)] px-2 py-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
        {value}
      </span>
    );
  }

  if (type === "number" || type === "num") {
    return (
      <span className="block text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface)]">
        {value}
      </span>
    );
  }

  if (type === "date" || type === "dat") {
    return (
      <span className="block text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
        {formatDateShort(value)}
      </span>
    );
  }

  return (
    <span
      className="block max-w-[160px] truncate text-[13px] text-[var(--admin-on-surface)]"
      title={value}
    >
      {value}
    </span>
  );
}

function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading custom field roster">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-3 w-48" />
          <Shimmer className="h-8 w-64 max-w-full" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-3 bg-[var(--admin-surface)] p-4">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-7 w-16" />
            <Shimmer className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="flex flex-wrap gap-3">
            <Shimmer className="h-9 w-52" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-36" />
            <Shimmer className="h-9 w-40" />
          </div>
        </div>
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="h-3 w-full max-w-4xl" />
        </div>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-3.5 w-3.5 shrink-0" />
            <Shimmer className="h-4 w-48 shrink-0" />
            <Shimmer className="h-4 w-12" />
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-5 w-16" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryBand({ summary }: { summary: CustomFieldRosterSummary }) {
  const filledShare =
    summary.learnerCount > 0
      ? (summary.learnersWithAllFieldsFilled / summary.learnerCount) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4 md:col-span-1">
        <span className={labelClassName}>Learners</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.learnerCount)}
        </span>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatCount(summary.activeLearnerCount)} active ·{" "}
          {formatCount(summary.inactiveLearnerCount)} inactive
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Custom fields</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.customFieldCount)}
        </span>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Average coverage</span>
        <div className="flex items-end gap-2">
          <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
            {formatPct(summary.averageCoveragePct)}
          </span>
          <div className="mb-1.5 h-[3px] w-16 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
              style={{
                width: `${String(Math.min(100, Math.max(0, summary.averageCoveragePct ?? 0)))}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 bg-[var(--admin-surface)] p-4">
        <span className={labelClassName}>Learners w/ 100% fields</span>
        <span className="font-mono text-[20px] font-medium tabular-nums text-[var(--admin-on-surface)]">
          {formatCount(summary.learnersWithAllFieldsFilled)}
        </span>
        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          {formatPct(filledShare)}
        </span>
      </div>

      <div
        className={[
          "relative flex flex-col gap-1 overflow-hidden p-4",
          summary.fieldsBelow40Coverage > 0
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_4%,var(--admin-surface))]"
            : "bg-[var(--admin-surface)]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em]",
            summary.fieldsBelow40Coverage > 0
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface-variant)]",
          ].join(" ")}
        >
          {summary.fieldsBelow40Coverage > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          ) : null}
          Fields &lt; 40% coverage
        </span>
        <span
          className={[
            "font-mono text-[20px] font-medium tabular-nums",
            summary.fieldsBelow40Coverage > 0
              ? "text-[var(--admin-warning)]"
              : "text-[var(--admin-on-surface)]",
          ].join(" ")}
        >
          {formatCount(summary.fieldsBelow40Coverage)}
        </span>
      </div>
    </div>
  );
}

export function AdminCustomFieldRosterPage() {
  const router = useRouter();
  const searchId = useId();
  const columnsPanelId = useId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<CustomFieldRosterItem[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinitionColumn[]>([]);

  // The full definition list, loaded once. Without it the column picker can only
  // offer fields that happen to appear in the current page of roster rows.
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetchCustomFieldReportDefinitions();
        setFieldDefinitions((previous) => {
          const byKey = new Map(previous.map((definition) => [definition.key, definition]));
          for (const definition of response.data.items) {
            if (!byKey.has(definition.key)) byKey.set(definition.key, definition);
          }
          return [...byKey.values()];
        });
      } catch {
        // Non-fatal: the roster response still supplies the columns it knows
        // about, so the picker degrades to its previous behaviour.
      }
    })();
    // No cancellation flag: the merge is idempotent and keyed by field key, so a
    // late resolve after unmount changes nothing.
  }, []);
  const [summary, setSummary] = useState<CustomFieldRosterSummary | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [signedUpFrom, setSignedUpFrom] = useState("");
  const [signedUpTo, setSignedUpTo] = useState("");
  const [sortBy, setSortBy] = useState("signed_up_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<string[]>(
    CUSTOM_FIELD_BASE_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [extraFilters, setExtraFilters] = useState<ExtraFilter[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const seededCustomColumnsRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  const filterPayload = useMemo(() => {
    const payload: {
      email?: string;
      status?: string;
      minTotalSpentCents?: number;
      maxTotalSpentCents?: number;
    } = {};
    for (const filter of extraFilters) {
      if (!filter.value.trim()) continue;
      if (filter.field === "email") payload.email = filter.value.trim();
      if (filter.field === "status") payload.status = filter.value.trim().toUpperCase();
      if (filter.field === "minTotalSpent") {
        const cents = moneyToCents(filter.value);
        if (cents != null) payload.minTotalSpentCents = cents;
      }
      if (filter.field === "maxTotalSpent") {
        const cents = moneyToCents(filter.value);
        if (cents != null) payload.maxTotalSpentCents = cents;
      }
    }
    if (status) payload.status = status;
    return payload;
  }, [extraFilters, status]);

  const visibleCustomKeys = useMemo(
    () => columns.filter((column) => column.startsWith("cf:")).map((column) => column.slice(3)),
    [columns],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldRoster({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        sortBy,
        sortDir,
        columns,
        page,
        limit: pageSize,
        ...filterPayload,
      });
      setItems(response.data.items);
      setFieldDefinitions((previous) => {
        const byKey = new Map(previous.map((definition) => [definition.key, definition]));
        for (const definition of response.data.fieldDefinitions)
          byKey.set(definition.key, definition);
        return [...byKey.values()];
      });
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load the learner roster.",
      );
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterPayload, page, pageSize, signedUpFrom, signedUpTo, sortBy, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (seededCustomColumnsRef.current || fieldDefinitions.length === 0) return;
    seededCustomColumnsRef.current = true;
    setColumns((current) => {
      if (current.some((column) => column.startsWith("cf:"))) return current;
      return [
        ...current,
        ...fieldDefinitions.slice(0, 8).map((definition) => `cf:${definition.key}`),
      ];
    });
  }, [fieldDefinitions]);

  useEffect(() => {
    if (!rowMenuId) return;
    function onPointerDown() {
      setRowMenuId(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [rowMenuId]);

  const hasActiveFilters = Boolean(
    debouncedSearch ||
    status ||
    signedUpFrom ||
    signedUpTo ||
    extraFilters.some((filter) => filter.value.trim()),
  );

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalCount);

  const allOnPageSelected =
    items.length > 0 && items.every((row) => selectedIds.has(row.membershipId));

  const filteredColumnDefs = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    if (!q) return fieldDefinitions;
    return fieldDefinitions.filter(
      (definition) =>
        definition.label.toLowerCase().includes(q) || definition.key.toLowerCase().includes(q),
    );
  }, [columnSearch, fieldDefinitions]);

  function clearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setStatus("");
    setSignedUpFrom("");
    setSignedUpTo("");
    setExtraFilters([]);
    setPage(1);
  }

  function toggleColumn(key: string) {
    setColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        if (key === "learner_name") return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  function resetColumns() {
    setColumns([
      ...CUSTOM_FIELD_BASE_COLUMN_OPTIONS.map((column) => column.key),
      ...fieldDefinitions.slice(0, 8).map((definition) => `cf:${definition.key}`),
    ]);
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        for (const row of items) next.delete(row.membershipId);
      } else {
        for (const row of items) next.add(row.membershipId);
      }
      return next;
    });
  }

  function toggleRowSelection(membershipId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "learner_name" ? "asc" : "desc");
    }
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportCustomFieldReport({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        columns,
        emailDownloadLink: true,
        ...filterPayload,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
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
        ...(selectedIds.size > 0 ? { membershipIds: [...selectedIds] } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        ...filterPayload,
      });
      setMessageSubject("");
      setMessageBody("");
      setActionsOpen(false);
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

  async function handleCreateGroup() {
    if (!groupTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createCustomFieldReportGroup({
        title: groupTitle.trim(),
        ...(selectedIds.size > 0 ? { membershipIds: [...selectedIds] } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        ...filterPayload,
      });
      setGroupTitle("");
      setActionsOpen(false);
      router.push(`/admin/batches`);
    } catch (groupError) {
      setError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !summary && items.length === 0 && !error) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="learners" />
        <RosterSkeleton />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="learners" />
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--admin-danger)]">
              Couldn&apos;t load the learner roster.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-sm bg-[var(--admin-danger)] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-white transition-transform active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
        <div className="pointer-events-none opacity-40">
          <RosterSkeleton />
        </div>
      </div>
    );
  }

  const noFieldsDefined = summary != null && summary.customFieldCount === 0 && !hasActiveFilters;

  return (
    <div className="flex flex-col gap-6">
      <CustomFieldReportTabs active="learners" />

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="max-w-2xl space-y-1">
          <nav
            className="mb-1 flex items-center gap-1.5 text-[12px] text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin" className="transition-colors hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <Link
              href="/admin/reports"
              className="transition-colors hover:text-[var(--admin-primary)]"
            >
              Reports
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-[var(--admin-on-surface)]">Custom Field</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Custom Field
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Every learner against the attributes your tenant defines - slice, group, message, or
            export by any of them.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className={ghostButtonClassName}
              aria-expanded={columnsOpen}
              aria-controls={columnsPanelId}
              onClick={() => {
                setColumnsOpen((open) => !open);
              }}
            >
              <Columns3 className="h-4 w-4" aria-hidden />
              Columns
            </button>
            {columnsOpen ? (
              <div
                id={columnsPanelId}
                className="absolute right-0 z-40 mt-2 flex w-[320px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_24px_-4px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]"
              >
                <div className="border-b border-[var(--admin-border)] p-3">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                    <input
                      className="h-8 w-full rounded-sm border-transparent bg-[var(--admin-surface-low)] pr-3 pl-8 text-[13px] text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]/70 focus:border-[var(--admin-primary)] focus:bg-[var(--admin-surface)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                      placeholder="Find column..."
                      value={columnSearch}
                      onChange={(event) => {
                        setColumnSearch(event.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="flex max-h-[300px] flex-col gap-4 overflow-y-auto p-2">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 font-mono text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Learner columns
                    </span>
                    {CUSTOM_FIELD_BASE_COLUMN_OPTIONS.map((column) => (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-low)]"
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={columns.includes(column.key)}
                          disabled={column.key === "learner_name"}
                          onChange={() => {
                            toggleColumn(column.key);
                          }}
                        />
                        <span className="flex-1 text-[13px] text-[var(--admin-on-surface)]">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between px-2">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Custom fields
                      </span>
                      <button
                        type="button"
                        className="text-[10px] text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          setColumns((current) => {
                            const base = current.filter((c) => !c.startsWith("cf:"));
                            return [
                              ...base,
                              ...fieldDefinitions.map((definition) => `cf:${definition.key}`),
                            ];
                          });
                        }}
                      >
                        Select all
                      </button>
                    </div>
                    {filteredColumnDefs.length === 0 ? (
                      <p className="px-2 py-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                        No custom fields match.
                      </p>
                    ) : (
                      filteredColumnDefs.map((definition) => {
                        const key = `cf:${definition.key}`;
                        return (
                          <label
                            key={definition.id}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-[var(--admin-surface-low)]"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                              checked={columns.includes(key)}
                              onChange={() => {
                                toggleColumn(key);
                              }}
                            />
                            <span className="rounded-sm bg-[var(--admin-surface-high)] px-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                              {fieldTypeMarker(definition.fieldType)}
                            </span>
                            <span className="flex-1 text-[13px] text-[var(--admin-on-surface)]">
                              {definition.label}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                  <button
                    type="button"
                    className="text-[12px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                    onClick={resetColumns}
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    onClick={() => {
                      setColumnsOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={ghostButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>

          <Link href="/admin/custom-fields" className={ghostButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden />
            Manage fields
          </Link>

          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setActionsOpen((open) => !open);
            }}
          >
            Cohort actions
          </button>
        </div>
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

      {summary ? <SummaryBand summary={summary} /> : null}

      {actionsOpen ? (
        <div className="grid gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Send message</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Will reach{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {selectedIds.size > 0 ? formatCount(selectedIds.size) : formatCount(totalCount)}
              </strong>{" "}
              learner
              {selectedIds.size === 1 || (selectedIds.size === 0 && totalCount === 1) ? "" : "s"}
              {selectedIds.size > 0 ? " (selection)" : " matching filters"}.
            </p>
            <input
              className={filterInputClassName}
              placeholder="Subject"
              value={messageSubject}
              onChange={(event) => {
                setMessageSubject(event.target.value);
              }}
            />
            <textarea
              className={`${filterInputClassName} min-h-[80px] py-2`}
              placeholder="Message"
              value={messageBody}
              onChange={(event) => {
                setMessageBody(event.target.value);
              }}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !messageSubject.trim() || !messageBody.trim()}
              onClick={() => void handleSendMessage()}
            >
              Send message
            </button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Create group</p>
            <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
              Creates a batch from{" "}
              <strong className="font-medium text-[var(--admin-on-surface)]">
                {selectedIds.size > 0 ? formatCount(selectedIds.size) : formatCount(totalCount)}
              </strong>{" "}
              matched learners.
            </p>
            <input
              className={filterInputClassName}
              placeholder="Group title"
              value={groupTitle}
              onChange={(event) => {
                setGroupTitle(event.target.value);
              }}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy || !groupTitle.trim()}
              onClick={() => void handleCreateGroup()}
            >
              Create group
            </button>
          </div>
        </div>
      ) : null}

      {noFieldsDefined ? (
        <div className="flex min-h-[400px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex h-11 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Field definitions
            </span>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center p-12">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
              <FileText
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
              />
            </div>
            <h2 className="mb-2 text-center text-lg font-semibold text-[var(--admin-on-surface)]">
              No custom fields are defined yet
            </h2>
            <p className="mb-8 max-w-[420px] text-center text-sm text-[var(--admin-on-surface-variant)]">
              Define attributes like trading experience or preferred market to slice your learners
              by them.
            </p>
            <Link href="/admin/custom-fields" className={primaryButtonClassName}>
              <Plus className="h-4 w-4" aria-hidden />
              Manage fields
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_2px_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="flex items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4">
            <button
              type="button"
              className="flex h-12 items-center border-b-2 border-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-primary)]"
            >
              All learners
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={searchId} className={labelClassName}>
                  Search
                </label>
                <div className="relative w-64 max-w-full">
                  <Search className="absolute top-1/2 left-2.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    id={searchId}
                    className={`${filterInputClassName} pl-9`}
                    placeholder="Name or email"
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className={labelClassName}>Status</span>
                <Select
                  className={selectClassName}
                  value={status}
                  onValueChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                  options={STATUS_OPTIONS}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelClassName} htmlFor="cf-signed-from">
                  Signed up from
                </label>
                <input
                  id="cf-signed-from"
                  type="date"
                  className={`${filterInputClassName} w-40`}
                  value={signedUpFrom}
                  onChange={(event) => {
                    setSignedUpFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelClassName} htmlFor="cf-signed-to">
                  Signed up to
                </label>
                <input
                  id="cf-signed-to"
                  type="date"
                  className={`${filterInputClassName} w-40`}
                  value={signedUpTo}
                  onChange={(event) => {
                    setSignedUpTo(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className={`${labelClassName} text-transparent`}>Action</span>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-sm border border-dashed border-[var(--admin-outline)] px-3 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_5%,transparent)] hover:text-[var(--admin-primary)]"
                  onClick={() => {
                    setExtraFilters((current) => [
                      ...current,
                      { id: String(Date.now()), field: "email", value: "" },
                    ]);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add field condition
                </button>
              </div>
            </div>

            {extraFilters.length > 0 ? (
              <div className="flex flex-col gap-2">
                {extraFilters.map((filter) => (
                  <div key={filter.id} className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <span className={labelClassName}>Field</span>
                      <select
                        className={filterInputClassName}
                        value={filter.field}
                        onChange={(event) => {
                          setExtraFilters((current) =>
                            current.map((item) =>
                              item.id === filter.id
                                ? {
                                    ...item,
                                    field: event.target.value as ExtraFilter["field"],
                                    value: "",
                                  }
                                : item,
                            ),
                          );
                        }}
                      >
                        <option value="email">Email</option>
                        <option value="status">Status</option>
                        <option value="minTotalSpent">Min total spent</option>
                        <option value="maxTotalSpent">Max total spent</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={labelClassName}>Value</span>
                      <input
                        className={`${filterInputClassName} w-48`}
                        value={filter.value}
                        placeholder={
                          filter.field === "status"
                            ? "ACTIVE"
                            : filter.field.includes("Spent")
                              ? "Amount (e.g. 1000)"
                              : "Filter value"
                        }
                        onChange={(event) => {
                          setExtraFilters((current) =>
                            current.map((item) =>
                              item.id === filter.id ? { ...item, value: event.target.value } : item,
                            ),
                          );
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      onClick={() => {
                        setExtraFilters((current) =>
                          current.filter((item) => item.id !== filter.id),
                        );
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)] pt-3">
              <span className="mr-1 text-[12px] text-[var(--admin-on-surface-variant)]">
                Matches{" "}
                <strong className="font-medium text-[var(--admin-on-surface)]">
                  {formatCount(totalCount)}
                </strong>{" "}
                learners
              </span>
              {debouncedSearch ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
                  <span className="text-[var(--admin-on-surface-variant)]">Search:</span>
                  <span className="font-medium text-[var(--admin-on-surface)]">
                    {debouncedSearch}
                  </span>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                    onClick={() => {
                      setSearchInput("");
                      setDebouncedSearch("");
                    }}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
              {status ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
                  <span className="text-[var(--admin-on-surface-variant)]">Status:</span>
                  <span className="font-medium text-[var(--admin-on-surface)]">{status}</span>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                    onClick={() => {
                      setStatus("");
                    }}
                    aria-label="Clear status"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
              {(signedUpFrom || signedUpTo) && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[12px]">
                  <span className="text-[var(--admin-on-surface-variant)]">Signed up:</span>
                  <span className="font-medium text-[var(--admin-on-surface)]">
                    {signedUpFrom || "…"} → {signedUpTo || "…"}
                  </span>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                    onClick={() => {
                      setSignedUpFrom("");
                      setSignedUpTo("");
                    }}
                    aria-label="Clear signed up range"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="ml-2 text-[12px] text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] hover:underline"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </div>

          {selectedIds.size > 0 ? (
            <div className="flex h-10 items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[var(--admin-primary-container)] px-4">
              <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--admin-primary)]">
                {formatCount(selectedIds.size)} learners selected
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-[13px] text-[var(--admin-primary)] hover:underline"
                  onClick={() => {
                    setActionsOpen(true);
                  }}
                >
                  Cohort actions
                </button>
                <button
                  type="button"
                  className="text-[13px] text-[var(--admin-primary)] hover:underline"
                  onClick={() => {
                    setSelectedIds(new Set());
                  }}
                >
                  Clear selection
                </button>
              </div>
            </div>
          ) : null}

          <div className="relative flex-1 overflow-auto bg-[var(--admin-surface)]">
            {loading ? (
              <div className="p-4" aria-busy="true">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="mb-3 flex gap-4">
                    <Shimmer className="h-4 w-4" />
                    <Shimmer className="h-4 w-48" />
                    <Shimmer className="h-4 w-16" />
                    <Shimmer className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <FileText
                    className="h-10 w-10 text-[var(--admin-on-surface-variant)]"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No learners match these filters
                </h3>
                <p className="mb-8 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                  Adjust or clear your current filter selections to view learners against your
                  custom fields.
                </p>
                <button type="button" className={primaryButtonClassName} onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="absolute top-0 bottom-0 left-0 z-30 w-0.5 bg-[var(--admin-primary)]" />
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-[0_1px_0_0_var(--admin-border)]">
                    <tr>
                      <th className="sticky left-0 z-20 w-10 border-r border-[color-mix(in_srgb,var(--admin-border)_30%,transparent)] bg-[var(--admin-surface-low)] px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          aria-label="Select all on page"
                        />
                      </th>
                      {columns.includes("learner_name") ? (
                        <th className="sticky left-10 z-20 w-64 cursor-pointer border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase shadow-[4px_0_12px_color-mix(in_srgb,var(--admin-on-surface)_3%,transparent)] transition-colors hover:text-[var(--admin-on-surface)]">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => {
                              toggleSort("learner_name");
                            }}
                          >
                            Learner
                            {sortBy === "learner_name" ? (
                              <span className="text-[var(--admin-primary)]">
                                {sortDir === "asc" ? "↑" : "↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {columns.includes("email") ? (
                        <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Email
                        </th>
                      ) : null}
                      {columns.includes("enrollment_count") ? (
                        <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase transition-colors hover:text-[var(--admin-on-surface)]">
                          <button type="button" className="inline-flex w-full justify-end" disabled>
                            Enrolments
                          </button>
                        </th>
                      ) : null}
                      {columns.includes("total_spent_cents") ? (
                        <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-end gap-1"
                            onClick={() => {
                              toggleSort("total_spent_cents");
                            }}
                          >
                            Total spent
                            {sortBy === "total_spent_cents" ? (
                              <span className="text-[var(--admin-primary)]">
                                {sortDir === "asc" ? "↑" : "↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {columns.includes("last_active_at") ? (
                        <th className="cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-end gap-1"
                            onClick={() => {
                              toggleSort("last_active_at");
                            }}
                          >
                            Last active on
                            {sortBy === "last_active_at" ? (
                              <span className="text-[var(--admin-primary)]">
                                {sortDir === "asc" ? "↑" : "↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {columns.includes("signed_up_at") ? (
                        <th
                          className={[
                            "cursor-pointer px-4 py-3 text-right font-mono text-[12px] font-semibold tracking-[0.06em] uppercase",
                            sortBy === "signed_up_at"
                              ? "bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,transparent)] text-[var(--admin-primary)]"
                              : "text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          <button
                            type="button"
                            className="inline-flex w-full items-center justify-end gap-1"
                            onClick={() => {
                              toggleSort("signed_up_at");
                            }}
                          >
                            Signed up on
                            {sortBy === "signed_up_at" ? (
                              <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                            ) : null}
                          </button>
                        </th>
                      ) : null}
                      {columns.includes("status") ? (
                        <th className="px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                          Status
                        </th>
                      ) : null}
                      {visibleCustomKeys.map((key, index) => {
                        const definition = fieldDefinitions.find((item) => item.key === key);
                        return (
                          <th
                            key={key}
                            className={[
                              "whitespace-nowrap px-4 py-3 font-mono text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase",
                              index === 0
                                ? "border-l border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]"
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex flex-col items-start gap-0.5 normal-case tracking-normal">
                              <div className="flex items-center gap-2">
                                <span className="rounded-sm bg-[var(--admin-surface-high)] px-1 font-mono text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                                  {fieldTypeMarker(definition?.fieldType ?? "text")}
                                </span>
                                <span className="font-sans text-[12px] font-semibold tracking-[0.06em] uppercase">
                                  {definition?.label ?? key}
                                </span>
                              </div>
                              <span className="pl-7 font-mono text-[10px] font-normal tracking-normal text-[var(--admin-on-surface-variant)] normal-case">
                                {key}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                      <th className="w-12 px-2 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)] text-[var(--admin-on-surface)]">
                    {items.map((row) => {
                      const selected = selectedIds.has(row.membershipId);
                      return (
                        <tr
                          key={row.membershipId}
                          className={[
                            "group h-11 transition-colors",
                            selected
                              ? "bg-[var(--admin-primary-container)]"
                              : "hover:bg-[var(--admin-surface-high)]",
                          ].join(" ")}
                        >
                          <td
                            className={[
                              "sticky left-0 z-10 border-r border-[color-mix(in_srgb,var(--admin-border)_30%,transparent)] px-4",
                              selected
                                ? "bg-[var(--admin-primary-container)]"
                                : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 cursor-pointer rounded-[3px] border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                              checked={selected}
                              onChange={() => {
                                toggleRowSelection(row.membershipId);
                              }}
                              aria-label={`Select ${row.email ?? row.learnerName ?? "learner"}`}
                            />
                          </td>
                          {columns.includes("learner_name") ? (
                            <td
                              className={[
                                "sticky left-10 z-10 max-w-[256px] border-r border-[var(--admin-border)] px-4 shadow-[4px_0_12px_color-mix(in_srgb,var(--admin-on-surface)_3%,transparent)]",
                                selected
                                  ? "bg-[var(--admin-primary-container)]"
                                  : "bg-[var(--admin-surface)] group-hover:bg-[var(--admin-surface-high)]",
                              ].join(" ")}
                            >
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 text-left"
                                onClick={() => {
                                  setSelectedMembershipId(row.membershipId);
                                }}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                                  {learnerInitials(row)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]">
                                    {row.learnerName ?? row.email ?? "—"}
                                  </span>
                                  {row.learnerName && row.email ? (
                                    <span className="block truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                                      {row.email}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </td>
                          ) : null}
                          {columns.includes("email") ? (
                            <td className="max-w-[200px] truncate px-4 text-[13px]">
                              {row.email ? (
                                <button
                                  type="button"
                                  className="truncate text-left hover:text-[var(--admin-primary)] hover:underline"
                                  onClick={() => {
                                    setSelectedMembershipId(row.membershipId);
                                  }}
                                >
                                  {row.email}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                          ) : null}
                          {columns.includes("enrollment_count") ? (
                            <td className="px-4 text-right font-mono text-[13px] tabular-nums">
                              {row.enrollmentCount}
                            </td>
                          ) : null}
                          {columns.includes("total_spent_cents") ? (
                            <td className="px-4 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
                              {formatMoney(row.totalSpentCents, row.currency)}
                            </td>
                          ) : null}
                          {columns.includes("last_active_at") ? (
                            <td className="px-4 text-right font-mono text-[13px] tabular-nums text-[var(--admin-on-surface-variant)]">
                              <span className="block">{formatRelativeDate(row.lastActiveAt)}</span>
                              {row.lastActiveAt ? (
                                <span className="block text-[11px] opacity-70">
                                  {formatDateShort(row.lastActiveAt)}
                                </span>
                              ) : null}
                            </td>
                          ) : null}
                          {columns.includes("signed_up_at") ? (
                            <td className="px-4 text-right font-mono text-[13px] tabular-nums">
                              {formatDateShort(row.signedUpAt)}
                            </td>
                          ) : null}
                          {columns.includes("status") ? (
                            <td className="px-4">
                              <span
                                className={[
                                  "inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase",
                                  statusPillClass(row.status),
                                ].join(" ")}
                              >
                                {row.status}
                              </span>
                            </td>
                          ) : null}
                          {visibleCustomKeys.map((key, index) => {
                            const definition = fieldDefinitions.find((item) => item.key === key);
                            return (
                              <td
                                key={key}
                                className={[
                                  "px-4",
                                  index === 0
                                    ? "border-l border-[color-mix(in_srgb,var(--admin-border)_50%,transparent)]"
                                    : "",
                                ].join(" ")}
                              >
                                <CustomFieldCell
                                  value={row.customFields[key] ?? null}
                                  fieldType={definition?.fieldType ?? "text"}
                                />
                              </td>
                            );
                          })}
                          <td className="relative px-2">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)]"
                              aria-label={`Actions for ${row.learnerName ?? row.email ?? "learner"}`}
                              aria-expanded={rowMenuId === row.membershipId}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setRowMenuId((current) =>
                                  current === row.membershipId ? null : row.membershipId,
                                );
                              }}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </button>
                            {rowMenuId === row.membershipId ? (
                              <div
                                className="absolute right-2 z-30 mt-1 w-48 overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--admin-on-surface)_16%,transparent)]"
                                onPointerDown={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                                  onClick={() => {
                                    setRowMenuId(null);
                                    setSelectedMembershipId(row.membershipId);
                                  }}
                                >
                                  View field values
                                </button>
                                <Link
                                  href={`/admin/reports/custom-field/learners/${row.membershipId}`}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                                  onClick={() => {
                                    setRowMenuId(null);
                                  }}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                  Open full page
                                </Link>
                                <Link
                                  href={`/admin/members/${row.membershipId}`}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                                  onClick={() => {
                                    setRowMenuId(null);
                                  }}
                                >
                                  Open member profile
                                </Link>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="flex h-12 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
            <span className="text-[12px] text-[var(--admin-on-surface-variant)]">
              {totalCount === 0
                ? "No learners"
                : `Showing ${formatCount(showingFrom)}–${formatCount(showingTo)} of ${formatCount(totalCount)} learners`}
            </span>
            <div className="flex items-center gap-2">
              <Select
                className={selectClassName}
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
              />
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
                disabled={page >= totalPages || loading || totalPages === 0}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
        Custom-field columns come from your tenant&apos;s active field definitions.
      </p>

      <AdminCustomFieldLearnerDrawer
        membershipId={selectedMembershipId}
        onClose={() => {
          setSelectedMembershipId(null);
        }}
      />
    </div>
  );
}
