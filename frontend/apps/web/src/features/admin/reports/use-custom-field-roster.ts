"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  CUSTOM_FIELD_ROSTER_DEFAULTS,
  CUSTOM_FIELD_BASE_COLUMN_OPTIONS,
  createCustomFieldReportGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportCustomFieldReport,
  fetchCustomFieldRoster,
  sendCustomFieldReportMessage,
  type CustomFieldDefinitionColumn,
  type CustomFieldRosterItem,
  type CustomFieldRosterSummary,
  fetchCustomFieldReportDefinitions,
} from "./admin-custom-field-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale } from "./viewer-time";
import {
  type CustomFieldRosterProps,
  type ExtraFilter,
  mergeInitialDefinitions,
  moneyToCents,
  seedCustomColumns,
} from "./admin-custom-field-roster-shared";

/** The state, data loading and handlers behind CustomFieldRoster. */
export function useCustomFieldRoster(props: CustomFieldRosterProps) {
  const { initialRoster, initialDefinitions } = props;
  const router = useRouter();
  const searchId = useId();
  const columnsPanelId = useId();
  const viewer = useViewerLocale();
  // Read once: later renders must not reset what the page has changed since.
  const [initialRosterData] = useState(() => initialRoster ?? null);
  const [initialDefinitionsData] = useState(() => initialDefinitions ?? null);

  const [loading, setLoading] = useState(initialRosterData === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<CustomFieldRosterItem[]>(initialRosterData?.data.items ?? []);
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinitionColumn[]>(() =>
    mergeInitialDefinitions(
      initialDefinitionsData?.data.items ?? [],
      initialRosterData?.data.fieldDefinitions ?? [],
    ),
  );

  // The full definition list. Without it the column picker can only offer
  // fields that happen to appear in the current page of roster rows.
  const loadDefinitions = useCallback(async () => {
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
    // No cancellation flag: the merge is idempotent and keyed by field key, so a
    // late resolve after unmount changes nothing.
  }, []);
  useReportLoad(loadDefinitions, initialDefinitionsData);

  const [summary, setSummary] = useState<CustomFieldRosterSummary | null>(
    initialRosterData?.data.summary ?? null,
  );
  const [page, setPage] = useState<number>(CUSTOM_FIELD_ROSTER_DEFAULTS.page);
  const [pageSize, setPageSize] = useState<number>(CUSTOM_FIELD_ROSTER_DEFAULTS.limit);
  const [totalPages, setTotalPages] = useState(initialRosterData?.data.pageInfo.totalPages ?? 0);
  const [totalCount, setTotalCount] = useState(initialRosterData?.data.pageInfo.totalCount ?? 0);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [signedUpFrom, setSignedUpFrom] = useState("");
  const [signedUpTo, setSignedUpTo] = useState("");
  const [sortBy, setSortBy] = useState<string>(CUSTOM_FIELD_ROSTER_DEFAULTS.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(CUSTOM_FIELD_ROSTER_DEFAULTS.sortDir);
  // Server-loaded definitions seed the custom columns in the first render, so
  // they are in the server HTML instead of appearing after hydration.
  const [columns, setColumns] = useState<string[]>(() =>
    fieldDefinitions.length > 0
      ? seedCustomColumns([...CUSTOM_FIELD_ROSTER_DEFAULTS.columns], fieldDefinitions)
      : [...CUSTOM_FIELD_ROSTER_DEFAULTS.columns],
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
  const seededCustomColumnsRef = useRef(fieldDefinitions.length > 0);

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

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
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
        if (!soft) setLoading(false);
      }
    },
    [debouncedSearch, filterPayload, page, pageSize, signedUpFrom, signedUpTo, sortBy, sortDir],
  );

  useReportLoad(load, initialRosterData);

  useEffect(() => {
    if (seededCustomColumnsRef.current || fieldDefinitions.length === 0) return;
    seededCustomColumnsRef.current = true;
    setColumns((current) => seedCustomColumns(current, fieldDefinitions));
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

  return {
    searchId,
    columnsPanelId,
    viewer,
    loading,
    busy,
    error,
    items,
    fieldDefinitions,
    summary,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalCount,
    searchInput,
    setSearchInput,
    debouncedSearch,
    setDebouncedSearch,
    status,
    setStatus,
    signedUpFrom,
    setSignedUpFrom,
    signedUpTo,
    setSignedUpTo,
    sortBy,
    sortDir,
    columns,
    setColumns,
    extraFilters,
    setExtraFilters,
    columnsOpen,
    setColumnsOpen,
    columnSearch,
    setColumnSearch,
    actionsOpen,
    setActionsOpen,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    groupTitle,
    setGroupTitle,
    selectedIds,
    setSelectedIds,
    selectedMembershipId,
    setSelectedMembershipId,
    rowMenuId,
    setRowMenuId,
    visibleCustomKeys,
    load,
    hasActiveFilters,
    showingFrom,
    showingTo,
    allOnPageSelected,
    filteredColumnDefs,
    clearFilters,
    toggleColumn,
    resetColumns,
    toggleSelectAllOnPage,
    toggleRowSelection,
    toggleSort,
    handleExport,
    handleSendMessage,
    handleCreateGroup,
  };
}

export type CustomFieldRosterView = ReturnType<typeof useCustomFieldRoster>;
