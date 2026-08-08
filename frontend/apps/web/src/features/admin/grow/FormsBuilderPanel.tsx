"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  GripVertical,
  Info,
  Link2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  MESSENGER_WIZARD_FIELD_CLASS,
  MESSENGER_WIZARD_LABEL_CLASS,
} from "./push-wizard-chrome";
import {
  FORM_FIELD_TYPE_OPTIONS,
  FORMS_LIST_HREF,
  formFieldTypeLabel,
  formStatusLabel,
  formSubmissionsHref,
  newField,
  type FormDto,
  type FormField,
  type FormFieldType,
} from "./forms-shared";

type ConfigTab = "field" | "appearance";

const LABEL_CLASS = `${MESSENGER_WIZARD_LABEL_CLASS} !mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]`;

function StatusPill({ status }: { status: FormDto["status"] }) {
  const tone =
    status === "LIVE" ? "success" : status === "UNPUBLISHED" ? "warning" : "neutral";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {formStatusLabel(status)}
    </span>
  );
}

function PublishSwitch({
  live,
  disabled,
  onToggle,
}: {
  live: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={live}
        aria-label={live ? "Unpublish form" : "Publish form"}
        disabled={disabled}
        onClick={onToggle}
        className={[
          "relative h-6 w-11 rounded-full transition-colors disabled:opacity-50",
          live ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-[var(--admin-on-primary)] transition-transform",
            live ? "left-[1.375rem]" : "left-0.5",
          ].join(" ")}
        />
      </button>
      <span className="text-[12px] font-bold text-[var(--admin-on-surface)]">Publish</span>
    </label>
  );
}

