"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PenTool, Plus, Sparkles, Trash2 } from "lucide-react";
import { ClientApiError, clientApi, createClientUuid } from "../../../lib/client-api";
import {
  CERTIFICATE_STUDIO_NEW,
  certificateStudioEditPath,
} from "../certificate-builder/studio-routes";
import { CertificateLivePreview } from "./CertificateLivePreview";
import { TemplateConfirmDialog } from "./TemplateConfirmDialog";
import {
  cardClassName,
  dangerOutlineButtonClassName,
  errorBannerClassName,
  fieldClassName,
  ghostButtonClassName,
  helperClassName,
  infoBannerClassName,
  labelClassName,
  monoFieldClassName,
  outlineButtonClassName,
  primaryButtonClassName,
  sectionDescClassName,
  sectionTitleClassName,
  StatusPill,
  TemplateRowSkeleton,
  type TemplateDto,
} from "./certificate-template-admin-shared";

function isStudioDesignTemplate(template: TemplateDto): boolean {
  const json = template.templateJson as { schemaVersion?: number };
  return json?.schemaVersion === 1;
}

function legacyFields(template: TemplateDto): {
  headline: string;
  subheadline: string;
  bodyLines: string[];
  accentColor?: string;
} {
  const json = template.templateJson as {
    headline?: string;
    subheadline?: string;
    bodyLines?: string[];
    accentColor?: string;
  };
  return {
    headline: json.headline ?? "",
    subheadline: json.subheadline ?? "",
    bodyLines: json.bodyLines ?? [],
    accentColor: json.accentColor,
  };
}

type CertificateTemplateManagerProps = {
  initialTemplates: TemplateDto[];
};

const DEFAULT_ACCENT = "#6366f1";
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_BODY_LINES = 12;

const DEFAULT_TEMPLATE_JSON = {
  headline: "Certificate of Achievement",
  subheadline: "Awarded for successful completion",
  bodyLines: ["This certifies outstanding performance."],
};

type BodyLine = { key: string; value: string };

function toBodyLines(values: string[]): BodyLine[] {
  return values.map((value) => ({ key: createClientUuid(), value }));
}

