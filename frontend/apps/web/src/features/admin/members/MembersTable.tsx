"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Download,
  Mail,
  MoreVertical,
  Search,
  SquareArrowOutUpRight,
  Trash2,
  UserCog,
} from "lucide-react";
import type { MembersListResponse } from "@atlas/contracts/membership/schemas/admin-members";
import {
  Avatar,
  Badge,
  Checkbox,
  DropdownMenu,
  EmptyState,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  type DropdownMenuItem,
  type SelectOption,
} from "@atlas/design-system";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { VirtualizedTable } from "../../../components/patterns/VirtualizedTable";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { memberHasOwnerRole } from "./member-owner-guard";
import { MEMBERS_LIST_REFRESH_EVENT } from "./members-events";

export type MemberRow = {
  id: string;
  status: string;
  invitedEmail?: string | null | undefined;
  accountEmail?: string | null | undefined;
  joinedAt?: string | null | undefined;
  lastActiveAt?: string | null | undefined;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  roles?: Array<{ id: string; key: string; name: string; isSystem: boolean }> | undefined;
};

export type RoleOption = {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
};

type PageInfo = { nextCursor: string | null; hasNextPage: boolean };

type MembersTableProps = {
  initialItems: MemberRow[];
  initialTotalCount: number;
  initialPageInfo: PageInfo;
  availableRoles: RoleOption[];
  pageSize: number;
};

type ConfirmAction =
  | { type: "suspend" | "remove"; scope: "single"; memberId: string }
  | { type: "suspend" | "remove"; scope: "bulk"; memberIds: string[] };

const STATUS_OPTIONS: SelectOption[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "SUSPENDED", label: "Suspended" },
];

const selectClassName =
  "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const colWidths = {
  select: "w-[44px]",
  role: "w-[150px]",
  joined: "w-[120px]",
  lastActive: "w-[150px]",
  status: "w-[120px]",
  actions: "w-[56px]",
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  return "Request failed.";
}

function statusVariant(status: string): "success" | "warning" | "destructive" | "default" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INVITED":
      return "warning";
    case "SUSPENDED":
    case "REMOVED":
      return "destructive";
    default:
      return "default";
  }
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function memberEmail(member: MemberRow): string | null {
  return member.invitedEmail ?? member.accountEmail ?? null;
}

function memberLabel(member: MemberRow): string {
  return member.profile?.displayName ?? memberEmail(member) ?? `Member ${member.id.slice(0, 8)}`;
}

function roleLabel(member: MemberRow): string | null {
  const roles = member.roles ?? [];
  if (roles.length === 0) return null;
  const first = roles[0]?.name ?? null;
  if (!first) return null;
  return roles.length > 1 ? `${first} +${String(roles.length - 1)}` : first;
}

function formatJoined(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type Presence = "online" | "idle" | "offline";

function presenceOf(iso: string | null | undefined): Presence {
  if (!iso) return "offline";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "offline";
  const minutes = (Date.now() - then) / 60000;
  if (minutes <= 5) return "online";
  if (minutes <= 30) return "idle";
  return "offline";
}

function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${String(months)}mo ago`;
  return `${String(Math.floor(months / 12))}y ago`;
}

const presenceDotClass: Record<Exclude<Presence, "offline">, string> = {
  online: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]",
  idle: "bg-amber-500",
};

function hasValidTimestamp(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return !Number.isNaN(new Date(iso).getTime());
}

/**
 * Renders the "Last active" cell. A coloured presence dot is only shown when the
 * member is genuinely online/idle — it is not implied for people who have never
 * been recorded active. Members who have not joined yet (invited) read "—" since
 * presence is not applicable to them.
 */
function PresenceCell({ iso, status }: { iso: string | null | undefined; status: string }) {
  if (!hasValidTimestamp(iso)) {
    const text = status === "INVITED" ? "—" : "Never";
    return <span className="text-sm text-[var(--admin-on-surface-variant)]">{text}</span>;
  }

  const presence = presenceOf(iso);
  return (
    <span className="inline-flex items-center gap-2">
      {presence === "offline" ? null : (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${presenceDotClass[presence]}`}
          aria-hidden="true"
        />
      )}
      <span className="text-sm text-[var(--admin-on-surface-variant)]">
        {formatLastActive(iso)}
      </span>
    </span>
  );
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function rolesToText(member: MemberRow): string {
  return (member.roles ?? []).map((role) => role.name).join(", ");
}

