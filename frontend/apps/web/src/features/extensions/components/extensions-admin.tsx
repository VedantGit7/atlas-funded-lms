"use client";

import { useMemo, useState } from "react";
import {
  AppWindow,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Filter,
  PauseCircle,
  Puzzle,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";
import {
  Button,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@atlas/design-system";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import {
  extensionsAlertSuccessClassName,
  extensionsContentClassName,
  extensionsGridClassName,
  extensionsHealthCardClassName,
  extensionsJsonEditorClassName,
  extensionsJsonEditorErrorClassName,
  extensionsJsonTextareaClassName,
  extensionsMainClassName,
  extensionsMonoKeyClassName,
  extensionsNavTabActiveClassName,
  extensionsNavTabClassName,
  extensionsPrimaryColumnClassName,
  extensionsRailButtonActiveClassName,
  extensionsRailButtonClassName,
  extensionsRailClassName,
  extensionsSearchInputClassName,
  extensionsSectionClassName,
  extensionsSectionHeaderClassName,
  extensionsSectionHeaderSoftClassName,
  extensionsSectionMutedClassName,
  extensionsSideColumnClassName,
  extensionsStatusToggleActiveClassName,
  extensionsStatusToggleGroupClassName,
  extensionsStatusToggleInactiveClassName,
  extensionsStickyPanelClassName,
  extensionsTableHeadClassName,
  extensionsTableRowClassName,
  extensionsTopBarClassName,
  extensionsWorkspaceClassName,
  fieldClassName,
  ghostButtonClassName,
  labelClassName,
  primaryButtonClassName,
} from "../extensions-admin-shared";
import {
  defaultRegistrationDraft,
  filterRegistrations,
  formatPointTypeLabel,
  formatRelativeTime,
  parseConfigJson,
  pointStatusBadgeClassName,
  registrationStatusBadgeClassName,
  registrationStatusLabel,
  type ExtensionsView,
} from "../extensions-admin-utils";
import {
  extensionsApi,
  formatExtensionsApiError,
  type ExtensionPointDto,
  type ExtensionRegistrationDto,
} from "../api";

type ExtensionsAdminProps = {
  extensionPoints: ExtensionPointDto[];
  registrations: ExtensionRegistrationDto[];
  canManage?: boolean;
};

type FormStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";

export function ExtensionsAdmin({
  extensionPoints,
  registrations: initialRegistrations,
  canManage = true,
}: ExtensionsAdminProps) {
  const [view, setView] = useState<ExtensionsView>("registrations");
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExtensionRegistrationDto | null>(null);

  const draftDefaults = useMemo(() => defaultRegistrationDraft(extensionPoints), [extensionPoints]);
  const [extensionPointKey, setExtensionPointKey] = useState(draftDefaults.extensionPointKey);
  const [registrationKey, setRegistrationKey] = useState(draftDefaults.registrationKey);
  const [configJson, setConfigJson] = useState(draftDefaults.configJson);
  const [status, setStatus] = useState<FormStatus>(draftDefaults.status);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const filteredRegistrations = useMemo(
    () => filterRegistrations(registrations, searchQuery),
    [registrations, searchQuery],
  );

  const pointOptions = useMemo(
    () => extensionPoints.map((point) => ({ value: point.key, label: point.key })),
    [extensionPoints],
  );

  const activeCount = registrations.filter((row) => row.status === "ACTIVE").length;
  const disabledCount = registrations.filter((row) => row.status === "DISABLED").length;

  async function refreshRegistrations() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await extensionsApi.listExtensionRegistrations();
      setRegistrations(response.data);
    } catch (caught) {
      setError(formatExtensionsApiError(caught));
    } finally {
      setRefreshing(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setExtensionPointKey(draftDefaults.extensionPointKey);
    setRegistrationKey(draftDefaults.registrationKey);
    setConfigJson(draftDefaults.configJson);
    setStatus(draftDefaults.status);
    setJsonError(null);
  }

  function startEdit(registration: ExtensionRegistrationDto) {
    setEditingId(registration.id);
    setExtensionPointKey(registration.extensionPointKey);
    setRegistrationKey(registration.registrationKey);
    setConfigJson(JSON.stringify(registration.configJson ?? {}, null, 2));
    setStatus(registration.status);
    setJsonError(null);
    setView("registrations");
    setSuccess(null);
    setError(null);
  }

  function validateJson(): Record<string, unknown> | null {
    const parsed = parseConfigJson(configJson);
    if (!parsed.ok) {
      setJsonError(parsed.message);
      return null;
    }
    setJsonError(null);
    return parsed.value;
  }

  function formatJsonField() {
    const parsed = parseConfigJson(configJson);
    if (!parsed.ok) {
      setJsonError(parsed.message);
      return;
    }
    setConfigJson(JSON.stringify(parsed.value, null, 2));
    setJsonError(null);
  }

  async function onCreateRegistration() {
    if (!canManage) return;
    const config = validateJson();
    if (!config) return;

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await extensionsApi.createExtensionRegistration({
        extensionPointKey,
        registrationKey,
        configJson: config,
        status: status === "ARCHIVED" ? "ACTIVE" : status,
      });
      await refreshRegistrations();
      resetForm();
      setSuccess("Registration created.");
    } catch (caught) {
      setError(formatExtensionsApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function onUpdateRegistration() {
    if (!canManage || !editingId) return;
    const config = validateJson();
    if (!config) return;

    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await extensionsApi.updateExtensionRegistration({
        id: editingId,
        configJson: config,
        status,
      });
      await refreshRegistrations();
      resetForm();
      setSuccess("Registration saved.");
    } catch (caught) {
      setError(formatExtensionsApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function onDeleteRegistration() {
    if (!deleteTarget) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await extensionsApi.deleteExtensionRegistration({ id: deleteTarget.id });
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      await refreshRegistrations();
      setSuccess("Registration deleted.");
    } catch (caught) {
      setError(formatExtensionsApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={extensionsWorkspaceClassName} aria-label="Extension manager">
      <nav className={extensionsRailClassName} aria-label="Extension sections">
        <button
          type="button"
          title="Registrations"
          aria-label="Registrations"
          aria-current={view === "registrations" ? "page" : undefined}
          className={`${extensionsRailButtonClassName} ${view === "registrations" ? extensionsRailButtonActiveClassName : ""}`}
          onClick={() => setView("registrations")}
        >
          <Puzzle className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Extension points catalogue"
          aria-label="Extension points catalogue"
          aria-current={view === "catalogue" ? "page" : undefined}
          className={`${extensionsRailButtonClassName} ${view === "catalogue" ? extensionsRailButtonActiveClassName : ""}`}
          onClick={() => setView("catalogue")}
        >
          <Terminal className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>

      <div className={extensionsMainClassName}>
        <header className={extensionsTopBarClassName}>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
              Extension Manager
            </h1>
            <nav className="flex items-center gap-4" aria-label="Extension views">
              <button
                type="button"
                className={`${extensionsNavTabClassName} ${view === "registrations" ? extensionsNavTabActiveClassName : ""}`}
                onClick={() => setView("registrations")}
              >
                Registrations
              </button>
              <button
                type="button"
                className={`${extensionsNavTabClassName} ${view === "catalogue" ? extensionsNavTabActiveClassName : ""}`}
                onClick={() => setView("catalogue")}
              >
                Definitions
              </button>
            </nav>
          </div>
          <div className="relative hidden min-w-[14rem] flex-1 sm:block sm:max-w-xs lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search registrations…"
              className={extensionsSearchInputClassName}
              aria-label="Search registrations"
            />
          </div>
        </header>

        <div className={extensionsContentClassName}>
          {error ? (
            <div role="alert" className={`${extensionsAlertErrorClassName} mb-4`}>
              {error}
            </div>
          ) : null}
          {success ? (
            <div role="status" className={`${extensionsAlertSuccessClassName} mb-4`}>
              {success}
            </div>
          ) : null}

          {view === "catalogue" ? (
            <ExtensionPointsSection extensionPoints={extensionPoints} searchQuery={searchQuery} />
          ) : (
            <div className={extensionsGridClassName}>
              <div className={extensionsPrimaryColumnClassName}>
                <ExtensionPointsSection
                  compact
                  extensionPoints={extensionPoints}
                  searchQuery={searchQuery}
                />
                <RegistrationsSection
                  registrations={filteredRegistrations}
                  canManage={canManage}
                  pending={pending}
                  refreshing={refreshing}
                  onRefresh={() => void refreshRegistrations()}
                  onEdit={startEdit}
                  onDelete={setDeleteTarget}
                  editingId={editingId}
                />
              </div>

              <div className={extensionsSideColumnClassName}>
                <div className={extensionsStickyPanelClassName}>
                  <RegistrationFormPanel
                    canManage={canManage}
                    pending={pending}
                    editingId={editingId}
                    extensionPointKey={extensionPointKey}
                    registrationKey={registrationKey}
                    configJson={configJson}
                    status={status}
                    jsonError={jsonError}
                    pointOptions={pointOptions}
                    onExtensionPointChange={setExtensionPointKey}
                    onRegistrationKeyChange={setRegistrationKey}
                    onConfigJsonChange={setConfigJson}
                    onStatusChange={setStatus}
                    onFormatJson={formatJsonField}
                    onSave={() => void (editingId ? onUpdateRegistration() : onCreateRegistration())}
                    onCancel={resetForm}
                  />

                  <aside className={extensionsHealthCardClassName} aria-label="Registration summary">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Registration summary
                    </h2>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--admin-on-surface-variant)]">Extension points</span>
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          {extensionPoints.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--admin-on-surface-variant)]">Active registrations</span>
                        <span className="rounded bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--admin-success)]">
                          {activeCount} active
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--admin-on-surface-variant)]">Disabled</span>
                        <span className="text-[var(--admin-on-surface)]">{disabledCount}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className="h-full bg-[var(--admin-success)] motion-safe:transition-all"
                          style={{
                            width:
                              registrations.length === 0
                                ? "0%"
                                : `${Math.round((activeCount / registrations.length) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm italic leading-relaxed text-[var(--admin-on-surface-variant)]">
                        {registrations.length === 0
                          ? "No registrations yet. Create one using the form."
                          : `${registrations.length} registration${registrations.length === 1 ? "" : "s"} configured for this tenant.`}
                      </p>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AdminConfirmDialog
        open={deleteTarget != null}
        title="Delete extension registration?"
        description={`Remove ${deleteTarget?.registrationKey ?? "this registration"} from ${deleteTarget?.extensionPointKey ?? "the extension point"}. This cannot be undone.`}
        confirmLabel="Delete forever"
        tone="danger"
        busy={pending}
        onConfirm={() => void onDeleteRegistration()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function ExtensionPointsSection({
  extensionPoints,
  searchQuery,
  compact = false,
}: {
  extensionPoints: ExtensionPointDto[];
  searchQuery: string;
  compact?: boolean;
}) {
  const filtered = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return extensionPoints;
    return extensionPoints.filter(
      (point) =>
        point.key.toLowerCase().includes(normalized) ||
        point.pointType.toLowerCase().includes(normalized),
    );
  }, [extensionPoints, searchQuery]);

  return (
    <section className={compact ? extensionsSectionMutedClassName : extensionsSectionClassName}>
      <div className={extensionsSectionHeaderClassName}>
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Extension Points</h2>
        </div>
        <span className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
          Read only
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow className={`${extensionsTableRowClassName} hover:bg-transparent`}>
              <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-2`}>Key</TableHeaderCell>
              <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-2`}>Point type</TableHeaderCell>
              <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-2`}>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No extension points match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((point) => (
                <TableRow key={point.id} className={extensionsTableRowClassName}>
                  <TableCell className="px-4 py-3">
                    <code className={extensionsMonoKeyClassName}>{point.key}</code>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="rounded bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-medium text-[var(--admin-primary)]">
                      {formatPointTypeLabel(point.pointType)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className={pointStatusBadgeClassName(point.status)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                      {point.status === "ACTIVE" ? "System" : point.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function RegistrationsSection({
  registrations,
  canManage,
  pending,
  refreshing,
  editingId,
  onRefresh,
  onEdit,
  onDelete,
}: {
  registrations: ExtensionRegistrationDto[];
  canManage: boolean;
  pending: boolean;
  refreshing: boolean;
  editingId: string | null;
  onRefresh: () => void;
  onEdit: (registration: ExtensionRegistrationDto) => void;
  onDelete: (registration: ExtensionRegistrationDto) => void;
}) {
  return (
    <section className={extensionsSectionClassName}>
      <div className={extensionsSectionHeaderSoftClassName}>
        <div className="flex items-center gap-2">
          <AppWindow className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Registrations</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            aria-label="Filter registrations"
            title="Use the search field above to filter"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
            aria-label="Refresh registrations"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {refreshing && registrations.length === 0 ? (
        <div className="space-y-2 p-4" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-10 w-full bg-[var(--admin-surface-high)]" />
          ))}
        </div>
      ) : registrations.length === 0 ? (
        <EmptyState
          title="No registrations found"
          description={
            canManage
              ? "Create a registration using the form on the right."
              : "This tenant has no extension registrations yet."
          }
          className="border-0 bg-transparent py-12 [&_h2]:text-[var(--admin-on-surface)] [&_p]:text-[var(--admin-on-surface-variant)]"
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className={`${extensionsTableRowClassName} hover:bg-transparent`}>
                <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-3`}>
                  Registration key
                </TableHeaderCell>
                <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-3`}>
                  Extension point
                </TableHeaderCell>
                <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-3`}>Status</TableHeaderCell>
                <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-3`}>Updated</TableHeaderCell>
                {canManage ? (
                  <TableHeaderCell className={`${extensionsTableHeadClassName} px-4 py-3 text-right`}>
                    Actions
                  </TableHeaderCell>
                ) : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {registrations.map((registration) => {
                const isEditing = editingId === registration.id;
                return (
                  <TableRow
                    key={registration.id}
                    className={`${extensionsTableRowClassName} group ${isEditing ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]" : ""}`}
                  >
                    <TableCell className="px-4 py-3">
                      <code className={extensionsMonoKeyClassName}>{registration.registrationKey}</code>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2 py-1 text-[11px] font-medium text-[var(--admin-primary)]">
                        {registration.extensionPointKey}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={registrationStatusBadgeClassName(registration.status)}>
                        {registration.status === "ACTIVE" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {registrationStatusLabel(registration.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                      <time dateTime={registration.updatedAt}>{formatRelativeTime(registration.updatedAt)}</time>
                    </TableCell>
                    {canManage ? (
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <button
                            type="button"
                            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
                            aria-label={`Edit ${registration.registrationKey}`}
                            disabled={pending}
                            onClick={() => onEdit(registration)}
                          >
                            <Edit3 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:text-[var(--admin-danger)]"
                            aria-label={`Delete ${registration.registrationKey}`}
                            disabled={pending}
                            onClick={() => onDelete(registration)}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function RegistrationFormPanel({
  canManage,
  pending,
  editingId,
  extensionPointKey,
  registrationKey,
  configJson,
  status,
  jsonError,
  pointOptions,
  onExtensionPointChange,
  onRegistrationKeyChange,
  onConfigJsonChange,
  onStatusChange,
  onFormatJson,
  onSave,
  onCancel,
}: {
  canManage: boolean;
  pending: boolean;
  editingId: string | null;
  extensionPointKey: string;
  registrationKey: string;
  configJson: string;
  status: FormStatus;
  jsonError: string | null;
  pointOptions: Array<{ value: string; label: string }>;
  onExtensionPointChange: (value: string) => void;
  onRegistrationKeyChange: (value: string) => void;
  onConfigJsonChange: (value: string) => void;
  onStatusChange: (value: FormStatus) => void;
  onFormatJson: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className={`${extensionsSectionClassName} p-4 sm:p-5`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
          {editingId ? "Edit registration" : "Create registration"}
        </h2>
        <ClipboardList className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
      </div>

      {!canManage ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">You have read-only access.</p>
      ) : null}

      <div className="space-y-5">
        <div className="space-y-1.5">
          <span className={labelClassName}>Extension point</span>
          <Select
            value={extensionPointKey}
            onValueChange={onExtensionPointChange}
            options={pointOptions}
            disabled={Boolean(editingId) || !canManage || pending}
            ariaLabel="Extension point"
            className="w-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="extension-registration-key" className={labelClassName}>
            Registration key
          </label>
          <Input
            id="extension-registration-key"
            value={registrationKey}
            onChange={(event) => onRegistrationKeyChange(event.target.value)}
            disabled={Boolean(editingId) || !canManage || pending}
            placeholder="e.g. swipe-renderer"
            className={`${fieldClassName} font-mono text-[13px]`}
          />
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            Unique identifier for this registration.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className={labelClassName}>Status</span>
          <div className={extensionsStatusToggleGroupClassName}>
            <button
              type="button"
              disabled={!canManage || pending}
              className={
                status === "ACTIVE"
                  ? extensionsStatusToggleActiveClassName
                  : extensionsStatusToggleInactiveClassName
              }
              onClick={() => onStatusChange("ACTIVE")}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Active
            </button>
            <button
              type="button"
              disabled={!canManage || pending}
              className={
                status === "DISABLED"
                  ? extensionsStatusToggleActiveClassName
                  : extensionsStatusToggleInactiveClassName
              }
              onClick={() => onStatusChange("DISABLED")}
            >
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
              Disabled
            </button>
          </div>
          {editingId ? (
            <button
              type="button"
              disabled={!canManage || pending}
              className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm font-medium motion-safe:transition-colors ${
                status === "ARCHIVED"
                  ? extensionsStatusToggleActiveClassName
                  : extensionsStatusToggleInactiveClassName
              }`}
              onClick={() => onStatusChange("ARCHIVED")}
            >
              Archive registration
            </button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="extension-config-json" className={labelClassName}>
              Configuration (JSON)
            </label>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
              disabled={!canManage || pending}
              onClick={onFormatJson}
            >
              Format JSON
            </button>
          </div>
          <div
            className={`${extensionsJsonEditorClassName} ${jsonError ? extensionsJsonEditorErrorClassName : ""}`}
          >
            <textarea
              id="extension-config-json"
              value={configJson}
              onChange={(event) => onConfigJsonChange(event.target.value)}
              disabled={!canManage || pending}
              spellCheck={false}
              className={extensionsJsonTextareaClassName}
              aria-invalid={Boolean(jsonError)}
            />
          </div>
          {jsonError ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {jsonError}
            </p>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="submit"
              className={primaryButtonClassName}
              disabled={pending}
            >
              {pending ? "Saving…" : editingId ? "Save registration" : "Save registration"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" className={ghostButtonClassName} disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