export function CertificateTemplateManager({ initialTemplates }: CertificateTemplateManagerProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [bodyLines, setBodyLines] = useState<BodyLine[]>([]);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId],
  );
  const editable = selected?.status === "DRAFT";

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    if (isStudioDesignTemplate(selected)) {
      setHeadline("");
      setSubheadline("");
      setBodyLines([]);
      setAccentColor(DEFAULT_ACCENT);
    } else {
      const fields = legacyFields(selected);
      setHeadline(fields.headline);
      setSubheadline(fields.subheadline);
      setBodyLines(toBodyLines(fields.bodyLines));
      setAccentColor(fields.accentColor ?? DEFAULT_ACCENT);
    }
    setMessage(null);
    setRequestId(null);
  }, [selected]);

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  async function refreshTemplates() {
    setRefreshing(true);
    try {
      const response = await clientApi.get<{ data: TemplateDto[] }>("/api/v1/certificate-templates");
      setTemplates(response.data);
    } finally {
      setRefreshing(false);
    }
  }

  async function createDraft() {
    setMessage(null);
    setRequestId(null);
    setCreating(true);
    try {
      const response = await clientApi.post<{ data: TemplateDto }>(
        "/api/v1/certificate-templates",
        { key: draftKey, name: draftName, templateJson: DEFAULT_TEMPLATE_JSON },
        "template-create",
      );
      await refreshTemplates();
      setSelectedId(response.data.id);
      setCreatingOpen(false);
      setDraftKey("");
      setDraftName("");
    } catch (caught) {
      setError(caught);
    } finally {
      setCreating(false);
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setMessage(null);
    setRequestId(null);
    setSaving(true);
    try {
      await clientApi.put(
        "/api/v1/certificate-templates",
        {
          id: selected.id,
          name,
          templateJson: {
            headline,
            ...(subheadline.trim() ? { subheadline } : {}),
            bodyLines: bodyLines.map((line) => line.value).filter((value) => value.trim().length > 0),
            ...(HEX_PATTERN.test(accentColor) ? { accentColor } : {}),
          },
        },
        "template-update",
      );
      await refreshTemplates();
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!selected) return;
    setMessage(null);
    setRequestId(null);
    setPublishing(true);
    try {
      await clientApi.post(`/api/v1/certificate-templates/${selected.id}/publish`, {}, "template-publish");
      await refreshTemplates();
      setConfirmPublishOpen(false);
    } catch (caught) {
      setError(caught);
    } finally {
      setPublishing(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    setMessage(null);
    setRequestId(null);
    setDeleting(true);
    try {
      await clientApi.delete("/api/v1/certificate-templates", "template-delete", { id: selected.id });
      await refreshTemplates();
      setSelectedId(null);
      setConfirmDeleteOpen(false);
    } catch (caught) {
      setError(caught);
    } finally {
      setDeleting(false);
    }
  }

  function addBodyLine() {
    if (bodyLines.length >= MAX_BODY_LINES) return;
    setBodyLines((current) => [...current, { key: createClientUuid(), value: "" }]);
  }

  function removeBodyLine(key: string) {
    setBodyLines((current) => current.filter((line) => line.key !== key));
  }

  function updateBodyLine(key: string, value: string) {
    setBodyLines((current) => current.map((line) => (line.key === key ? { ...line, value } : line)));
  }

  const canCreate = KEY_PATTERN.test(draftKey) && draftKey.length >= 2 && draftName.trim().length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Template list */}
      <aside className={`${cardClassName} flex h-fit flex-col`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-4">
          <h2 className={sectionTitleClassName}>Templates</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={CERTIFICATE_STUDIO_NEW}
              target="_blank"
              rel="noopener noreferrer"
              className={`${outlineButtonClassName} px-3 py-2 text-xs`}
            >
              <PenTool className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
              New design
            </Link>
            <button
              type="button"
              className={`${primaryButtonClassName} px-3 py-2 text-xs`}
              onClick={() => {
                setCreatingOpen((open) => !open);
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
              New draft
            </button>
          </div>
        </div>

        {creatingOpen ? (
          <div className="motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-top space-y-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4">
            <div className="space-y-1.5">
              <label htmlFor="draft-key" className={labelClassName}>
                Key
              </label>
              <input
                id="draft-key"
                className={monoFieldClassName}
                placeholder="completion-2026"
                value={draftKey}
                onChange={(event) => {
                  setDraftKey(event.target.value.toLowerCase());
                }}
              />
              <p className={helperClassName}>Lowercase letters, numbers, hyphens, underscores.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="draft-name" className={labelClassName}>
                Internal name
              </label>
              <input
                id="draft-name"
                className={fieldClassName}
                placeholder="Completion Certificate"
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value);
                }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${primaryButtonClassName} flex-1`}
                disabled={!canCreate || creating}
                onClick={() => void createDraft()}
              >
                {creating ? "Creating…" : "Create draft"}
              </button>
              <button
                type="button"
                className={outlineButtonClassName}
                onClick={() => {
                  setCreatingOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="max-h-[70vh] overflow-y-auto">
          {refreshing && templates.length === 0 ? (
            <>
              <TemplateRowSkeleton />
              <TemplateRowSkeleton />
            </>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Sparkles className="h-6 w-6 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">No templates yet</p>
              <p className={helperClassName}>Create a draft to design your first certificate.</p>
            </div>
          ) : (
            templates.map((template) => {
              const active = template.id === selectedId;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(template.id);
                  }}
                  className={[
                    "flex w-full items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4 text-left transition-colors",
                    active
                      ? "bg-[var(--admin-primary-container)]/40"
                      : "hover:bg-[var(--admin-surface-low)]",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {template.key}
                    </span>
                    <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {template.name}
                    </span>
                  </span>
                  <StatusPill status={template.status} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className={cardClassName}>
        {selected ? (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-5">
              <div>
                <h3 className={sectionTitleClassName}>Template editor</h3>
                <p className={sectionDescClassName}>
                  {isStudioDesignTemplate(selected)
                    ? "This template was created in Certificate Studio."
                    : "Configure the aesthetic and layout of the certificate."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={certificateStudioEditPath(selected.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={outlineButtonClassName}
                >
                  <PenTool className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                  Open in Builder
                </Link>
                <StatusPill status={selected.status} />
              </div>
            </div>

            {isStudioDesignTemplate(selected) ? (
              <div className="space-y-4 p-6">
                <p className={infoBannerClassName}>
                  Studio designs are edited in Certificate Builder. Use Open in Builder to continue
                  designing, or delete this template from here.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="studio-template-key" className={labelClassName}>
                      Template key
                    </label>
                    <input
                      id="studio-template-key"
                      className={monoFieldClassName}
                      value={selected.key}
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="studio-template-name" className={labelClassName}>
                      Internal name
                    </label>
                    <input
                      id="studio-template-name"
                      className={fieldClassName}
                      value={selected.name}
                      readOnly
                    />
                  </div>
                </div>
                {message ? (
                  <div className="space-y-1">
                    <p className={errorBannerClassName}>{message}</p>
                    {requestId ? <p className={helperClassName}>Request ID: {requestId}</p> : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-4">
                  <button
                    type="button"
                    className={dangerOutlineButtonClassName}
                    disabled={deleting}
                    onClick={() => {
                      setConfirmDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete template
                  </button>
                  <Link
                    href={certificateStudioEditPath(selected.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={primaryButtonClassName}
                  >
                    <PenTool className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                    Open in Builder
                  </Link>
                </div>
              </div>
            ) : (
              <>
            {!editable ? (
              <div className="mx-6 mt-5">
                <p className={infoBannerClassName}>
                  This template is {selected.status.toLowerCase()} and can no longer be edited. Create a
                  new draft to make changes.
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 p-6 lg:grid-cols-[3fr_2fr]">
              {/* Form */}
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="template-key" className={labelClassName}>
                      Template key
                    </label>
                    <input id="template-key" className={monoFieldClassName} value={selected.key} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="template-name" className={labelClassName}>
                      Internal name
                    </label>
                    <input
                      id="template-name"
                      className={fieldClassName}
                      value={name}
                      disabled={!editable}
                      onChange={(event) => {
                        setName(event.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="template-headline" className={labelClassName}>
                      Headline
                    </label>
                    <span className={helperClassName}>{headline.length}/160</span>
                  </div>
                  <input
                    id="template-headline"
                    className={fieldClassName}
                    value={headline}
                    disabled={!editable}
                    maxLength={160}
                    onChange={(event) => {
                      setHeadline(event.target.value);
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="template-subheadline" className={labelClassName}>
                      Subheadline (optional)
                    </label>
                    <span className={helperClassName}>{subheadline.length}/240</span>
                  </div>
                  <textarea
                    id="template-subheadline"
                    className={fieldClassName}
                    rows={2}
                    value={subheadline}
                    disabled={!editable}
                    maxLength={240}
                    onChange={(event) => {
                      setSubheadline(event.target.value);
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={labelClassName}>Body lines (max {MAX_BODY_LINES})</span>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={!editable || bodyLines.length >= MAX_BODY_LINES}
                      onClick={addBodyLine}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2.5} />
                      Add line
                    </button>
                  </div>
                  <div className="space-y-2">
                    {bodyLines.map((line, index) => (
                      <div key={line.key} className="group flex items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--admin-surface-high)] text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                          {index + 1}
                        </span>
                        <input
                          className={`${fieldClassName} flex-1`}
                          value={line.value}
                          disabled={!editable}
                          maxLength={500}
                          onChange={(event) => {
                            updateBodyLine(line.key, event.target.value);
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Remove line"
                          disabled={!editable}
                          className="shrink-0 rounded-md p-1.5 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:bg-[var(--admin-danger)]/10 hover:text-[var(--admin-danger)] disabled:opacity-0 group-hover:opacity-100"
                          onClick={() => {
                            removeBodyLine(line.key);
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${cardClassName} p-5`}>
                  <label className={`${labelClassName} mb-3 block`}>Accent styling</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      aria-label="Accent color"
                      value={HEX_PATTERN.test(accentColor) ? accentColor : DEFAULT_ACCENT}
                      disabled={!editable}
                      className="h-11 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--admin-border)] bg-transparent p-0 disabled:cursor-not-allowed"
                      onChange={(event) => {
                        setAccentColor(event.target.value);
                      }}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={helperClassName}>Hex code</span>
                        <input
                          className={`${monoFieldClassName} w-28 py-1.5`}
                          value={accentColor}
                          disabled={!editable}
                          onChange={(event) => {
                            setAccentColor(event.target.value);
                          }}
                        />
                      </div>
                      <p className={helperClassName}>Applies to the certificate&apos;s ornamental border.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="lg:sticky lg:top-6 lg:self-start">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">Live preview</h4>
                  <CertificateLivePreview
                    headline={headline}
                    subheadline={subheadline}
                    bodyLines={bodyLines.map((line) => line.value).filter((value) => value.trim().length > 0)}
                    accentColor={HEX_PATTERN.test(accentColor) ? accentColor : DEFAULT_ACCENT}
                  />
                  <p className="text-xs italic leading-relaxed text-[var(--admin-on-surface-variant)]">
                    Dynamic recipient fields (name, course, date) are not yet supported by this template
                    system.
                  </p>
                </div>
              </div>
            </div>

            {message ? (
              <div className="mx-6 mb-4 space-y-1">
                <p className={errorBannerClassName}>{message}</p>
                {requestId ? <p className={helperClassName}>Request ID: {requestId}</p> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-6 py-4">
              <button
                type="button"
                className={dangerOutlineButtonClassName}
                disabled={deleting}
                onClick={() => {
                  setConfirmDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete template
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={outlineButtonClassName}
                  disabled={!editable || saving}
                  onClick={() => void saveSelected()}
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={!editable || publishing}
                  onClick={() => {
                    setConfirmPublishOpen(true);
                  }}
                >
                  Publish changes
                </button>
              </div>
            </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <Sparkles className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">No template selected</h3>
            <p className={`${helperClassName} max-w-sm`}>
              Select an existing template from the list to edit its properties, or create a new draft.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={CERTIFICATE_STUDIO_NEW}
                target="_blank"
                rel="noopener noreferrer"
                className={outlineButtonClassName}
              >
                <PenTool className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
                New design
              </Link>
              <button
                type="button"
                className={primaryButtonClassName}
                onClick={() => {
                  setCreatingOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
                New template
              </button>
            </div>
          </div>
        )}
      </section>

      <TemplateConfirmDialog
        open={confirmPublishOpen}
        title="Publish this template?"
        description="Publishing routes the template through the workflow gate. Depending on your workflow configuration, it may require review before it becomes available for issuing certificates."
        confirmLabel="Confirm publish"
        busy={publishing}
        onConfirm={() => void publishSelected()}
        onClose={() => {
          setConfirmPublishOpen(false);
        }}
      />

      <TemplateConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this template?"
        description="This permanently removes the draft template. Certificates already issued from it are not affected."
        confirmLabel="Confirm delete"
        tone="danger"
        busy={deleting}
        onConfirm={() => void deleteSelected()}
        onClose={() => {
          setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
}
