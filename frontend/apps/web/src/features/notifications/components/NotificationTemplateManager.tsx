"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Eye, Info, Mail, Plus, Search, Trash2 } from "lucide-react";
import type { z } from "zod";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { notificationTemplateDtoSchema } from "@atlas/contracts/notifications/notification.dto";
import { NOTIFICATION_SOURCE_EVENT_KEYS } from "@atlas/contracts/notifications/notification.events";
import { GamificationSelectField } from "../../gamification/components/GamificationSelectField";
import {
  buildVariableSampleMap,
  renderInlinePreviewHtml,
  renderPreviewParagraphs,
  renderTemplatePreviewText,
} from "../notification-template-preview-utils";
import {
  fieldClassName,
  ghostButtonClassName,
  iconButtonClassName,
  labelClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  templateBodyTextareaClassName,
  templateChannelLabel,
  templateChipClassName,
  templateEditorHeaderClassName,
  templateEditorPanelClassName,
  templateEditorPaneClassName,
  templateFooterClassName,
  templateInfoPanelClassName,
  templateListHeaderClassName,
  templateListItemClassName,
  templateListItemSelectedClassName,
  templateListPanelClassName,
  templateListScrollClassName,
  templateMonoKeyClassName,
  templatePreviewBodyClassName,
  templatePreviewCardClassName,
  templatePreviewHeaderClassName,
  templatePreviewPaneClassName,
  templateSearchFieldClassName,
  templateSplitPaneClassName,
  templateStatusBadgeClassName,
  templateStatusLabel,
  templateVariablesHeadClassName,
  templateVariablesTableClassName,
  templateWorkspaceClassName,
} from "../notification-templates-admin-shared";
import { SafeHtml } from "../../../components/SafeHtml";

type TemplateDto = z.infer<typeof notificationTemplateDtoSchema>;
type TemplateStatus = TemplateDto["status"];
type TemplateVariable = TemplateDto["variablesJson"]["variables"][number];

type NotificationTemplateManagerProps = {
  initialTemplates?: TemplateDto[];
  organizationLabel?: string;
};

const DEFAULT_BODY = "Your certificate was issued on {{issuedAt}}.";
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

const EVENT_KEY_OPTIONS = NOTIFICATION_SOURCE_EVENT_KEYS.map((key) => ({
  value: key,
  label: key,
}));

const CHANNEL_OPTIONS = [
  { value: "in_app", label: "In-app" },
  { value: "email", label: "Email" },
] as const;

function channelIcon(channel: "in_app" | "email") {
  return channel === "email" ? Mail : Bell;
}

function defaultVariablesForKey(
  key: (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number],
): TemplateVariable[] {
  if (key === "certificate.issued" || key === "certificate.revoked") {
    return [{ name: "issuedAt", description: "Issue date" }];
  }
  return [];
}

