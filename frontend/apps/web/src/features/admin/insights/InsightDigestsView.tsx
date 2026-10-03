"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { DropdownMenu } from "@atlas/design-system";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { ADMIN_INSIGHTS_HREF, adminInsightHref } from "./admin-insights-catalog";
import {
  fetchInsightLayout,
  type InsightDigestCatalogItem,
  type InsightDigestDraft,
  type InsightDigestFormat,
  type InsightDigestHistoryCell,
  type InsightDigestItem,
  type InsightDigestPreview,
  type InsightDigestsBoard,
  type InsightDigestsMutation,
  type InsightDigestStatus,
} from "./admin-insights-api";
import {
  formatDateTime,
  formatInsightMoney,
  formatInsightNumber,
  formatRelativeTime,
} from "./admin-insights-format";
import {
  INSIGHT_RANGE_OPTIONS,
  insightBreadcrumbClassName,
  insightGhostButtonClassName,
  insightKpiLabelClassName,
  insightKpiValueClassName,
  insightPageClassName,
  insightPageDescClassName,
  insightPageTitleClassName,
  insightPanelClassName,
  insightPrimaryButtonClassName,
  insightSegmentButtonActiveClassName,
  insightSegmentButtonClassName,
  insightSegmentTrackClassName,
  insightShimmerClassName,
} from "./admin-insights-shared";

type InsightDigestsViewProps = {
  slug: string;
  sectionTitle: string;
  board: InsightDigestsBoard | null;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  onRetry: () => void;
  onMutate: (body: InsightDigestsMutation) => Promise<InsightDigestsBoard | null>;
  onPreview: (id: string | null) => Promise<void>;
};

type DigestForm = {
  name: string;
  sourceSlug: string;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestDraft["period"];
  format: InsightDigestFormat;
  recipients: string[];
  cadence: InsightDigestDraft["cadence"];
  weekday: string;
  monthDay: number;
  time: string;
  timezone: string;
};

const FORMAT_OPTIONS: Array<{ value: InsightDigestFormat; label: string; hint: string }> = [
  {
    value: "inline",
    label: "Inline email with charts as images",
    hint: "Charts render in the message",
  },
  {
    value: "inline-csv",
    label: "Inline email plus a CSV attachment",
    hint: "Better for analysis in a spreadsheet",
  },
  { value: "link", label: "Link to the live section only", hint: "Requires signing in" },
];

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const FUNNEL_PREVIEW_NOTE =
  "Event counts in the selected window, not a single cohort. Stages are independent and may overlap.";

function menuPanelClassName(): string {
  return "admin-theme admin-dropdown-panel border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)]";
}

function Shimmer({ className }: { className: string }) {
  return <div className={`${insightShimmerClassName} ${className}`} />;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function emailDomain(value: string): string {
  return value.trim().toLowerCase().split("@")[1] ?? "";
}

function isOutsideDomain(email: string, domains: string[]): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (domains.length === 0) return false;
  return !domains.some((item) => domain === item || domain.endsWith(`.${item}`));
}

function periodLabel(period: InsightDigestDraft["period"]): string {
  return INSIGHT_RANGE_OPTIONS.find((option) => option.value === period)?.label ?? "Last 30 days";
}

function emptyForm(
  slug: string,
  actorEmail: string | null,
  catalog: InsightDigestCatalogItem[],
): DigestForm {
  const widgets = catalog
    .filter((item) => item.defaultViz !== "kpi")
    .slice(0, 4)
    .map((item) => item.id);
  return {
    name: "",
    sourceSlug: slug,
    includeAlerts: true,
    includeKpis: true,
    widgetIds: widgets,
    period: "30d",
    format: "inline",
    recipients: actorEmail ? [actorEmail] : [],
    cadence: "weekly",
    weekday: "mon",
    monthDay: 1,
    time: "08:00",
    timezone: "UTC",
  };
}

function formFromDigest(digest: InsightDigestItem): DigestForm {
  return {
    name: digest.name,
    sourceSlug: digest.sourceSlug,
    includeAlerts: digest.includeAlerts,
    includeKpis: digest.includeKpis,
    widgetIds: digest.widgetIds,
    period: digest.period,
    format: digest.format,
    recipients: digest.recipients.map((row) => row.email),
    cadence: digest.cadence,
    weekday: digest.weekday,
    monthDay: digest.monthDay,
    time: digest.time,
    timezone: digest.timezone,
  };
}

