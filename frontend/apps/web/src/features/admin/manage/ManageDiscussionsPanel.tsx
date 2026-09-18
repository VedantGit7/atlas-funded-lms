"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import {
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

type ModerationCaseItem = {
  id: string;
  status: string;
  targetType: string;
  targetId: string;
  reasonKey: string | null;
  createdAt: string;
  target: {
    previewText: string;
    title: string | null;
    deleted?: boolean;
  } | null;
};

type CasesListResponse = {
  data: { items: ModerationCaseItem[] };
};

type PendingDecision =
  | { caseItem: ModerationCaseItem; decisionKey: "actioned"; deleteContent: boolean }
  | { caseItem: ModerationCaseItem; decisionKey: "rejected" | "closed" };

const OPEN_STATUSES = new Set(["OPEN", "REVIEWING"]);

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusTone(status: string): "success" | "danger" | "primary" | "neutral" {
  if (status === "ACTIONED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "REVIEWING") return "primary";
  return "neutral";
}

export function ManageDiscussionsPanel() {
  const [items, setItems] = useState<ModerationCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDecision, setPendingDecision] = useState<PendingDecision | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const attempts = [
        "/api/v1/moderation/cases?limit=50&status=OPEN",
        "/api/v1/moderation/cases?limit=50&status=REVIEWING",
        "/api/v1/moderation/cases?limit=50",
      ];

      let loaded: ModerationCaseItem[] = [];
      for (const path of attempts) {
        try {
          const response = await clientApi.get<CasesListResponse>(path);
          loaded = response.data.items;
          break;
        } catch {
          // try next query shape
        }
      }

      setItems(loaded.filter((item) => OPEN_STATUSES.has(item.status)));
    } catch (caught) {
      setError(formatError(caught));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter(
      (item) =>
        item.targetType.toLowerCase().includes(normalized) ||
        item.status.toLowerCase().includes(normalized) ||
        (item.target?.previewText ?? "").toLowerCase().includes(normalized) ||
        (item.reasonKey ?? "").toLowerCase().includes(normalized),
    );
  }, [items, query]);

  async function submitDecision(decision: PendingDecision) {
    setBusyId(decision.caseItem.id);
    setError(null);
    try {
      const body =
        decision.decisionKey === "actioned"
          ? {
              decisionKey: "actioned" as const,
              ...(decision.deleteContent ? { contentAction: "delete" as const } : {}),
            }
          : { decisionKey: decision.decisionKey };

      await clientApi.post(
        `/api/v1/moderation/cases/${decision.caseItem.id}/decide`,
        body,
        `moderation-decide-${decision.caseItem.id}`,
      );
      setPendingDecision(null);
      setItems((previous) => previous.filter((row) => row.id !== decision.caseItem.id));
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search discussion cases"
            aria-label="Search discussion cases"
            className={manageSearchInputClassName}
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void loadCases();
          }}
          className={manageSecondaryButtonClassName}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading discussion cases…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">
            No open discussion cases
          </p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            {query.trim()
              ? "No cases match your search."
              : "Reported discussions and comments will appear here when moderation cases are open."}
          </p>
        </div>
      ) : (
        <div className={manageTableCardClassName}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {filtered.length} open {filtered.length === 1 ? "case" : "cases"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Target</th>
                  <th className={manageTableThClassName}>Preview</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={manageTableThClassName}>Created</th>
                  <th className={`${manageTableThClassName} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    <td className={manageTableTdClassName}>
                      <span className="font-semibold capitalize">{item.targetType}</span>
                      {item.reasonKey ? (
                        <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                          {item.reasonKey}
                        </p>
                      ) : null}
                    </td>
                    <td className={`${manageTableTdClassName} max-w-xs truncate`}>
                      {item.target?.previewText ?? item.target?.title ?? "—"}
                    </td>
                    <td className={manageTableTdClassName}>
                      <span className={manageStatusChipClassName(statusTone(item.status))}>
                        {item.status}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>{formatDate(item.createdAt)}</td>
                    <td className={manageTableTdClassName}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <CaseActionButton
                          label="Action"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setPendingDecision({
                              caseItem: item,
                              decisionKey: "actioned",
                              deleteContent: false,
                            });
                          }}
                        />
                        <CaseActionButton
                          label="Delete content"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setPendingDecision({
                              caseItem: item,
                              decisionKey: "actioned",
                              deleteContent: true,
                            });
                          }}
                        />
                        <CaseActionButton
                          label="Reject"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setPendingDecision({ caseItem: item, decisionKey: "rejected" });
                          }}
                        />
                        <CaseActionButton
                          label="Close"
                          disabled={busyId === item.id}
                          onClick={() => {
                            setPendingDecision({ caseItem: item, decisionKey: "closed" });
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDecision !== null}
        title={decisionTitle(pendingDecision)}
        description={decisionDescription(pendingDecision)}
        confirmLabel="Confirm"
        destructive={pendingDecision?.decisionKey === "actioned" && pendingDecision.deleteContent}
        busy={busyId !== null}
        onConfirm={() => {
          if (pendingDecision) void submitDecision(pendingDecision);
        }}
        onCancel={() => {
          setPendingDecision(null);
        }}
      />
    </div>
  );
}

function CaseActionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function decisionTitle(decision: PendingDecision | null): string {
  if (!decision) return "";
  if (decision.decisionKey === "actioned" && decision.deleteContent)
    return "Delete reported content?";
  if (decision.decisionKey === "actioned") return "Mark case as actioned?";
  if (decision.decisionKey === "rejected") return "Reject this case?";
  return "Close this case?";
}

function decisionDescription(decision: PendingDecision | null): string {
  if (!decision) return "";
  const preview = decision.caseItem.target?.previewText ?? decision.caseItem.targetType;
  if (decision.decisionKey === "actioned" && decision.deleteContent) {
    return `The reported content will be deleted: "${preview.slice(0, 120)}".`;
  }
  if (decision.decisionKey === "actioned") {
    return `Apply moderation action to: "${preview.slice(0, 120)}".`;
  }
  if (decision.decisionKey === "rejected") {
    return `Dismiss the report for: "${preview.slice(0, 120)}".`;
  }
  return `Close the case without further action.`;
}