export function NotificationTemplateManager({
  initialTemplates,
  organizationLabel = "Your organization",
}: NotificationTemplateManagerProps) {
  const [templates, setTemplates] = useState<TemplateDto[]>(initialTemplates ?? []);
  const [loadingInitial, setLoadingInitial] = useState(initialTemplates === undefined);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates?.[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);

  const [draftKey, setDraftKey] =
    useState<(typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number]>("certificate.issued");
  const [draftChannel, setDraftChannel] = useState<"in_app" | "email">("in_app");
  const [draftLocale, setDraftLocale] = useState("en");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState(DEFAULT_BODY);
  const [draftStatus, setDraftStatus] = useState<TemplateStatus>("ACTIVE");
  const [draftVariables, setDraftVariables] = useState<TemplateVariable[]>(
    defaultVariablesForKey("certificate.issued"),
  );
  const [draftDefaultActionPath, setDraftDefaultActionPath] = useState("/certificates");
  const [variableSamples, setVariableSamples] = useState<Record<string, string>>({});

  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => {
      const haystack =
        `${template.key} ${template.channel} ${template.locale} ${templateStatusLabel(template.status)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, templates]);

  const sampleMap = useMemo(
    () => buildVariableSampleMap(draftVariables, variableSamples),
    [draftVariables, variableSamples],
  );

  const previewSubject = useMemo(() => {
    if (draftChannel !== "email" && !draftSubject.trim()) {
      return renderTemplatePreviewText(selected?.key ?? draftKey, sampleMap);
    }
    return renderTemplatePreviewText(draftSubject, sampleMap);
  }, [draftChannel, draftSubject, draftKey, sampleMap, selected?.key]);

  const previewBody = useMemo(
    () => renderTemplatePreviewText(draftBody, sampleMap),
    [draftBody, sampleMap],
  );

  const previewParagraphs = useMemo(() => renderPreviewParagraphs(previewBody), [previewBody]);

  const isDirty = useMemo(() => {
    if (creatingNew) {
      return (
        draftBody !== DEFAULT_BODY ||
        draftSubject.length > 0 ||
        draftLocale !== "en" ||
        draftChannel !== "in_app" ||
        draftKey !== "certificate.issued"
      );
    }
    if (!selected) return false;
    return (
      draftBody !== selected.body ||
      draftSubject !== (selected.subject ?? "") ||
      draftStatus !== selected.status ||
      JSON.stringify(draftVariables) !== JSON.stringify(selected.variablesJson.variables) ||
      draftDefaultActionPath !== (selected.variablesJson.defaultActionPath ?? "")
    );
  }, [
    creatingNew,
    draftBody,
    draftChannel,
    draftDefaultActionPath,
    draftKey,
    draftLocale,
    draftStatus,
    draftSubject,
    draftVariables,
    selected,
  ]);

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  function syncDraftFromTemplate(template: TemplateDto) {
    setDraftKey(template.key);
    setDraftChannel(template.channel);
    setDraftLocale(template.locale);
    setDraftSubject(template.subject ?? "");
    setDraftBody(template.body);
    setDraftStatus(template.status);
    setDraftVariables(template.variablesJson.variables);
    setDraftDefaultActionPath(template.variablesJson.defaultActionPath ?? "/certificates");
    setVariableSamples(buildVariableSampleMap(template.variablesJson.variables, {}));
  }

  function resetCreateDraft() {
    setCreatingNew(true);
    setSelectedId(null);
    setDraftKey("certificate.issued");
    setDraftChannel("in_app");
    setDraftLocale("en");
    setDraftSubject("");
    setDraftBody(DEFAULT_BODY);
    setDraftStatus("ACTIVE");
    const variables = defaultVariablesForKey("certificate.issued");
    setDraftVariables(variables);
    setDraftDefaultActionPath("/certificates");
    setVariableSamples(buildVariableSampleMap(variables, {}));
  }

  function selectTemplate(template: TemplateDto) {
    setCreatingNew(false);
    setSelectedId(template.id);
    syncDraftFromTemplate(template);
    setMessage(null);
    setRequestId(null);
  }

  function discardChanges() {
    if (creatingNew) {
      if (templates[0]) {
        selectTemplate(templates[0]);
        return;
      }
      resetCreateDraft();
      return;
    }
    if (selected) {
      syncDraftFromTemplate(selected);
    }
    setMessage(null);
    setRequestId(null);
  }

  async function refreshTemplates() {
    const response = await clientApi.get<{ data: TemplateDto[] }>("/api/v1/notification-templates");
    setTemplates(response.data);
    return response.data;
  }

  useEffect(() => {
    if (initialTemplates !== undefined) {
      if (initialTemplates[0] && !selectedId && !creatingNew) {
        syncDraftFromTemplate(initialTemplates[0]);
        setSelectedId(initialTemplates[0].id);
      }
      return;
    }

    let cancelled = false;

    async function loadInitial() {
      setLoadingInitial(true);
      setMessage(null);
      setRequestId(null);
      try {
        const data = await refreshTemplates();
        if (cancelled) return;
        if (data[0]) {
          selectTemplate(data[0]);
        } else {
          resetCreateDraft();
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught);
          resetCreateDraft();
        }
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [initialTemplates]);

  async function createTemplate() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      const response = await clientApi.post<{ data: TemplateDto }>(
        "/api/v1/notification-templates",
        {
          key: draftKey,
          channel: draftChannel,
          locale: draftLocale,
          subject: draftChannel === "email" ? draftSubject || "Notification" : undefined,
          body: draftBody,
          status: draftStatus,
          variablesJson: {
            variables: draftVariables,
            ...(draftDefaultActionPath ? { defaultActionPath: draftDefaultActionPath } : {}),
          },
        },
        "notification-template-create",
      );
      const data = await refreshTemplates();
      const created = data.find((item) => item.id === response.data.id) ?? response.data;
      selectTemplate(created);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        "/api/v1/notification-templates",
        {
          id: selected.id,
          body: draftBody,
          subject: selected.channel === "email" ? draftSubject : null,
          status: draftStatus,
          variablesJson: {
            variables: draftVariables,
            ...(draftDefaultActionPath ? { defaultActionPath: draftDefaultActionPath } : {}),
          },
        },
        "notification-template-update",
      );
      const data = await refreshTemplates();
      const updated = data.find((item) => item.id === selected.id);
      if (updated) {
        selectTemplate(updated);
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.delete("/api/v1/notification-templates", "notification-template-delete", {
        id: selected.id,
      });
      const data = await refreshTemplates();
      setConfirmDeleteOpen(false);
      if (data[0]) {
        selectTemplate(data[0]);
      } else {
        resetCreateDraft();
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  function addVariable() {
    const nextName = `variable_${String(draftVariables.length + 1)}`;
    const next = [...draftVariables, { name: nextName }];
    setDraftVariables(next);
    setVariableSamples((current) => ({
      ...current,
      [nextName]: buildVariableSampleMap([{ name: nextName }], current)[nextName] ?? nextName,
    }));
  }

  function removeVariable(name: string) {
    setDraftVariables((current) => current.filter((variable) => variable.name !== name));
    setVariableSamples((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== name)),
    );
  }

  const editorTitle = creatingNew ? "New template" : (selected?.key ?? "Select a template");
  const showSubjectField = creatingNew ? draftChannel === "email" : selected?.channel === "email";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold leading-8 tracking-[-0.02em] text-[var(--admin-primary)]">
            Notification Templates
          </h1>
          <p className="mt-1 text-sm leading-5 text-[var(--admin-on-surface-variant)]">
            Manage automated in-app and email communications per event, channel, and locale.
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className={`${outlineButtonClassName} inline-flex items-center gap-2 px-3 py-2 text-[13px]`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          Inbox
        </Link>
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
          placeholder="Search templates..."
          aria-label="Search templates"
          className={`${templateSearchFieldClassName} w-full`}
        />
      </div>

      {message ? (
        <div
          role="alert"
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {message}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </div>
      ) : null}

      <div className={templateWorkspaceClassName}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <section className={templateListPanelClassName} aria-label="Template list">
            <div className={templateListHeaderClassName}>
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--admin-on-surface)]">
                  Templates
                </h2>
                <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {templates.length} configured
                </p>
              </div>
              <button
                type="button"
                className={`${primaryButtonClassName} !px-2.5 !py-2`}
                aria-label="Create template"
                onClick={resetCreateDraft}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className={templateListScrollClassName}>
              {loadingInitial ? (
                <div className="space-y-2 p-4" aria-busy="true">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4"
                    >
                      <div className="mb-2 h-3 w-32 rounded bg-[var(--admin-surface-high)]" />
                      <div className="h-3 w-24 rounded bg-[var(--admin-surface-high)]" />
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  {searchQuery.trim()
                    ? "No templates match your search."
                    : "No templates yet. Create one to get started."}
                </div>
              ) : (
                <ul>
                  {filteredTemplates.map((template) => {
                    const Icon = channelIcon(template.channel);
                    const isSelected = !creatingNew && selectedId === template.id;
                    return (
                      <li key={template.id}>
                        <button
                          type="button"
                          className={[
                            templateListItemClassName,
                            "w-full text-left",
                            isSelected ? templateListItemSelectedClassName : "",
                          ].join(" ")}
                          onClick={() => {
                            selectTemplate(template);
                          }}
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <span
                              className={[
                                templateMonoKeyClassName,
                                isSelected ? "text-[var(--admin-primary)]" : "",
                              ].join(" ")}
                            >
                              {template.key}
                            </span>
                            <span className={templateStatusBadgeClassName(template.status)}>
                              {templateStatusLabel(template.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{templateChannelLabel(template.channel)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{template.locale}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className={templateEditorPanelClassName} aria-label="Template editor">
            <div className={templateEditorHeaderClassName}>
              <div className="min-w-0 space-y-2">
                <h3 className={`${templateMonoKeyClassName} text-base`}>{editorTitle}</h3>
                {!creatingNew && selected ? (
                  <div className="flex flex-wrap gap-2">
                    <span className={templateChipClassName}>
                      {(() => {
                        const Icon = channelIcon(selected.channel);
                        return <Icon className="h-4 w-4" aria-hidden="true" />;
                      })()}
                      {templateChannelLabel(selected.channel)}
                    </span>
                    <span className={templateChipClassName}>{selected.locale}</span>
                  </div>
                ) : null}
              </div>

              <div className="w-full sm:w-44">
                <GamificationSelectField
                  label="Status"
                  value={draftStatus}
                  onChange={(value) => {
                    setDraftStatus(value as TemplateStatus);
                  }}
                  options={STATUS_OPTIONS}
                  disabled={!creatingNew && !selected}
                />
              </div>
            </div>

            <div className={templateSplitPaneClassName}>
              <div className={templateEditorPaneClassName}>
                {creatingNew ? (
                  <div className="mb-5 grid gap-4 sm:grid-cols-2">
                    <GamificationSelectField
                      label="Event key"
                      value={draftKey}
                      onChange={(value) => {
                        const key = value as (typeof NOTIFICATION_SOURCE_EVENT_KEYS)[number];
                        setDraftKey(key);
                        const variables = defaultVariablesForKey(key);
                        setDraftVariables(variables);
                        setVariableSamples(buildVariableSampleMap(variables, {}));
                      }}
                      options={EVENT_KEY_OPTIONS}
                    />
                    <GamificationSelectField
                      label="Channel"
                      value={draftChannel}
                      onChange={(value) => {
                        setDraftChannel(value as "in_app" | "email");
                      }}
                      options={CHANNEL_OPTIONS}
                    />
                    <label className="grid gap-1 sm:col-span-2">
                      <span className={labelClassName}>Locale</span>
                      <input
                        className={fieldClassName}
                        value={draftLocale}
                        onChange={(event) => {
                          setDraftLocale(event.target.value);
                        }}
                      />
                    </label>
                  </div>
                ) : null}
                {showSubjectField ? (
                  <div className="mb-5 space-y-2">
                    <label className={labelClassName} htmlFor="template-subject">
                      Subject line
                    </label>
                    <input
                      id="template-subject"
                      className={fieldClassName}
                      value={draftSubject}
                      onChange={(event) => {
                        setDraftSubject(event.target.value);
                      }}
                      placeholder="Subject with {{variables}}"
                    />
                  </div>
                ) : null}

                <div className="mb-5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className={labelClassName} htmlFor="template-body">
                      Body template (plain text)
                    </label>
                    <button
                      type="button"
                      className={`${ghostButtonClassName} !px-0 text-[13px] text-[var(--admin-primary)]`}
                      onClick={addVariable}
                    >
                      Insert variable
                    </button>
                  </div>
                  <textarea
                    id="template-body"
                    className={templateBodyTextareaClassName}
                    value={draftBody}
                    onChange={(event) => {
                      setDraftBody(event.target.value);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClassName}>Variables and sample preview data</label>
                  <div className="overflow-x-auto">
                    <table className={templateVariablesTableClassName}>
                      <thead className={templateVariablesHeadClassName}>
                        <tr>
                          <th className="border-b border-[var(--admin-border)] px-3 py-2">
                            Variable
                          </th>
                          <th className="border-b border-[var(--admin-border)] px-3 py-2">
                            Sample value
                          </th>
                          <th className="border-b border-[var(--admin-border)] px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {draftVariables.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-4 text-sm text-[var(--admin-on-surface-variant)]"
                            >
                              No variables declared. Use Insert variable to add preview
                              placeholders.
                            </td>
                          </tr>
                        ) : (
                          draftVariables.map((variable) => (
                            <tr
                              key={variable.name}
                              className="hover:bg-[var(--admin-surface-low)] motion-safe:transition-colors"
                            >
                              <td className="border-b border-[var(--admin-border)] px-3 py-2 font-mono text-[12px]">
                                {variable.name}
                              </td>
                              <td className="border-b border-[var(--admin-border)] px-3 py-2">
                                <input
                                  className="w-full border-none bg-transparent p-0 text-sm text-[var(--admin-primary)] outline-none focus:ring-0"
                                  value={
                                    variableSamples[variable.name] ?? sampleMap[variable.name] ?? ""
                                  }
                                  onChange={(event) => {
                                    setVariableSamples((current) => ({
                                      ...current,
                                      [variable.name]: event.target.value,
                                    }));
                                  }}
                                />
                              </td>
                              <td className="border-b border-[var(--admin-border)] px-3 py-2 text-right">
                                <button
                                  type="button"
                                  className={iconButtonClassName}
                                  aria-label={`Remove ${variable.name}`}
                                  onClick={() => {
                                    removeVariable(variable.name);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className={templatePreviewPaneClassName}>
                <div className="mb-4 flex items-center gap-2">
                  <Eye
                    className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    Live preview
                  </h4>
                </div>

                <div className={templatePreviewCardClassName}>
                  <div className={templatePreviewHeaderClassName}>
                    {showSubjectField ? (
                      <div className="flex gap-3">
                        <span className="w-16 shrink-0 font-medium text-[var(--admin-on-surface-variant)]">
                          Subject
                        </span>
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          {previewSubject}
                        </span>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <span className="w-16 shrink-0 font-medium text-[var(--admin-on-surface-variant)]">
                          Event
                        </span>
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          {editorTitle}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={templatePreviewBodyClassName}>
                    {previewParagraphs.length === 0 ? (
                      <p className="text-[var(--admin-on-surface-variant)]">
                        Start typing to see a preview.
                      </p>
                    ) : (
                      previewParagraphs.map((paragraph, index) => (
                        <p key={`preview-paragraph-${String(index)}`}>
                          {/* renderInlinePreviewHtml already escapes &<> before adding
                              <strong>/<br>, so this is not exploitable today — but it
                              bypassed the single sanctioned render path from 2.3, which
                              is exactly how the next unescaped helper would slip in. */}
                          <SafeHtml
                            as="span"
                            variant="inline"
                            html={renderInlinePreviewHtml(paragraph)}
                          />
                        </p>
                      ))
                    )}
                    {draftDefaultActionPath ? (
                      <div className="pt-2">
                        <span
                          className={`${primaryButtonClassName} pointer-events-none inline-flex`}
                        >
                          View in app
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-center text-[11px] text-[var(--admin-on-surface-variant)]">
                    {new Date().getFullYear()} {organizationLabel}
                  </div>
                </div>

                <div className={templateInfoPanelClassName}>
                  <Info
                    className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Dynamic rendering
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[var(--admin-on-surface-variant)]">
                      This preview reflects your current variables and template content. Unmapped
                      variables stay as raw placeholders.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={templateFooterClassName}>
              <button
                type="button"
                className={`${outlineButtonClassName} border-[var(--admin-danger)] text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]`}
                disabled={!selected || busy}
                onClick={() => {
                  setConfirmDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete template
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={!isDirty || busy}
                  onClick={discardChanges}
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={busy || (!creatingNew && !selected) || (!creatingNew && !isDirty)}
                  onClick={() => {
                    if (creatingNew) {
                      void createTemplate();
                      return;
                    }
                    void saveSelected();
                  }}
                >
                  {busy ? "Saving..." : creatingNew ? "Create template" : "Save changes"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmDeleteOpen}
        title="Confirm deletion"
        description={
          <>
            Are you sure you want to delete the{" "}
            <span className="font-mono text-[var(--admin-danger)]">{selected?.key}</span> template?
            This action cannot be undone. Existing dispatches are preserved.
          </>
        }
        confirmLabel="Yes, delete template"
        busyLabel="Deleting..."
        tone="danger"
        icon={AlertTriangle}
        busy={busy}
        error={message}
        onConfirm={() => {
          void deleteSelected();
        }}
        onCancel={() => {
          if (!busy) {
            setConfirmDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
