"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { MembersListResponse } from "@atlas/contracts/membership/schemas/admin-members";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import {
  manageSearchInputClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

type MemberRow = MembersListResponse["data"]["items"][number];

type ConfirmAction =
  | { type: "suspend"; member: MemberRow }
  | { type: "archive"; member: MemberRow }
  | { type: "unarchive"; member: MemberRow };

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

function memberLabel(member: MemberRow): string {
  return (
    member.profile?.displayName ??
    member.invitedEmail ??
    member.accountEmail ??
    `Member ${member.id.slice(0, 8)}`
  );
}

function memberEmail(member: MemberRow): string | null {
  return member.invitedEmail ?? member.accountEmail ?? null;
}

function statusTone(status: string, archivedAt: string | null | undefined): "success" | "danger" | "neutral" {
  if (archivedAt) return "neutral";
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

function statusLabel(member: MemberRow): string {
  if (member.archivedAt) return "Archived";
  return member.status.charAt(0) + member.status.slice(1).toLowerCase();
}

export function ManageArchiveLearnersPanel() {
  const [items, setItems] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [archiveApiAvailable, setArchiveApiAvailable] = useState<boolean | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (query.trim()) params.set("search", query.trim());
      const response = await clientApi.get<MembersListResponse>(`/api/v1/members?${params.toString()}`);
      setItems(response.data.items);
    } catch (caught) {
      setError(formatError(caught));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadMembers();
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, [loadMembers]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((member) => {
      const email = (memberEmail(member) ?? "").toLowerCase();
      const name = (member.profile?.displayName ?? "").toLowerCase();
      return name.includes(normalized) || email.includes(normalized);
    });
  }, [items, query]);

  async function executeAction(action: ConfirmAction) {
    setBusyId(action.member.id);
    setError(null);
    try {
      if (action.type === "suspend") {
        await clientApi.post(`/api/v1/members/${action.member.id}/suspend`, null, "member-suspend");
      } else if (action.type === "archive") {
        if (archiveApiAvailable !== false) {
          try {
            await clientApi.post(
              `/api/v1/manage/learners/${action.member.id}/archive`,
              null,
              `learner-archive-${action.member.id}`,
            );
            setArchiveApiAvailable(true);
          } catch (caught) {
            if (caught instanceof ClientApiError && caught.status === 404) {
              setArchiveApiAvailable(false);
              await clientApi.post(`/api/v1/members/${action.member.id}/suspend`, null, "member-suspend");
            } else {
              throw caught;
            }
          }
        } else {
          await clientApi.post(`/api/v1/members/${action.member.id}/suspend`, null, "member-suspend");
        }
      } else {
        try {
          await clientApi.post(
            `/api/v1/manage/learners/${action.member.id}/unarchive`,
            null,
            `learner-unarchive-${action.member.id}`,
          );
        } catch (caught) {
          if (caught instanceof ClientApiError && caught.status === 404) {
            setError("Unarchive is not available. Only suspend is supported.");
            return;
          }
          throw caught;
        }
      }

      setConfirmAction(null);
      await loadMembers();
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
          placeholder="Search by name or email"
          aria-label="Search learners"
          className={manageSearchInputClassName}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading learners…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No learners found</p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            {query.trim() ? "Try a different name or email." : "Members will appear here once they join."}
          </p>
        </div>
      ) : (
        <div className={manageTableCardClassName}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {filtered.length} {filtered.length === 1 ? "learner" : "learners"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Name</th>
                  <th className={manageTableThClassName}>Email</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={`${manageTableThClassName} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                    <td className={`${manageTableTdClassName} font-semibold`}>{memberLabel(member)}</td>
                    <td className={manageTableTdClassName}>{memberEmail(member) ?? "—"}</td>
                    <td className={manageTableTdClassName}>
                      <span className={manageStatusChipClassName(statusTone(member.status, member.archivedAt))}>
                        {statusLabel(member)}
                      </span>
                    </td>
                    <td className={manageTableTdClassName}>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {member.archivedAt ? (
                          <LearnerActionButton
                            label="Unarchive"
                            disabled={busyId === member.id}
                            onClick={() => {
                              setConfirmAction({ type: "unarchive", member });
                            }}
                          />
                        ) : member.status === "ACTIVE" ? (
                          <>
                            <LearnerActionButton
                              label="Suspend"
                              disabled={busyId === member.id}
                              onClick={() => {
                                setConfirmAction({ type: "suspend", member });
                              }}
                            />
                            <LearnerActionButton
                              label="Archive"
                              disabled={busyId === member.id}
                              onClick={() => {
                                setConfirmAction({ type: "archive", member });
                              }}
                            />
                          </>
                        ) : null}
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
        open={confirmAction !== null}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction)}
        confirmLabel={confirmLabel(confirmAction)}
        destructive={confirmAction?.type === "suspend" || confirmAction?.type === "archive"}
        busy={busyId !== null}
        onConfirm={() => {
          if (confirmAction) void executeAction(confirmAction);
        }}
        onCancel={() => {
          setConfirmAction(null);
        }}
      />
    </div>
  );
}

function LearnerActionButton({
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

function confirmTitle(action: ConfirmAction | null): string {
  if (!action) return "";
  if (action.type === "suspend") return "Suspend learner?";
  if (action.type === "archive") return "Archive learner?";
  return "Restore learner access?";
}

function confirmDescription(action: ConfirmAction | null): string {
  if (!action) return "";
  const name = memberLabel(action.member);
  if (action.type === "suspend") {
    return `${name} will lose access until reactivated.`;
  }
  if (action.type === "archive") {
    return `${name} will be archived. Progress and history are preserved.`;
  }
  return `${name} will be unarchived and regain access.`;
}

function confirmLabel(action: ConfirmAction | null): string {
  if (!action) return "Confirm";
  if (action.type === "suspend") return "Suspend";
  if (action.type === "archive") return "Archive";
  return "Unarchive";
}