export function FormsBuilderPanel({ formId }: { formId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [googleSignup, setGoogleSignup] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<ConfigTab>("field");
  const [buttonText, setButtonText] = useState("Submit");
  const [buttonColor, setButtonColor] = useState("#5B5BD6");
  const [buttonTextColor, setButtonTextColor] = useState("#FFFFFF");
  const [thankYouHtml, setThankYouHtml] = useState("");
  const [redirectEnabled, setRedirectEnabled] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: FormDto }>(
        `/api/v1/marketing/forms/${formId}`,
        "form-get",
      );
      const data = response.data;
      setForm(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setGoogleSignup(data.googleSignupEnabled);
      setFields(data.fields);
      setSelectedFieldId((prev) => prev ?? data.fields[0]?.id ?? null);
      setButtonText(data.buttonText);
      setButtonColor(data.buttonColor);
      setButtonTextColor(data.buttonTextColor);
      setThankYouHtml(data.thankYouHtml ?? "");
      setRedirectEnabled(data.redirectEnabled);
      setRedirectUrl(data.redirectUrl ?? "");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load form.");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = form?.status === "LIVE";
  const orderedFields = useMemo(
    () => [...fields].sort((a, b) => a.sortOrder - b.sortOrder),
    [fields],
  );
  const selectedField = useMemo(
    () => orderedFields.find((field) => field.id === selectedFieldId) ?? null,
    [orderedFields, selectedFieldId],
  );

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }

  function moveField(id: string, direction: -1 | 1) {
    const sorted = [...orderedFields];
    const index = sorted.findIndex((field) => field.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return;
    const current = sorted[index];
    const swap = sorted[nextIndex];
    if (!current || !swap) return;
    if (current.isSystem || swap.isSystem) {
      toast.error("System fields stay fixed in order.");
      return;
    }
    const currentOrder = current.sortOrder;
    updateField(current.id, { sortOrder: swap.sortOrder });
    updateField(swap.id, { sortOrder: currentOrder });
  }

  function addField() {
    if (live) {
      toast.error("Unpublish before editing fields.");
      return;
    }
    const nextOrder = orderedFields.reduce((max, field) => Math.max(max, field.sortOrder), -1) + 1;
    const field = newField(nextOrder, "text");
    setFields((current) => [...current, field]);
    setSelectedFieldId(field.id);
    setConfigTab("field");
  }

  function removeField(id: string) {
    const target = fields.find((field) => field.id === id);
    if (!target || target.isSystem) {
      toast.error("System fields cannot be removed.");
      return;
    }
    setFields((current) => current.filter((field) => field.id !== id));
    setSelectedFieldId((prev) => (prev === id ? null : prev));
  }

  async function saveBasics() {
    if (!form) return;
    const response = await clientApi.patch<{ data: FormDto }>(
      `/api/v1/marketing/forms/${form.id}`,
      {
        title: title.trim(),
        description: description.trim() || null,
        googleSignupEnabled: googleSignup,
      },
      "form-basics",
    );
    setForm(response.data);
  }

  async function saveFields() {
    if (!form) return;
    const response = await clientApi.patch<{ data: FormDto }>(
      `/api/v1/marketing/forms/${form.id}/fields`,
      { fields },
      "form-fields",
    );
    setForm(response.data);
    setFields(response.data.fields);
  }

  async function saveAppearance() {
    if (!form) return;
    const response = await clientApi.patch<{ data: FormDto }>(
      `/api/v1/marketing/forms/${form.id}/appearance`,
      {
        buttonText: buttonText.trim() || "Submit",
        buttonColor,
        buttonTextColor,
        thankYouHtml: thankYouHtml.trim() || null,
        redirectEnabled,
        redirectUrl: redirectEnabled ? redirectUrl.trim() || null : null,
      },
      "form-appearance",
    );
    setForm(response.data);
  }

  async function saveProgress() {
    if (!form || live) {
      toast.error("Unpublish before saving edits.");
      return;
    }
    setBusy(true);
    try {
      await saveBasics();
      await saveFields();
      await saveAppearance();
      toast.success("Progress saved.");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!form) return;
    setBusy(true);
    const path = live ? "unpublish" : "publish";
    try {
      const response = await clientApi.post<{ data: FormDto }>(
        `/api/v1/marketing/forms/${form.id}/${path}`,
        {},
        `form-${path}`,
        { successMessage: live ? "Form unpublished." : "Form published." },
      );
      setForm(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!form) return;
    const url = `${window.location.origin}${form.sharePath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  async function onDelete() {
    if (!form) return;
    if (deleteConfirm.trim() !== form.title.trim()) {
      toast.error("Type the form title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/forms/${form.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "form-delete",
        { successMessage: "Form deleted." },
      );
      router.push(FORMS_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete.");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-12 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
        <div className="h-[28rem] animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (!form) {
    return (
      <Link
        href={FORMS_LIST_HREF}
        prefetch={false}
        className="inline-flex rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold"
      >
        Back to list
      </Link>
    );
  }

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:mx-0">
      <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={FORMS_LIST_HREF}
            prefetch={false}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary)]"
            aria-label="Back to forms"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={title}
                disabled={live || busy}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                className="min-w-0 flex-1 border-none bg-transparent p-0 text-lg font-semibold text-[var(--admin-on-surface)] outline-none focus:ring-0 disabled:opacity-70"
                aria-label="Form title"
              />
              <StatusPill status={form.status} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={formSubmissionsHref(form.id)}
            prefetch={false}
            className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
          >
            Submissions ({String(form.submissionCount)})
          </Link>
          <button
            type="button"
            disabled={form.status !== "LIVE" || busy}
            onClick={() => {
              void copyLink();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-1.5 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Generate link
          </button>
          <div className="hidden h-6 w-px bg-[var(--admin-border)] sm:block" aria-hidden="true" />
          <PublishSwitch
            live={live}
            disabled={busy}
            onToggle={() => {
              void togglePublish();
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDeleteOpen(true);
              setDeleteConfirm("");
            }}
            className="rounded-lg p-2 text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]"
            aria-label="Delete form"
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-[12px] italic text-[var(--admin-on-surface-variant)] sm:px-6">
        <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
        {live
          ? "Live forms lock structural edits. Unpublish to change fields or appearance."
          : "Draft mode - edits stay private until you publish."}
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 xl:w-72 xl:border-b-0 xl:border-r">
          <h2 className="mb-4 text-[12px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
            Form fields
          </h2>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {orderedFields.map((field) => {
              const selected = field.id === selectedFieldId;
              return (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => {
                    setSelectedFieldId(field.id);
                    setConfigTab("field");
                  }}
                  className={[
                    "group flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-all",
                    selected
                      ? "border-2 border-[var(--admin-primary)] bg-[var(--admin-primary-container)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-primary)]",
                  ].join(" ")}
                >
                  {field.isSystem ? (
                    <Lock className="h-4 w-4 shrink-0 text-[var(--admin-outline)]" aria-hidden="true" />
                  ) : (
                    <GripVertical
                      className="h-4 w-4 shrink-0 text-[var(--admin-outline)]"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={[
                        "truncate text-[12px] font-bold",
                        selected
                          ? "text-[var(--admin-on-primary-container)]"
                          : "text-[var(--admin-on-surface)]",
                      ].join(" ")}
                    >
                      {field.label}
                    </p>
                    <p
                      className={[
                        "text-[10px]",
                        field.isSystem
                          ? "font-bold uppercase text-[var(--admin-primary)]"
                          : "text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      {field.isSystem ? "System field" : formFieldTypeLabel(field.fieldType)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={live || busy}
            onClick={addField}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--admin-border)] py-3 text-[12px] font-bold text-[var(--admin-on-surface-variant)] transition-all hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add field
          </button>
        </aside>

        <section className="flex min-h-[22rem] flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)] p-4 sm:p-8">
          <div className="mx-auto w-full max-w-2xl rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg sm:p-10">
            <header className="mb-10 space-y-2">
              <h2 className="text-[28px] font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-[32px]">
                {title.trim() || "Untitled form"}
              </h2>
              {description.trim() ? (
                <p className="text-base text-[var(--admin-on-surface-variant)]">{description}</p>
              ) : null}
            </header>
            <div className="space-y-8">
              {orderedFields.map((field, index) => {
                const active = field.id === selectedFieldId;
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => {
                      setSelectedFieldId(field.id);
                      setConfigTab("field");
                    }}
                    className={[
                      "block w-full space-y-3 rounded-xl p-1 text-left transition-shadow",
                      active ? "ring-2 ring-[var(--admin-primary)]/30" : "",
                    ].join(" ")}
                  >
                    <p className="text-[17px] font-semibold text-[var(--admin-on-surface)]">
                      {String(index + 1)}. {field.label}{" "}
                      {field.required ? (
                        <span className="text-[var(--admin-primary)]">*</span>
                      ) : null}
                    </p>
                    {field.fieldType === "textarea" ? (
                      <div className="min-h-20 w-full border-b-2 border-[var(--admin-border)] py-3 text-lg text-[var(--admin-outline)]">
                        {field.placeholder || "Type your answer here..."}
                      </div>
                    ) : (
                      <div className="w-full border-b-2 border-[var(--admin-border)] py-3 text-lg text-[var(--admin-outline)]">
                        {field.placeholder ||
                          (field.fieldType === "email"
                            ? "email@company.com"
                            : "Type your answer here...")}
                      </div>
                    )}
                  </button>
                );
              })}
              {form.kind === "SIGNUP" && googleSignup ? (
                <div className="rounded-xl border border-dashed border-[var(--admin-border)] px-4 py-3 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  Continue with Google (shown on public signup form)
                </div>
              ) : null}
              <div className="pt-4">
                <span
                  className="inline-flex rounded-xl px-10 py-4 text-[15px] font-semibold shadow-md"
                  style={{ backgroundColor: buttonColor, color: buttonTextColor }}
                >
                  {buttonText.trim() || "Submit"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col border-t border-[var(--admin-border)] bg-[var(--admin-surface)] xl:w-80 xl:border-l xl:border-t-0">
          <div className="flex border-b border-[var(--admin-border)]">
            {(
              [
                { id: "field" as const, label: "Field config" },
                { id: "appearance" as const, label: "Appearance" },
              ] as const
            ).map((tab) => {
              const active = configTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setConfigTab(tab.id);
                  }}
                  className={[
                    "flex-1 py-4 text-[12px] font-bold transition-colors",
                    active
                      ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {configTab === "field" ? (
              selectedField ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                      Configuration
                    </h3>
                    <span className="rounded bg-[var(--admin-surface-low)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--admin-primary)]">
                      {formFieldTypeLabel(selectedField.fieldType)}
                    </span>
                  </div>
                  <div>
                    <label htmlFor="field-label" className={LABEL_CLASS}>
                      Field label
                    </label>
                    <input
                      id="field-label"
                      value={selectedField.label}
                      disabled={live || busy}
                      onChange={(event) => {
                        updateField(selectedField.id, { label: event.target.value });
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="field-placeholder" className={LABEL_CLASS}>
                      Placeholder (optional)
                    </label>
                    <input
                      id="field-placeholder"
                      value={selectedField.placeholder ?? ""}
                      disabled={live || busy}
                      onChange={(event) => {
                        updateField(selectedField.id, { placeholder: event.target.value });
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                    />
                  </div>
                  {!selectedField.isSystem ? (
                    <AdminSelectDropdown
                      id="field-type"
                      label="Field type"
                      ariaLabel="Field type"
                      value={selectedField.fieldType}
                      disabled={live || busy}
                      options={[...FORM_FIELD_TYPE_OPTIONS]}
                      onChange={(value) => {
                        updateField(selectedField.id, {
                          fieldType: value as FormFieldType,
                        });
                      }}
                    />
                  ) : null}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[12px] font-bold text-[var(--admin-on-surface)]">
                      Required field
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selectedField.required}
                      disabled={live || busy || selectedField.isSystem}
                      onClick={() => {
                        updateField(selectedField.id, {
                          required: !selectedField.required,
                        });
                      }}
                      className={[
                        "relative h-5 w-9 rounded-full transition-colors disabled:opacity-50",
                        selectedField.required
                          ? "bg-[var(--admin-primary)]"
                          : "bg-[var(--admin-outline)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-on-primary)] transition-transform",
                          selectedField.required ? "left-[1.125rem]" : "left-0.5",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                  {!selectedField.isSystem ? (
                    <div className="flex items-center gap-2 border-t border-[var(--admin-border)] pt-4">
                      <button
                        type="button"
                        disabled={live || busy}
                        onClick={() => {
                          moveField(selectedField.id, -1);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--admin-border)] py-2 text-xs font-bold disabled:opacity-50"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        Up
                      </button>
                      <button
                        type="button"
                        disabled={live || busy}
                        onClick={() => {
                          moveField(selectedField.id, 1);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--admin-border)] py-2 text-xs font-bold disabled:opacity-50"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        Down
                      </button>
                      <button
                        type="button"
                        disabled={live || busy}
                        onClick={() => {
                          removeField(selectedField.id);
                        }}
                        className="rounded-lg p-2 text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] disabled:opacity-50"
                        aria-label="Remove field"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Select a field to edit its settings.
                </p>
              )
            ) : (
              <>
                <div>
                  <label htmlFor="button-text" className={LABEL_CLASS}>
                    Button text
                  </label>
                  <input
                    id="button-text"
                    value={buttonText}
                    disabled={live || busy}
                    onChange={(event) => {
                      setButtonText(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="button-color" className={LABEL_CLASS}>
                      Button color
                    </label>
                    <input
                      id="button-color"
                      type="color"
                      value={buttonColor}
                      disabled={live || busy}
                      onChange={(event) => {
                        setButtonColor(event.target.value);
                      }}
                      className="h-11 w-full cursor-pointer rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="button-text-color" className={LABEL_CLASS}>
                      Text color
                    </label>
                    <input
                      id="button-text-color"
                      type="color"
                      value={buttonTextColor}
                      disabled={live || busy}
                      onChange={(event) => {
                        setButtonTextColor(event.target.value);
                      }}
                      className="h-11 w-full cursor-pointer rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1 disabled:opacity-50"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="thank-you" className={LABEL_CLASS}>
                    Thank-you message (HTML)
                  </label>
                  <textarea
                    id="thank-you"
                    value={thankYouHtml}
                    disabled={live || busy}
                    onChange={(event) => {
                      setThankYouHtml(event.target.value);
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24 font-mono text-xs`}
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-[12px] font-bold text-[var(--admin-on-surface)]">
                    Redirect after submit
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={redirectEnabled}
                    disabled={live || busy}
                    onClick={() => {
                      setRedirectEnabled((value) => !value);
                    }}
                    className={[
                      "relative h-5 w-9 rounded-full transition-colors disabled:opacity-50",
                      redirectEnabled
                        ? "bg-[var(--admin-primary)]"
                        : "bg-[var(--admin-outline)]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 h-4 w-4 rounded-full bg-[var(--admin-on-primary)] transition-transform",
                        redirectEnabled ? "left-[1.125rem]" : "left-0.5",
                      ].join(" ")}
                    />
                  </button>
                </div>
                {redirectEnabled ? (
                  <div>
                    <label htmlFor="redirect-url" className={LABEL_CLASS}>
                      Redirect URL
                    </label>
                    <input
                      id="redirect-url"
                      value={redirectUrl}
                      disabled={live || busy}
                      onChange={(event) => {
                        setRedirectUrl(event.target.value);
                      }}
                      placeholder="https://"
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                    />
                  </div>
                ) : null}
                {form.kind === "SIGNUP" ? (
                  <label className="flex items-start gap-3 text-sm text-[var(--admin-on-surface)]">
                    <input
                      type="checkbox"
                      checked={googleSignup}
                      disabled={live || busy}
                      onChange={(event) => {
                        setGoogleSignup(event.target.checked);
                      }}
                      className="mt-1"
                    />
                    Show Continue with Google on the public signup form
                  </label>
                ) : null}
                <div>
                  <label htmlFor="form-description" className={LABEL_CLASS}>
                    Description
                  </label>
                  <textarea
                    id="form-description"
                    value={description}
                    disabled={live || busy}
                    onChange={(event) => {
                      setDescription(event.target.value);
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-20`}
                  />
                </div>
              </>
            )}
          </div>

          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5">
            <button
              type="button"
              disabled={busy || live}
              onClick={() => {
                void saveProgress();
              }}
              className="w-full rounded-xl bg-[var(--admin-on-surface)] py-3 text-sm font-bold text-[var(--admin-surface)] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save progress"}
            </button>
          </div>
        </aside>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-builder-delete-title"
          >
            <h2
              id="form-builder-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete form
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{form.title}</span> to
              confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm form title"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setDeleteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || deleteConfirm.trim() !== form.title.trim()}
                onClick={() => {
                  void onDelete();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
