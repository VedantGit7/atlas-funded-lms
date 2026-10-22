"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import {
  createCustomFieldReportGroup,
  exportCustomFieldReport,
  fetchCustomFieldDetail,
  sendCustomFieldReportMessage,
  type CustomFieldDetailData,
} from "./admin-custom-field-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  type CustomFieldDetailPageProps,
  PAGE_SIZE,
  downloadLearnersCsv,
  formatCountFor,
  formatDateShortFor,
  formatPctFor,
  formatRelativeDateFor,
} from "./admin-custom-field-detail-shared";

/** The state, data loading and handlers behind CustomFieldDetailReport. */
export function useCustomFieldDetail(props: CustomFieldDetailPageProps) {
  const { fieldKey, initialDetail } = props;
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatPct = withViewer(formatPctFor, viewer);
  const formatDateShort = withViewer(formatDateShortFor, viewer);
  const formatRelativeDate = withViewer(formatRelativeDateFor, viewer);
  const router = useRouter();
  const searchId = useId();

  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialDetail ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<CustomFieldDetailData | null>(initial?.data ?? null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [valueFilter, setValueFilter] = useState("");
  const [minValueInput, setMinValueInput] = useState("");
  const [maxValueInput, setMaxValueInput] = useState("");
  const [appliedMinValue, setAppliedMinValue] = useState<number | undefined>(undefined);
  const [appliedMaxValue, setAppliedMaxValue] = useState<number | undefined>(undefined);
  const [compareWith, setCompareWith] = useState("");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [groupTitle, setGroupTitle] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setCompareWith("");
    setValueFilter("");
    setSearchInput("");
    setDebouncedSearch("");
    setMinValueInput("");
    setMaxValueInput("");
    setAppliedMinValue(undefined);
    setAppliedMaxValue(undefined);
  }, [fieldKey]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, valueFilter, appliedMinValue, appliedMaxValue]);

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchCustomFieldDetail(fieldKey, {
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(valueFilter ? { valueFilter } : {}),
          ...(appliedMinValue != null ? { minValue: appliedMinValue } : {}),
          ...(appliedMaxValue != null ? { maxValue: appliedMaxValue } : {}),
          ...(compareWith ? { compareWith } : {}),
          page,
          limit: PAGE_SIZE,
        });
        setDetail(response.data);
      } catch (loadError) {
        setError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Couldn't load field detail.",
        );
        setDetail(null);
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [appliedMaxValue, appliedMinValue, compareWith, debouncedSearch, fieldKey, page, valueFilter],
  );

  useReportLoad(load, initial);

  const learners = detail?.learners.items ?? [];
  const pageInfo = detail?.learners.pageInfo;
  const field = detail?.field;
  const summary = detail?.summary;
  const fieldType = field?.fieldType.toLowerCase() ?? "";
  const selectedCompare =
    compareWith || detail?.crossTab?.otherField.key || detail?.compareFields[0]?.key || "";
  const selectOptionValues = useMemo(() => {
    if (!detail?.select) return field?.options ?? [];
    const fromOptions = detail.select.options.map((option) => option.value);
    const orphans = detail.select.orphaned.map((orphan) => orphan.value);
    return [...new Set([...fromOptions, ...orphans])];
  }, [detail?.select, field?.options]);

  const allOnPageSelected =
    learners.length > 0 && learners.every((row) => selectedIds.has(row.membershipId));

  const selectedLearners = useMemo(
    () => learners.filter((row) => selectedIds.has(row.membershipId)),
    [learners, selectedIds],
  );

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        for (const row of learners) next.delete(row.membershipId);
      } else {
        for (const row of learners) next.add(row.membershipId);
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

  function applyNumberRange() {
    const minRaw = minValueInput.trim();
    const maxRaw = maxValueInput.trim();
    const minParsed = minRaw === "" ? undefined : Number(minRaw);
    const maxParsed = maxRaw === "" ? undefined : Number(maxRaw);
    setAppliedMinValue(minParsed != null && !Number.isNaN(minParsed) ? minParsed : undefined);
    setAppliedMaxValue(maxParsed != null && !Number.isNaN(maxParsed) ? maxParsed : undefined);
    setPage(1);
  }

  async function handleServerExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportCustomFieldReport({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        columns: [
          "learner_name",
          "email",
          "enrollment_count",
          "total_spent_cents",
          "last_active_at",
          "signed_up_at",
          "status",
          `cf:${fieldKey}`,
        ],
        emailDownloadLink: true,
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

  function handleClientCsvExport(selectionOnly: boolean) {
    if (!field) return;
    const rows = selectionOnly ? selectedLearners : learners;
    downloadLearnersCsv(rows, field.key);
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    if (selectedIds.size === 0) {
      setError("Select learners first, then send a message.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCustomFieldReportMessage({
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        membershipIds: [...selectedIds],
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
    if (selectedIds.size === 0) {
      setError("Select learners first, then create a group.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createCustomFieldReportGroup({
        title: groupTitle.trim(),
        membershipIds: [...selectedIds],
      });
      setGroupTitle("");
      setActionsOpen(false);
      router.push("/admin/batches");
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
    viewer,
    formatCount,
    formatPct,
    formatDateShort,
    formatRelativeDate,
    searchId,
    loading,
    error,
    busy,
    detail,
    searchInput,
    setSearchInput,
    setDebouncedSearch,
    valueFilter,
    setValueFilter,
    minValueInput,
    setMinValueInput,
    maxValueInput,
    setMaxValueInput,
    setAppliedMinValue,
    setAppliedMaxValue,
    setCompareWith,
    setPage,
    selectedIds,
    setSelectedIds,
    actionsOpen,
    setActionsOpen,
    messageSubject,
    setMessageSubject,
    messageBody,
    setMessageBody,
    groupTitle,
    setGroupTitle,
    load,
    learners,
    pageInfo,
    field,
    summary,
    fieldType,
    selectedCompare,
    selectOptionValues,
    allOnPageSelected,
    selectedLearners,
    toggleSelectAllOnPage,
    toggleRowSelection,
    applyNumberRange,
    handleServerExport,
    handleClientCsvExport,
    handleSendMessage,
    handleCreateGroup,
  };
}

export type CustomFieldDetailView = ReturnType<typeof useCustomFieldDetail>;

/** The view once the page has checked that detail, field, summary loaded. */
export type CustomFieldDetailViewReady = CustomFieldDetailView & {
  detail: NonNullable<CustomFieldDetailView["detail"]>;
  field: NonNullable<CustomFieldDetailView["field"]>;
  summary: NonNullable<CustomFieldDetailView["summary"]>;
};
