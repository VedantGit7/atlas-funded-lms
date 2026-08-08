"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import type { z } from "zod";
import {
  Button,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { localeResourceDtoSchema } from "@atlas/contracts/locales/locale.dto";
import {
  localesAlertErrorClassName,
  localesAlertSuccessClassName,
  localesEditorPanelClassName,
  localesLocaleListItemActiveClassName,
  localesLocaleListItemClassName,
  localesMonoKeyClassName,
  localesPanelHeaderClassName,
  localesPrimaryButtonClassName,
  localesSearchInputClassName,
  localesTableHeadClassName,
  localesTableRowClassName,
  localesTableShellClassName,
  localesTextareaClassName,
  fieldClassName,
} from "../locales-admin-shared";
import { formatRelativeTime, truncateText } from "../locales-admin-utils";
import { LocalePicker } from "./LocalePicker";

type LocaleResourceDto = z.infer<typeof localeResourceDtoSchema>;

type LocalesStringsTabProps = {
  resources: LocaleResourceDto[];
  onResourcesChange: (resources: LocaleResourceDto[]) => void;
  canManage: boolean;
  loading: boolean;
};

export function LocalesStringsTab({
  resources,
  onResourcesChange,
  canManage,
  loading,
}: LocalesStringsTabProps) {
  const locales = useMemo(
    () => [...new Set(resources.map((resource) => resource.locale))].sort(),
    [resources],
  );

  const [selectedLocale, setSelectedLocale] = useState(locales[0] ?? "en");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const localeResources = useMemo(
    () => resources.filter((resource) => resource.locale === selectedLocale),
    [resources, selectedLocale],
  );

  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return localeResources;
    return localeResources.filter(
      (resource) =>
        resource.key.toLowerCase().includes(query) ||
        resource.value.toLowerCase().includes(query),
    );
  }, [localeResources, searchQuery]);

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
    } else {
      setMessage("Unexpected error.");
      setRequestId(null);
    }
    setMessageTone("error");
  }

  async function refreshResources() {
    const response = await clientApi.get<{ data: LocaleResourceDto[] }>("/api/v1/locales");
    onResourcesChange(response.data);
  }

  function beginEdit(resource: LocaleResourceDto) {
    setDraftKey(resource.key);
    setDraftValue(resource.value);
    setEditingKey(resource.key);
  }

  function clearEditor() {
    setDraftKey("");
    setDraftValue("");
    setEditingKey(null);
  }

  async function deleteResource(key: string) {
    if (!canManage) return;
    setDeletingKey(key);
    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.delete(
        `/api/v1/locales/${selectedLocale}/${encodeURIComponent(key)}`,
        `locale-delete-${selectedLocale}-${key}`,
      );
      await refreshResources();
      if (expandedKey === key) setExpandedKey(null);
      if (editingKey === key) clearEditor();
      setMessage("String deleted.");
      setMessageTone("success");
    } catch (caught) {
      setError(caught);
    } finally {
      setDeletingKey(null);
    }
  }

  async function saveResource() {
    if (!canManage || !draftKey.trim() || !draftValue.trim()) return;
    setSaving(true);
    setMessage(null);
    setRequestId(null);

    try {
      await clientApi.put(
        `/api/v1/locales/${selectedLocale}`,
        {
          resources: [{ key: draftKey.trim(), value: draftValue.trim() }],
        },
        `locale-upsert-${selectedLocale}-${draftKey.trim()}`,
      );
      await refreshResources();
      setMessage("String saved.");
      setMessageTone("success");
      clearEditor();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  const localeListEntries = useMemo(() => {
    const fromData = locales.map((locale) => ({ locale, count: resources.filter((r) => r.locale === locale).length }));
    if (!fromData.some((entry) => entry.locale === selectedLocale) && selectedLocale) {
      return [...fromData, { locale: selectedLocale, count: 0 }].sort((a, b) => a.locale.localeCompare(b.locale));
    }
    return fromData;
  }, [locales, resources, selectedLocale]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="border-b border-[var(--admin-border)] p-4">
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Locales</h2>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {locales.length} locale{locales.length === 1 ? "" : "s"} with strings
          </p>
        </div>
        <div className="max-h-48 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
          {loading ? (
            <div className="space-y-2 p-2" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-10 w-full bg-[var(--admin-surface-high)]" />
              ))}
            </div>
          ) : localeListEntries.length === 0 ? (
            <p className="p-3 text-xs text-[var(--admin-on-surface-variant)]">No locales yet.</p>
          ) : (
            <ul className="space-y-1" role="listbox" aria-label="Locales">
              {localeListEntries.map((entry) => {
                const isActive = entry.locale === selectedLocale;
                return (
                  <li key={entry.locale}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`${localesLocaleListItemClassName} ${
                        isActive ? localesLocaleListItemActiveClassName : ""
                      }`}
                      onClick={() => {
                        setSelectedLocale(entry.locale);
                        clearEditor();
                        setExpandedKey(null);
                      }}
                    >
                      <span>{entry.locale}</span>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">{entry.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {canManage ? (
          <div className="border-t border-[var(--admin-border)] p-4">
            <LocalePicker
              value={selectedLocale}
              onChange={(locale) => {
                setSelectedLocale(locale);
                clearEditor();
                setExpandedKey(null);
              }}
              existingLocales={locales}
            />
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className={localesPanelHeaderClassName}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                Strings for {selectedLocale}
              </h2>
              {!canManage ? (
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]" role="status">
                  You have read-only access to locale resources.
                </p>
              ) : null}
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search keys or values…"
                className={localesSearchInputClassName}
              />
            </label>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          {message ? (
            <div
              role="alert"
              aria-live="polite"
              className={messageTone === "success" ? localesAlertSuccessClassName : localesAlertErrorClassName}
            >
              {message}
              {requestId ? ` (Request ID: ${requestId})` : ""}
            </div>
          ) : null}

          {loading ? (
            <div className={localesTableShellClassName} aria-hidden="true">
              <div className="space-y-2 p-4">
                {[0, 1, 2, 4].map((index) => (
                  <Skeleton key={index} className="h-10 w-full bg-[var(--admin-surface-high)]" />
                ))}
              </div>
            </div>
          ) : filteredResources.length === 0 ? (
            <EmptyState
              title="No strings for this locale yet"
              description={
                searchQuery.trim()
                  ? "No keys match your search. Try a different term."
                  : canManage
                    ? "Add a string using the editor below."
                    : "This locale has no translation overrides."
              }
              className="border-[var(--admin-border)] bg-[var(--admin-surface)] [&_h2]:text-[var(--admin-on-surface)] [&_p]:text-[var(--admin-on-surface-variant)]"
            />
          ) : (
            <div className={localesTableShellClassName}>
              <Table>
                <TableHead>
                  <TableRow className={`${localesTableRowClassName} hover:bg-transparent`}>
                    <TableHeaderCell className={`${localesTableHeadClassName} w-8`} />
                    <TableHeaderCell className={localesTableHeadClassName}>Key</TableHeaderCell>
                    <TableHeaderCell className={localesTableHeadClassName}>Value</TableHeaderCell>
                    <TableHeaderCell className={localesTableHeadClassName}>Last updated</TableHeaderCell>
                    <TableHeaderCell className={`${localesTableHeadClassName} text-right`}>Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredResources.map((resource) => {
                    const expanded = expandedKey === resource.key;
                    return (
                      <Fragment key={resource.key}>
                        <TableRow className={`${localesTableRowClassName} border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]`}>
                          <TableCell className="w-8">
                            <button
                              type="button"
                              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                              onClick={() => setExpandedKey(expanded ? null : resource.key)}
                              aria-expanded={expanded}
                              aria-label={expanded ? "Collapse row" : "Expand row"}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <code className={localesMonoKeyClassName}>{resource.key}</code>
                          </TableCell>
                          <TableCell className="max-w-md text-sm text-[var(--admin-on-surface)]">
                            {expanded ? resource.value : truncateText(resource.value)}
                          </TableCell>
                          <TableCell className="text-sm text-[var(--admin-on-surface-variant)]">
                            <time dateTime={resource.updatedAt}>
                              {formatRelativeTime(resource.updatedAt)}
                            </time>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canManage ? (
                                <button
                                  type="button"
                                  className="rounded p-1.5 text-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => beginEdit(resource)}
                                  aria-label={`Edit ${resource.key}`}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={!canManage || deletingKey === resource.key}
                                title={canManage ? `Delete ${resource.key}` : "Delete requires manage access"}
                                aria-label={`Delete ${resource.key}`}
                                className="rounded p-1.5 text-[var(--admin-danger)] hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-40"
                                onClick={() => void deleteResource(resource.key)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="bg-[var(--admin-surface-low)]">
                            <TableCell colSpan={5} className="text-sm text-[var(--admin-on-surface)]">
                              {resource.value}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {canManage ? (
            <section className={localesEditorPanelClassName} aria-label="String editor">
              <h3 className="mb-4 text-sm font-semibold text-[var(--admin-on-surface)]">
                {editingKey ? `Edit ${editingKey}` : "Add or update string"}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="locale-string-key"
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                  >
                    Key
                  </label>
                  <Input
                    id="locale-string-key"
                    value={draftKey}
                    onChange={(event) => setDraftKey(event.target.value)}
                    className={fieldClassName}
                    placeholder="welcome.title"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label
                    htmlFor="locale-string-value"
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                  >
                    Value (plain text)
                  </label>
                  <textarea
                    id="locale-string-value"
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    className={localesTextareaClassName}
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  className={localesPrimaryButtonClassName}
                  disabled={saving || !draftKey.trim() || !draftValue.trim()}
                  onClick={() => void saveResource()}
                >
                  {saving ? "Saving…" : editingKey ? "Save changes" : "Save string"}
                </Button>
                {draftKey || draftValue ? (
                  <Button variant="ghost" disabled={saving} onClick={clearEditor}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