export function MembersTable({
  initialItems,
  initialTotalCount,
  initialPageInfo,
  availableRoles,
  pageSize,
}: MembersTableProps) {
  const router = useRouter();

  const [items, setItems] = useState<MemberRow[]>(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [pageInfo, setPageInfo] = useState<PageInfo>(initialPageInfo);
  const [pageIndex, setPageIndex] = useState(0);
  const pageStartCursors = useRef<Array<string | undefined>>([undefined]);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const assignableRoles = useMemo(
    () => availableRoles.filter((role) => role.key !== "owner"),
    [availableRoles],
  );
  const [editRoleId, setEditRoleId] = useState<string>("");

  const buildQuery = useCallback(
    (cursor: string | undefined) => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (cursor) params.set("cursor", cursor);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (search.trim()) params.set("search", search.trim());
      return params.toString();
    },
    [pageSize, statusFilter, roleFilter, search],
  );

  const loadPage = useCallback(
    async (cursor: string | undefined) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await clientApi.get<MembersListResponse>(
          `/api/v1/members?${buildQuery(cursor)}`,
        );
        setItems(result.data.items);
        setTotalCount(result.data.totalCount);
        setPageInfo(result.data.pageInfo);
        setSelectedIds(new Set());
      } catch (error) {
        setErrorMessage(formatClientError(error));
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
    }, 350);
    return () => {
      clearTimeout(handle);
    };
  }, [searchInput]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    pageStartCursors.current = [undefined];
    setPageIndex(0);
    void loadPage(undefined);
  }, [statusFilter, roleFilter, search, loadPage]);

  useEffect(() => {
    function onMembersRefresh() {
      pageStartCursors.current = [undefined];
      setPageIndex(0);
      void loadPage(undefined);
    }

    window.addEventListener(MEMBERS_LIST_REFRESH_EVENT, onMembersRefresh);
    return () => {
      window.removeEventListener(MEMBERS_LIST_REFRESH_EVENT, onMembersRefresh);
    };
  }, [loadPage]);

  const refreshCurrentPage = useCallback(async () => {
    await loadPage(pageStartCursors.current[pageIndex]);
    router.refresh();
  }, [loadPage, pageIndex, router]);

  function goNext() {
    if (!pageInfo.hasNextPage || !pageInfo.nextCursor) return;
    const next = pageInfo.nextCursor;
    pageStartCursors.current = [...pageStartCursors.current.slice(0, pageIndex + 1), next];
    setPageIndex((value) => value + 1);
    void loadPage(next);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    const previousIndex = pageIndex - 1;
    setPageIndex(previousIndex);
    void loadPage(pageStartCursors.current[previousIndex]);
  }

  const selectable = useMemo(
    () => items.filter((member) => !memberHasOwnerRole(member.roles)),
    [items],
  );

  const selectedMembers = useMemo(
    () => selectable.filter((member) => selectedIds.has(member.id)),
    [selectable, selectedIds],
  );

  const selectedCount = selectedMembers.length;
  const selectedInvited = useMemo(
    () => selectedMembers.filter((member) => member.status === "INVITED"),
    [selectedMembers],
  );

  const allSelected = selectable.length > 0 && selectedCount === selectable.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  function toggleOne(memberId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(() => (checked ? new Set(selectable.map((member) => member.id)) : new Set()));
  }

  async function suspendMember(memberId: string) {
    setBusyId(memberId);
    setErrorMessage(null);
    try {
      await clientApi.post(`/api/v1/members/${memberId}/suspend`, null, "member-suspend");
      setConfirmAction(null);
      await refreshCurrentPage();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(memberId: string) {
    setBusyId(memberId);
    setErrorMessage(null);
    try {
      await clientApi.delete(`/api/v1/members/${memberId}`, "member-remove");
      setConfirmAction(null);
      await refreshCurrentPage();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(memberId: string) {
    setBusyId(memberId);
    setErrorMessage(null);
    try {
      await clientApi.post(
        `/api/v1/members/${memberId}/resend-invite`,
        null,
        "member-resend-invite",
      );
      await refreshCurrentPage();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyId(null);
    }
  }

  async function runBulk(type: "suspend" | "remove", memberIds: string[]) {
    setBulkBusy(true);
    setErrorMessage(null);
    try {
      for (const memberId of memberIds) {
        if (type === "suspend") {
          await clientApi.post(`/api/v1/members/${memberId}/suspend`, null, "member-suspend");
        } else {
          await clientApi.delete(`/api/v1/members/${memberId}`, "member-remove");
        }
      }
      setConfirmAction(null);
      await refreshCurrentPage();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkResend(memberIds: string[]) {
    setBulkBusy(true);
    setErrorMessage(null);
    try {
      for (const memberId of memberIds) {
        await clientApi.post(
          `/api/v1/members/${memberId}/resend-invite`,
          null,
          "member-resend-invite",
        );
      }
      await refreshCurrentPage();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkAssignRole(memberIds: string[], roleId: string) {
    setBulkBusy(true);
    setErrorMessage(null);
    let failures = 0;
    let lastError = "";
    try {
      for (const memberId of memberIds) {
        try {
          await clientApi.post(
            `/api/v1/members/${memberId}/roles`,
            { roleId },
            "member-assign-role",
          );
        } catch (error) {
          failures += 1;
          lastError = formatClientError(error);
        }
      }
      setEditRolesOpen(false);
      setEditRoleId("");
      if (failures > 0) {
        setErrorMessage(`Could not assign the role to ${String(failures)} member(s). ${lastError}`);
      }
      await refreshCurrentPage();
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setErrorMessage(null);
    try {
      const header = ["Name", "Email", "Status", "Roles", "Joined", "Last active"];
      const rows: string[][] = [header];
      let cursor: string | undefined = undefined;
      for (let page = 0; page < 100; page += 1) {
        const result: MembersListResponse = await clientApi.get<MembersListResponse>(
          `/api/v1/members?${buildQuery(cursor)}`,
        );
        for (const member of result.data.items) {
          rows.push([
            memberLabel(member),
            memberEmail(member) ?? "",
            statusLabel(member.status),
            rolesToText(member),
            formatJoined(member.joinedAt),
            member.lastActiveAt ? new Date(member.lastActiveAt).toISOString() : "",
          ]);
        }
        if (!result.data.pageInfo.hasNextPage || !result.data.pageInfo.nextCursor) break;
        cursor = result.data.pageInfo.nextCursor;
      }

      const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setExporting(false);
    }
  }

  function rowActions(member: MemberRow): DropdownMenuItem[] {
    const isOwnerProtected = memberHasOwnerRole(member.roles);
    const disabled = busyId === member.id || bulkBusy;
    const actions: DropdownMenuItem[] = [
      {
        key: "open",
        label: "Open profile",
        icon: <SquareArrowOutUpRight className="h-4 w-4" aria-hidden="true" />,
        onSelect: () => {
          router.push(`/admin/members/${member.id}`);
        },
      },
    ];

    if (member.status === "INVITED") {
      actions.push({
        key: "resend",
        label: "Resend invite",
        icon: <Mail className="h-4 w-4" aria-hidden="true" />,
        disabled,
        onSelect: () => {
          void resendInvite(member.id);
        },
      });
    }

    actions.push(
      {
        key: "suspend",
        label: "Suspend",
        icon: <Ban className="h-4 w-4" aria-hidden="true" />,
        disabled: disabled || isOwnerProtected,
        onSelect: () => {
          setConfirmAction({ type: "suspend", scope: "single", memberId: member.id });
        },
      },
      {
        key: "remove",
        label: "Remove",
        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
        destructive: true,
        disabled: disabled || isOwnerProtected,
        onSelect: () => {
          setConfirmAction({ type: "remove", scope: "single", memberId: member.id });
        },
      },
    );

    return actions;
  }

  const rangeStart = items.length === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = pageIndex * pageSize + items.length;

  const hasActiveFilters = statusFilter !== "ALL" || roleFilter !== "ALL" || search.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <label htmlFor="members-search" className="sr-only">
            Filter members by name or email
          </label>
          <input
            id="members-search"
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="members-status" className="sr-only">
            Filter by status
          </label>
          <Select
            id="members-status"
            ariaLabel="Filter by status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            className={`${selectClassName} min-w-[150px]`}
          />

          <label htmlFor="members-role" className="sr-only">
            Filter by role
          </label>
          <Select
            id="members-role"
            ariaLabel="Filter by role"
            value={roleFilter}
            onValueChange={setRoleFilter}
            options={[
              { value: "ALL", label: "All roles" },
              ...availableRoles.map((option) => ({ value: option.key, label: option.name })),
            ]}
            disabled={availableRoles.length === 0}
            className={`${selectClassName} min-w-[140px]`}
          />

          <button
            type="button"
            onClick={() => {
              void exportCsv();
            }}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/40 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {errorMessage}
        </p>
      ) : null}

      {items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="No matching members"
            description="Try adjusting your search or filters."
          />
        ) : (
          <EmptyState title="No members yet" description="Invite someone to get started." />
        )
      ) : (
        <>
          {/* Desktop: virtualized table */}
          <div className="relative hidden md:block">
            {selectedCount > 0 ? (
              <div className="pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 -translate-y-full">
                <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-[var(--admin-border)] bg-[var(--admin-on-surface)] px-5 py-2.5 text-[var(--admin-bg)] shadow-2xl">
                  <span className="text-sm font-semibold">{selectedCount} selected</span>
                  <span className="h-4 w-px bg-current opacity-20" aria-hidden="true" />
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => {
                      setEditRoleId("");
                      setEditRolesOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    <UserCog className="h-4 w-4" aria-hidden="true" />
                    Edit role
                  </button>
                  {selectedInvited.length > 0 ? (
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => {
                        void runBulkResend(selectedInvited.map((member) => member.id));
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      Resend invite
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => {
                      setConfirmAction({
                        type: "suspend",
                        scope: "bulk",
                        memberIds: selectedMembers.map((member) => member.id),
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Suspend
                  </button>
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => {
                      setConfirmAction({
                        type: "remove",
                        scope: "bulk",
                        memberIds: selectedMembers.map((member) => member.id),
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-danger)] transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <VirtualizedTable
                rows={items}
                getRowKey={(member) => member.id}
                header={
                  <Table className="table-fixed">
                    <TableHead>
                      <TableRow className="border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:bg-[var(--admin-surface-low)]">
                        <TableHeaderCell className={`${colWidths.select} pl-4`}>
                          <Checkbox
                            ref={headerCheckboxRef}
                            aria-label="Select all members"
                            checked={allSelected}
                            disabled={selectable.length === 0}
                            onChange={(event) => {
                              toggleAll(event.target.checked);
                            }}
                            className="accent-[var(--admin-primary)]"
                          />
                        </TableHeaderCell>
                        <TableHeaderCell className="uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                          Member
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`${colWidths.role} uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]`}
                        >
                          Role
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`${colWidths.joined} hidden uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] lg:table-cell`}
                        >
                          Joined
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`${colWidths.lastActive} hidden uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] lg:table-cell`}
                        >
                          Last active
                        </TableHeaderCell>
                        <TableHeaderCell
                          className={`${colWidths.status} uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]`}
                        >
                          Status
                        </TableHeaderCell>
                        <TableHeaderCell className={`${colWidths.actions} pr-4 text-right`}>
                          <span className="sr-only">Actions</span>
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                  </Table>
                }
                renderRow={(member) => {
                  const label = memberLabel(member);
                  const email = memberEmail(member);
                  const showEmail = email !== null && email !== label;
                  const role = roleLabel(member);
                  const isOwnerProtected = memberHasOwnerRole(member.roles);
                  const selected = selectedIds.has(member.id);

                  return (
                    <Table className="table-fixed">
                      <TableBody>
                        <TableRow
                          className={`border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]/50 ${
                            selected ? "bg-[var(--admin-primary)]/5" : ""
                          }`}
                        >
                          <TableCell className={`${colWidths.select} pl-4`}>
                            <Checkbox
                              aria-label={`Select ${label}`}
                              checked={selected}
                              disabled={isOwnerProtected}
                              onChange={(event) => {
                                toggleOne(member.id, event.target.checked);
                              }}
                              className="accent-[var(--admin-primary)]"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                size="md"
                                name={label}
                                src={member.profile?.avatarUrl}
                                fallbackClassName="bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]"
                              />
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/members/${member.id}`}
                                  className="block truncate text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
                                >
                                  {label}
                                </Link>
                                {showEmail ? (
                                  <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                                    {email}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={colWidths.role}>
                            {role ? (
                              <Badge variant="outline">{role}</Badge>
                            ) : (
                              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell
                            className={`${colWidths.joined} hidden text-sm text-[var(--admin-on-surface-variant)] lg:table-cell`}
                          >
                            {formatJoined(member.joinedAt)}
                          </TableCell>
                          <TableCell className={`${colWidths.lastActive} hidden lg:table-cell`}>
                            <PresenceCell iso={member.lastActiveAt} status={member.status} />
                          </TableCell>
                          <TableCell className={colWidths.status}>
                            <Badge variant={statusVariant(member.status)}>
                              {statusLabel(member.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className={`${colWidths.actions} pr-4 text-right`}>
                            <DropdownMenu
                              label={`Actions for ${label}`}
                              align="end"
                              trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
                              items={rowActions(member)}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  );
                }}
              />
            </div>
          </div>

          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {items.map((member) => {
              const label = memberLabel(member);
              const email = memberEmail(member);
              const showEmail = email !== null && email !== label;
              const role = roleLabel(member);
              const isOwnerProtected = memberHasOwnerRole(member.roles);
              const selected = selectedIds.has(member.id);

              return (
                <div
                  key={member.id}
                  className={`rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 ${
                    selected ? "ring-1 ring-[var(--admin-primary)]/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-label={`Select ${label}`}
                      checked={selected}
                      disabled={isOwnerProtected}
                      onChange={(event) => {
                        toggleOne(member.id, event.target.checked);
                      }}
                      className="mt-1 accent-[var(--admin-primary)]"
                    />
                    <Avatar
                      size="md"
                      name={label}
                      src={member.profile?.avatarUrl}
                      fallbackClassName="bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]"
                      >
                        {label}
                      </Link>
                      {showEmail ? (
                        <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                          {email}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(member.status)}>
                          {statusLabel(member.status)}
                        </Badge>
                        {role ? <Badge variant="outline">{role}</Badge> : null}
                      </div>
                      <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                        <PresenceCell iso={member.lastActiveAt} status={member.status} />
                      </p>
                    </div>
                    <DropdownMenu
                      label={`Actions for ${label}`}
                      align="end"
                      trigger={<MoreVertical className="h-5 w-5" aria-hidden="true" />}
                      items={rowActions(member)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Showing{" "}
              <span className="font-medium text-[var(--admin-on-surface)]">{rangeStart}</span>–
              <span className="font-medium text-[var(--admin-on-surface)]">{rangeEnd}</span> of{" "}
              <span className="font-medium text-[var(--admin-on-surface)]">{totalCount}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={pageIndex === 0 || loading}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!pageInfo.hasNextPage || loading}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {editRolesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
            onClick={() => {
              if (!bulkBusy) setEditRolesOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-roles-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
          >
            <div className="border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="edit-roles-title"
                className="text-lg font-bold text-[var(--admin-on-surface)]"
              >
                Assign role
              </h2>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Apply a role to {selectedCount} selected member(s).
              </p>
            </div>
            <div className="space-y-4 px-6 py-6">
              <label
                htmlFor="bulk-role"
                className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
              >
                Role
              </label>
              <select
                id="bulk-role"
                value={editRoleId}
                onChange={(event) => {
                  setEditRoleId(event.target.value);
                }}
                className={`${selectClassName} w-full`}
              >
                <option value="">Select a role…</option>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)]/20 px-6 py-4">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => {
                  setEditRolesOpen(false);
                }}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkBusy || editRoleId === ""}
                onClick={() => {
                  void runBulkAssignRole(
                    selectedMembers.map((member) => member.id),
                    editRoleId,
                  );
                }}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {bulkBusy ? "Assigning…" : "Assign role"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmAction != null}
        title={
          confirmAction?.scope === "bulk"
            ? confirmAction.type === "remove"
              ? `Remove ${String(confirmAction.memberIds.length)} member(s)?`
              : `Suspend ${String(confirmAction.memberIds.length)} member(s)?`
            : confirmAction?.type === "remove"
              ? "Remove member?"
              : "Suspend member?"
        }
        description={
          confirmAction?.type === "remove"
            ? "This action cannot be undone."
            : "The member will lose access until reactivated."
        }
        confirmLabel={confirmAction?.type === "remove" ? "Remove" : "Suspend"}
        destructive={confirmAction?.type === "remove"}
        busy={busyId != null || bulkBusy}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.scope === "bulk") {
            void runBulk(confirmAction.type, confirmAction.memberIds);
          } else if (confirmAction.type === "remove") {
            void removeMember(confirmAction.memberId);
          } else {
            void suspendMember(confirmAction.memberId);
          }
        }}
        onCancel={() => {
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