function toDraft(form: DigestForm): InsightDigestDraft {
  return {
    name: form.name.trim(),
    sourceSlug: form.sourceSlug,
    includeAlerts: form.includeAlerts,
    includeKpis: form.includeKpis,
    widgetIds: form.widgetIds,
    period: form.period,
    format: form.format,
    recipients: form.recipients,
    cadence: form.cadence,
    weekday: form.weekday,
    monthDay: form.monthDay,
    time: form.time,
    timezone: form.timezone,
  };
}

function statusBadgeClass(status: InsightDigestStatus): string {
  if (status === "failed") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (status === "delivered") {
    return "border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(status: InsightDigestStatus): string {
  if (status === "delivered") return "Delivered";
  if (status === "failed") return "Failed";
  if (status === "paused") return "Paused";
  return "Scheduled";
}

function lastSendAt(digest: InsightDigestItem): string | null {
  const latest = [...digest.sends].reverse().find((send) => !send.test) ?? digest.sends.at(-1);
  return latest?.at ?? null;
}

export function InsightDigestsView({
  slug,
  sectionTitle,
  board,
  loading,
  mutating,
  error,
  onRetry,
  onMutate,
  onPreview,
}: InsightDigestsViewProps) {
  const [filterFailing, setFilterFailing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DigestForm>(() => emptyForm(slug, null, []));
  const [catalog, setCatalog] = useState<InsightDigestCatalogItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [recipientDraft, setRecipientDraft] = useState("");

  useEffect(() => {
    if (board?.catalog && form.sourceSlug === slug) {
      setCatalog(board.catalog);
    }
  }, [board, form.sourceSlug, slug]);

  useEffect(() => {
    if (!drawerOpen) return;

    const applyCatalog = (items: InsightDigestCatalogItem[]) => {
      setCatalog(items);
      if (editingId) return;
      setForm((current) => {
        const charts = items
          .filter((item) => item.defaultViz !== "kpi")
          .slice(0, 4)
          .map((item) => item.id);
        const stillValid = current.widgetIds.filter((id) =>
          items.some((item) => item.id === id && item.defaultViz !== "kpi"),
        );
        if (stillValid.length === current.widgetIds.length && current.widgetIds.length > 0) {
          return current;
        }
        return { ...current, widgetIds: charts };
      });
    };

    if (form.sourceSlug === slug && board?.catalog) {
      applyCatalog(board.catalog);
      return;
    }
    let cancelled = false;
    void fetchInsightLayout(form.sourceSlug)
      .then((response) => {
        if (cancelled) return;
        applyCatalog(
          response.data.catalog.map((item) => ({
            id: item.id,
            title: item.title,
            defaultViz: item.defaultViz,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [board?.catalog, drawerOpen, editingId, form.sourceSlug, slug]);

  const digests = useMemo(() => {
    const rows = board?.digests ?? [];
    if (!filterFailing) return rows;
    return rows.filter((row) => row.status === "failed");
  }, [board, filterFailing]);

  const deleting = board?.digests.find((row) => row.id === deleteId) ?? null;
  const preview = board?.preview ?? null;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(slug, board?.actorEmail ?? null, board?.catalog ?? []));
    setRecipientDraft("");
    setDrawerOpen(true);
  };

  const openEdit = (digest: InsightDigestItem) => {
    setEditingId(digest.id);
    setForm(formFromDigest(digest));
    setRecipientDraft("");
    setDrawerOpen(true);
  };

  const addRecipient = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!isValidEmail(email)) return;
    setForm((current) =>
      current.recipients.includes(email)
        ? current
        : { ...current, recipients: [...current.recipients, email] },
    );
    setRecipientDraft("");
  };

  const saveForm = async () => {
    if (!form.name.trim() || form.recipients.length === 0) return;
    const body: InsightDigestsMutation = editingId
      ? { action: "update", id: editingId, digest: toDraft(form) }
      : { action: "create", digest: toDraft(form) };
    const result = await onMutate(body);
    if (result) {
      setDrawerOpen(false);
      setEditingId(null);
    }
  };

  const testTarget = board?.digests.find((row) => row.enabled) ?? board?.digests[0] ?? null;

  return (
    <div className={insightPageClassName}>
      <nav className={insightBreadcrumbClassName} aria-label="Breadcrumb">
        <Link href="/admin" prefetch={false} className="hover:text-[var(--admin-on-surface)]">
          Admin
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={ADMIN_INSIGHTS_HREF}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          Insights
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <Link
          href={adminInsightHref(slug)}
          prefetch={false}
          className="hover:text-[var(--admin-on-surface)]"
        >
          {sectionTitle}
        </Link>
        <span className="text-[var(--admin-outline)]" aria-hidden="true">
          /
        </span>
        <span className="font-medium text-[var(--admin-on-surface)]">Digests</span>
      </nav>

      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className={insightPageTitleClassName}>Digests</h1>
          <p className={insightPageDescClassName}>
            Email a snapshot of {sectionTitle} on a schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={mutating || !testTarget}
            onClick={() => {
              if (!testTarget) return;
              void onMutate({ action: "send-test", id: testTarget.id });
            }}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send a test to myself
          </button>
          <button
            type="button"
            className={insightPrimaryButtonClassName}
            disabled={mutating}
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New digest
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-4 rounded border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--admin-danger)]">
              Unable to update digests
            </h3>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
            <button
              type="button"
              className={`${insightGhostButtonClassName} mt-4`}
              onClick={onRetry}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {loading && !board ? (
        <DigestsSkeleton />
      ) : board && board.digests.length === 0 ? (
        <EmptyDigests sectionTitle={sectionTitle} onCreate={openCreate} />
      ) : board ? (
        <>
          <section
            className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
            aria-label="Digest summary"
          >
            <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-6 md:divide-x md:divide-y-0">
              <div className="flex flex-col justify-center p-5 md:col-span-2">
                <div className="mb-1 flex items-end gap-3">
                  <span className="text-base font-semibold text-[var(--admin-on-surface-variant)]">
                    Digests
                  </span>
                  <span className={insightKpiValueClassName}>
                    {formatInsightNumber(board.summary.total)}
                  </span>
                </div>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  {formatInsightNumber(board.summary.enabled)} enabled ·{" "}
                  {formatInsightNumber(board.summary.paused)} paused
                </p>
              </div>
              <div className="flex flex-col justify-center p-5">
                <div className={insightKpiLabelClassName}>Sends this month</div>
                <div className={`${insightKpiValueClassName} mt-1`}>
                  {formatInsightNumber(board.summary.sendsThisMonth)}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-success)]">
                  {formatInsightNumber(board.summary.deliveredThisMonth)} delivered
                </p>
              </div>
              <div className="flex flex-col justify-center p-5">
                <div className={insightKpiLabelClassName}>Recipients</div>
                <div className={`${insightKpiValueClassName} mt-1`}>
                  {formatInsightNumber(board.summary.recipients)}
                </div>
                <p
                  className={`mt-1 text-xs ${
                    board.summary.outsideDomain > 0
                      ? "font-medium text-[var(--admin-warning)]"
                      : "text-[var(--admin-on-surface-variant)]"
                  }`}
                >
                  {board.summary.outsideDomain > 0
                    ? `${formatInsightNumber(board.summary.outsideDomain)} outside your domain`
                    : "All inside your domain"}
                </p>
              </div>
              <div className="flex flex-col justify-center p-5">
                <div className={insightKpiLabelClassName}>Next send</div>
                <div className="mt-1 font-data text-xl font-medium text-[var(--admin-on-surface)]">
                  {board.summary.nextSendAt ? formatRelativeTime(board.summary.nextSendAt) : "None"}
                </div>
                <p className="mt-1 truncate text-xs text-[var(--admin-on-surface-variant)]">
                  {board.summary.nextSendName ?? "Enable a digest to schedule"}
                </p>
              </div>
              <button
                type="button"
                aria-pressed={filterFailing}
                aria-label="Filter to failing digests"
                className="flex flex-col justify-center p-5 text-left outline-none hover:bg-[var(--admin-surface-high)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/30"
                onClick={() => {
                  setFilterFailing((current) => !current);
                }}
              >
                <div className={insightKpiLabelClassName}>Failing</div>
                <div
                  className={`${insightKpiValueClassName} mt-1 ${
                    board.summary.failing > 0
                      ? "text-[var(--admin-danger)]"
                      : "text-[var(--admin-success)]"
                  }`}
                >
                  {formatInsightNumber(board.summary.failing)}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  {filterFailing
                    ? "Showing failing only"
                    : board.summary.failing > 0
                      ? "Click to filter"
                      : "None failing"}
                </p>
              </button>
            </div>
          </section>

          <div className="flex flex-col gap-4 pb-8">
            {digests.length === 0 ? (
              <div
                className={`${insightPanelClassName} px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]`}
              >
                No failing digests right now.
                <button
                  type="button"
                  className="ml-2 font-medium text-[var(--admin-primary)] hover:underline"
                  onClick={() => {
                    setFilterFailing(false);
                  }}
                >
                  Show all
                </button>
              </div>
            ) : (
              digests.map((digest) => (
                <DigestRow
                  key={digest.id}
                  digest={digest}
                  disabled={mutating}
                  onToggle={(enabled) => {
                    void onMutate({ action: "toggle", id: digest.id, enabled });
                  }}
                  onEdit={() => {
                    openEdit(digest);
                  }}
                  onPreview={() => {
                    void onPreview(digest.id);
                  }}
                  onSendTest={() => {
                    void onMutate({ action: "send-test", id: digest.id });
                  }}
                  onDelete={() => {
                    setDeleteId(digest.id);
                  }}
                />
              ))
            )}
          </div>
        </>
      ) : null}

      {drawerOpen ? (
        <DigestDrawer
          editing={Boolean(editingId)}
          form={form}
          catalog={catalog}
          sections={board?.sections ?? []}
          timezones={board?.timezones ?? ["UTC"]}
          weekdays={board?.weekdays ?? []}
          domains={board?.tenantDomains ?? []}
          recipientDraft={recipientDraft}
          mutating={mutating}
          canSendTest={Boolean(editingId)}
          onRecipientDraftChange={setRecipientDraft}
          onAddRecipient={addRecipient}
          onChange={setForm}
          onClose={() => {
            setDrawerOpen(false);
          }}
          onSave={() => {
            void saveForm();
          }}
          onSendTest={() => {
            if (!editingId) return;
            void onMutate({ action: "send-test", id: editingId });
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteDigestModal
          digest={deleting}
          mutating={mutating}
          onCancel={() => {
            setDeleteId(null);
          }}
          onConfirm={() => {
            void onMutate({ action: "delete", id: deleting.id }).then((result) => {
              if (result) setDeleteId(null);
            });
          }}
        />
      ) : null}

      {preview ? (
        <EmailPreviewModal
          preview={preview}
          onClose={() => {
            void onPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}

function HistoryStrip({ cells }: { cells: InsightDigestHistoryCell[] }) {
  if (cells.every((cell) => cell === "empty")) {
    return (
      <div className="h-6 w-[72px] rounded-sm bg-[var(--admin-surface-low)]" title="No sends yet" />
    );
  }
  return (
    <div className="flex h-6 items-end gap-px" title="30-day send history">
      {cells.map((cell, index) => (
        <span
          key={`${cell}-${index}`}
          className={`w-1.5 rounded-sm ${
            cell === "delivered"
              ? "h-6 bg-[var(--admin-success)] opacity-80"
              : cell === "failed"
                ? "h-6 bg-[var(--admin-danger)]"
                : "h-3 bg-[var(--admin-outline)] opacity-40"
          }`}
        />
      ))}
    </div>
  );
}

function DigestRow({
  digest,
  disabled,
  onToggle,
  onEdit,
  onPreview,
  onSendTest,
  onDelete,
}: {
  digest: InsightDigestItem;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onPreview: () => void;
  onSendTest: () => void;
  onDelete: () => void;
}) {
  const outside = digest.recipients.filter((row) => row.outsideDomain).length;
  const failing = digest.status === "failed";
  const sentAt = lastSendAt(digest);

  return (
    <article
      className={`flex flex-col justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition-colors hover:bg-[var(--admin-surface-high)] md:flex-row md:items-center ${
        digest.enabled ? "" : "opacity-50"
      } ${failing ? "border-l-2 border-l-[var(--admin-danger)]" : ""}`}
    >
      <div className="min-w-0 flex-1 pr-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="truncate text-[15px] font-semibold text-[var(--admin-on-surface)]">
            {digest.name}
          </h2>
          <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            {digest.sourceTitle}
          </span>
          <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            {periodLabel(digest.period)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {failing && digest.lastError ? (
            <span className="inline-flex items-center gap-1.5 font-data text-[13px] text-[var(--admin-danger)]">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {digest.lastError}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-data text-[13px] text-[var(--admin-on-surface)]">
              <Clock
                className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              {digest.scheduleLabel}
            </span>
          )}
          <span className="text-xs text-[var(--admin-on-surface-variant)]">
            {digest.contentsLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6 md:shrink-0">
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${outside > 0 ? "bg-[var(--admin-warning)]" : "bg-[var(--admin-success)]"}`}
              title={
                outside > 0
                  ? "Contains addresses outside your domain"
                  : "All recipients are on your domain"
              }
            />
            <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
              {digest.recipients.length} recipient{digest.recipients.length === 1 ? "" : "s"}
              {outside > 0 ? ` (${outside} ext)` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-sm border px-2 py-0.5 font-data text-[11px] uppercase tracking-wider ${statusBadgeClass(digest.status)}`}
            >
              {statusLabel(digest.status)}
            </span>
            {sentAt ? (
              <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatDateTime(sentAt)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="hidden lg:block">
          <HistoryStrip cells={digest.history} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={digest.enabled}
            aria-label={`${digest.enabled ? "Pause" : "Enable"} ${digest.name}`}
            disabled={disabled}
            onClick={() => {
              onToggle(!digest.enabled);
            }}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              digest.enabled
                ? "bg-[var(--admin-primary)]"
                : "border border-[var(--admin-outline)] bg-[var(--admin-surface-high)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform ${
                digest.enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <DropdownMenu
            label={`Actions for ${digest.name}`}
            trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
            contentClassName={menuPanelClassName()}
            triggerClassName="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            items={[
              { key: "edit", label: "Edit", disabled, onSelect: onEdit },
              { key: "preview", label: "Preview email", disabled, onSelect: onPreview },
              { key: "test", label: "Send test", disabled, onSelect: onSendTest },
              { key: "delete", label: "Delete", disabled, onSelect: onDelete },
            ]}
          />
        </div>
      </div>
    </article>
  );
}

function EmptyDigests({ sectionTitle, onCreate }: { sectionTitle: string; onCreate: () => void }) {
  return (
    <div
      className={`${insightPanelClassName} min-h-[420px] items-center justify-center px-6 py-16 text-center`}
    >
      <Mail className="mb-6 h-12 w-12 text-[var(--admin-primary)]" aria-hidden="true" />
      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">No digests yet</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Send a scheduled snapshot of {sectionTitle} to your team.
      </p>
      <button type="button" className={`${insightPrimaryButtonClassName} mt-6`} onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        New digest
      </button>
    </div>
  );
}

function DigestsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading digests">
      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)]">
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] md:grid-cols-6 md:divide-x md:divide-y-0">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={`space-y-2 p-5 ${index === 0 ? "md:col-span-2" : ""}`}>
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-16" />
              <Shimmer className="h-3 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`${insightPanelClassName} flex-row items-center justify-between p-5`}
          >
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" />
              <Shimmer className="h-3 w-64" />
            </div>
            <Shimmer className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className="flex items-center gap-3 text-left"
      onClick={onToggle}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          checked
            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
            : "border-[var(--admin-outline)] bg-[var(--admin-surface)]"
        }`}
        aria-hidden="true"
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
    </button>
  );
}

function TokenSwitch({
  checked,
  label,
  hint,
  onToggle,
}: {
  checked: boolean;
  label: string;
  hint: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center justify-between gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
      onClick={onToggle}
    >
      <span>
        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">{hint}</span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked
            ? "bg-[var(--admin-primary)]"
            : "border border-[var(--admin-outline)] bg-[var(--admin-surface-high)]"
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function DrawerSelect({
  label,
  labelId,
  value,
  options,
  open,
  onToggle,
  onChange,
}: {
  label: string;
  labelId: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const current = options.find((option) => option.value === value)?.label ?? value;
  return (
    <DropdownField
      label={<span className="text-xs text-[var(--admin-on-surface-variant)]">{label}</span>}
      labelId={labelId}
      open={open}
      onToggle={onToggle}
      triggerContent={current}
      panelAriaLabel={label}
      portalZIndex={85}
    >
      <div className="max-h-64 overflow-y-auto p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={dropdownItemClassName}
            onClick={() => {
              onChange(option.value);
              onToggle();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </DropdownField>
  );
}

function DigestDrawer({
  editing,
  form,
  catalog,
  sections,
  timezones,
  weekdays,
  domains,
  recipientDraft,
  mutating,
  canSendTest,
  onRecipientDraftChange,
  onAddRecipient,
  onChange,
  onClose,
  onSave,
  onSendTest,
}: {
  editing: boolean;
  form: DigestForm;
  catalog: InsightDigestCatalogItem[];
  sections: Array<{ slug: string; title: string }>;
  timezones: string[];
  weekdays: Array<{ value: string; label: string }>;
  domains: string[];
  recipientDraft: string;
  mutating: boolean;
  canSendTest: boolean;
  onRecipientDraftChange: (value: string) => void;
  onAddRecipient: (value: string) => void;
  onChange: (form: DigestForm) => void;
  onClose: () => void;
  onSave: () => void;
  onSendTest: () => void;
}) {
  const [openField, setOpenField] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const widgets = catalog.filter((item) => item.defaultViz !== "kpi");
  const selectedWidgets = form.widgetIds.filter((id) => widgets.some((item) => item.id === id));
  const sourceTitle =
    sections.find((section) => section.slug === form.sourceSlug)?.title ?? form.sourceSlug;

  const submitRecipient = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddRecipient(recipientDraft);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] backdrop-blur-[2px]"
        aria-label="Close digest editor"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="digest-drawer-title"
        className="admin-theme relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] motion-safe:animate-[admin-dropdown-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <h2
            id="digest-drawer-title"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            {editing ? "Edit digest" : "New digest"}
          </h2>
          <button
            type="button"
            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Digest name
            </span>
            <input
              className="h-10 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              placeholder="Weekly team update"
              value={form.name}
              onChange={(event) => {
                onChange({ ...form, name: event.target.value });
              }}
            />
          </label>

          <div className="flex flex-col gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            {sections.length > 1 ? (
              <DrawerSelect
                label="Source section"
                labelId="digest-source"
                value={form.sourceSlug}
                options={sections.map((section) => ({ value: section.slug, label: section.title }))}
                open={openField === "source"}
                onToggle={() => {
                  setOpenField((current) => (current === "source" ? null : "source"));
                }}
                onChange={(value) => {
                  onChange({ ...form, sourceSlug: value, widgetIds: [] });
                }}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Source section
                </span>
                <span className="inline-flex w-fit items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-sm text-[var(--admin-on-surface)]">
                  {sourceTitle}
                </span>
              </div>
            )}
            <div>
              <span className="mb-2 block text-xs text-[var(--admin-on-surface-variant)]">
                Default date range
              </span>
              <div
                className={insightSegmentTrackClassName}
                role="radiogroup"
                aria-label="Digest date range"
              >
                {(
                  [
                    { value: "12m" as const, label: "Last 12m" },
                    { value: "30d" as const, label: "Last 30d" },
                    { value: "ytd" as const, label: "YTD" },
                  ] as const
                ).map((option) => {
                  const active = form.period === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={
                        active ? insightSegmentButtonActiveClassName : insightSegmentButtonClassName
                      }
                      onClick={() => {
                        onChange({ ...form, period: option.value });
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="border-b border-[var(--admin-border)] pb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Contents to include
            </h3>
            <TokenSwitch
              checked={form.includeAlerts}
              label="Include alerts"
              hint="Open alerts from this section"
              onToggle={() => {
                onChange({ ...form, includeAlerts: !form.includeAlerts });
              }}
            />
            <TokenSwitch
              checked={form.includeKpis}
              label="Include KPIs"
              hint="Pinned KPI values from the live section"
              onToggle={() => {
                onChange({ ...form, includeKpis: !form.includeKpis });
              }}
            />
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--admin-on-surface)]">Widgets</span>
                <span className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-data text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  {selectedWidgets.length} of {widgets.length} selected
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--admin-border)]">
                {widgets.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                    No chart widgets on this section.
                  </p>
                ) : (
                  widgets.map((widget, index) => {
                    const checked = form.widgetIds.includes(widget.id);
                    return (
                      <div
                        key={widget.id}
                        className={`px-3 py-3 ${index < widgets.length - 1 ? "border-b border-[var(--admin-border)]" : ""}`}
                      >
                        <TokenCheck
                          checked={checked}
                          label={widget.title}
                          onToggle={() => {
                            onChange({
                              ...form,
                              widgetIds: checked
                                ? form.widgetIds.filter((id) => id !== widget.id)
                                : [...form.widgetIds, widget.id],
                            });
                          }}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="border-b border-[var(--admin-border)] pb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Delivery format
            </h3>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Delivery format">
              {FORMAT_OPTIONS.map((option) => {
                const active = form.format === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      onChange({ ...form, format: option.value });
                    }}
                    className={`rounded-lg border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 ${
                      active
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]"
                    }`}
                  >
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                      {option.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Recipients
            </span>
            <form
              onSubmit={submitRecipient}
              className="flex min-h-10 flex-wrap items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] p-2 focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/30"
            >
              {form.recipients.map((email) => {
                const outside = isOutsideDomain(email, domains);
                return (
                  <span
                    key={email}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-sm ${
                      outside
                        ? "border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
                        : "border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
                    }`}
                  >
                    {outside ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {email}
                    <button
                      type="button"
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                      aria-label={`Remove ${email}`}
                      onClick={() => {
                        onChange({
                          ...form,
                          recipients: form.recipients.filter((item) => item !== email),
                        });
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
              <input
                className="min-w-[150px] flex-1 border-none bg-transparent p-1 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
                placeholder="Add email address"
                value={recipientDraft}
                onChange={(event) => {
                  onRecipientDraftChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
                    if (recipientDraft.trim()) {
                      event.preventDefault();
                      onAddRecipient(recipientDraft.replace(/,/g, ""));
                    }
                  }
                }}
                onBlur={() => {
                  if (recipientDraft.trim()) onAddRecipient(recipientDraft);
                }}
              />
            </form>
            <span className="text-xs text-[var(--admin-on-surface-variant)]">
              Addresses outside your academy domain are marked.
            </span>
          </div>

          <div className="flex flex-col gap-3 pb-4">
            <h3 className="border-b border-[var(--admin-border)] pb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Schedule
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_1fr]">
              <DrawerSelect
                label="Cadence"
                labelId="digest-cadence"
                value={form.cadence}
                options={[...CADENCE_OPTIONS]}
                open={openField === "cadence"}
                onToggle={() => {
                  setOpenField((current) => (current === "cadence" ? null : "cadence"));
                }}
                onChange={(value) => {
                  onChange({ ...form, cadence: value as DigestForm["cadence"] });
                }}
              />
              {form.cadence === "weekly" ? (
                <DrawerSelect
                  label="Weekday"
                  labelId="digest-weekday"
                  value={form.weekday}
                  options={weekdays}
                  open={openField === "weekday"}
                  onToggle={() => {
                    setOpenField((current) => (current === "weekday" ? null : "weekday"));
                  }}
                  onChange={(value) => {
                    onChange({ ...form, weekday: value });
                  }}
                />
              ) : form.cadence === "monthly" ? (
                <DrawerSelect
                  label="Day"
                  labelId="digest-monthday"
                  value={String(form.monthDay)}
                  options={Array.from({ length: 28 }, (_, index) => ({
                    value: String(index + 1),
                    label: String(index + 1),
                  }))}
                  open={openField === "monthday"}
                  onToggle={() => {
                    setOpenField((current) => (current === "monthday" ? null : "monthday"));
                  }}
                  onChange={(value) => {
                    onChange({ ...form, monthDay: Number(value) });
                  }}
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Repeat</span>
                  <div className="flex h-10 items-center rounded border border-[var(--admin-outline)] px-3 text-sm text-[var(--admin-on-surface-variant)]">
                    Every day
                  </div>
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Time</span>
                <input
                  type="time"
                  aria-label="Send time"
                  value={form.time}
                  onChange={(event) => {
                    onChange({ ...form, time: event.target.value });
                  }}
                  className="h-10 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                />
              </label>
            </div>
            <DrawerSelect
              label="Timezone"
              labelId="digest-timezone"
              value={form.timezone}
              options={timezones.map((zone) => ({ value: zone, label: zone.replace(/_/g, " ") }))}
              open={openField === "timezone"}
              onToggle={() => {
                setOpenField((current) => (current === "timezone" ? null : "timezone"));
              }}
              onChange={(value) => {
                onChange({ ...form, timezone: value });
              }}
            />
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className={insightGhostButtonClassName}
            disabled={mutating || !canSendTest}
            onClick={onSendTest}
          >
            Send a test
          </button>
          <div className="flex gap-3">
            <button type="button" className={insightGhostButtonClassName} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={insightPrimaryButtonClassName}
              disabled={mutating || !form.name.trim() || form.recipients.length === 0}
              onClick={onSave}
            >
              {editing ? "Save digest" : "Create digest"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function DeleteDigestModal({
  digest,
  mutating,
  onCancel,
  onConfirm,
}: {
  digest: InsightDigestItem;
  mutating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-digest-title"
        className="admin-theme flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2
              id="delete-digest-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Delete {digest.name}?
            </h2>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] outline-none hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onCancel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            This will permanently remove the digest and its schedule for{" "}
            <span className="font-data text-[var(--admin-on-surface)]">
              {digest.recipients.length}
            </span>{" "}
            recipient
            {digest.recipients.length === 1 ? "" : "s"}. This cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
          <button
            type="button"
            className={insightGhostButtonClassName}
            onClick={onCancel}
            disabled={mutating}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutating}
            onClick={onConfirm}
            className="inline-flex h-11 items-center justify-center gap-2 rounded bg-[var(--admin-danger)] px-4 text-sm font-medium text-[var(--admin-on-danger)] outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete digest
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailPreviewModal({
  preview,
  onClose,
}: {
  preview: InsightDigestPreview;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const showFunnelNote = preview.charts.some((chart) => chart.id === "engagement-funnel");

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 py-12 backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close email preview"
        onClick={onClose}
      />
      <main
        role="dialog"
        aria-modal="true"
        aria-labelledby="digest-email-title"
        className="admin-theme relative z-10 flex w-full max-w-[640px] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-8 text-center">
          <h2
            id="digest-email-title"
            className="text-2xl font-semibold text-[var(--admin-on-surface)]"
          >
            {preview.academyName}
          </h2>
          <p className="mt-1 text-base font-semibold text-[var(--admin-on-surface-variant)]">
            {preview.sectionTitle}
          </p>
          <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
            {preview.digestName} · {preview.periodLabel}
          </p>
        </header>
        <div className="flex flex-col gap-8 p-8">
          {preview.alerts.length > 0 ? (
            <div className="space-y-3">
              {preview.alerts.map((alert) => (
                <section
                  key={alert.id}
                  className="flex items-start gap-3 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
                >
                  <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-[var(--admin-danger)]">
                      {alert.title}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface)]">{alert.message}</p>
                  </div>
                </section>
              ))}
            </div>
          ) : null}
          {preview.kpis.length > 0 ? (
            <section>
              <h3 className="mb-4 border-b border-[var(--admin-border)] pb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                Key metrics
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                {preview.kpis.map((kpi) => (
                  <div key={kpi.id}>
                    <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      {kpi.title}
                    </p>
                    <p className={insightKpiValueClassName}>
                      {kpi.money ? formatInsightMoney(kpi.value) : formatInsightNumber(kpi.value)}
                    </p>
                    {kpi.money && preview.currency ? (
                      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                        {preview.currency}
                      </p>
                    ) : null}
                    {kpi.deltaPct != null ? (
                      <p
                        className={`mt-1 inline-flex items-center gap-1 text-xs ${
                          kpi.deltaPct >= 0
                            ? "text-[var(--admin-success)]"
                            : "text-[var(--admin-warning)]"
                        }`}
                      >
                        {kpi.deltaPct >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {kpi.deltaPct >= 0 ? "+" : ""}
                        {kpi.deltaPct.toFixed(0)}% vs prior
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {preview.charts.length > 0 && preview.format !== "link" ? (
            <section className="space-y-6">
              {preview.charts.map((chart) => (
                <div key={chart.id}>
                  <h3 className="mb-3 text-base font-semibold text-[var(--admin-on-surface)]">
                    {chart.title}
                  </h3>
                  <div className="flex h-48 items-end gap-1 overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                    {chart.sparkline.length > 0 ? (
                      chart.sparkline.map((point, index) => {
                        const max = Math.max(...chart.sparkline, 1);
                        const height = Math.max(8, Math.round((point / max) * 160));
                        return (
                          <span
                            key={`${chart.id}-${index}`}
                            className="flex-1 rounded-sm bg-[var(--admin-primary)] opacity-80"
                            style={{ height }}
                          />
                        );
                      })
                    ) : (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        No series for this period.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {showFunnelNote ? (
            <p className="text-center text-xs italic text-[var(--admin-on-surface-variant)]">
              {FUNNEL_PREVIEW_NOTE}
            </p>
          ) : null}
        </div>
        <footer className="flex flex-col items-center gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-8">
          <Link href={preview.liveHref} prefetch={false} className={insightPrimaryButtonClassName}>
            View the live section
          </Link>
          <button
            type="button"
            className="text-xs text-[var(--admin-on-surface-variant)] underline"
            onClick={onClose}
          >
            Close preview
          </button>
        </footer>
      </main>
    </div>
  );
}
