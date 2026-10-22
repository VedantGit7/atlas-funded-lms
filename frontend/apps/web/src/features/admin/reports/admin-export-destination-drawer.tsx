"use client";

import { useEffect, useId, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  HardDrive,
  Mail,
  Send,
  Webhook,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  createDestination,
  testDestination,
  updateDestination,
  type CreateDestinationBody,
  type DestinationItem,
  type DestinationKind,
} from "./admin-export-destinations-api";
import {
  type DrawerMode,
  fieldClassName,
  generateSigningSecret,
  ghostButtonClassName,
  isExternalEmail,
  kindLabel,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "./admin-export-destinations-shared";

export function DeleteDestinationModal({
  item,
  busy,
  onCancel,
  onConfirm,
}: {
  item: DestinationItem;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-destination-title"
    >
      <div className="admin-theme flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-start gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <h2
              id="delete-destination-title"
              className="text-base font-semibold text-[var(--admin-on-surface)]"
            >
              Delete destination &quot;{item.name}&quot;?
            </h2>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={onCancel}
            aria-label="Close"
            disabled={busy}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-5 px-6 py-5">
          {item.linkedSchedules.length > 0 ? (
            <div>
              <p className="mb-2 text-sm text-[var(--admin-on-surface-variant)]">
                Linked schedules ({item.linkedSchedules.length}):
              </p>
              <ul className="space-y-2">
                {item.linkedSchedules.map((schedule) => (
                  <li
                    key={schedule.id}
                    className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                  >
                    <Calendar
                      className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    {schedule.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex items-start gap-2 border-l-2 border-[var(--admin-warning)] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3 text-xs text-[var(--admin-on-surface-variant)]">
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            <p>
              Schedules using this destination will fall back to download-only delivery until you
              assign a new destination.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-[13px] font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DestinationDrawer({
  open,
  mode,
  editItem,
  tenantEmailDomains,
  busy,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: DrawerMode;
  editItem: DestinationItem | null;
  tenantEmailDomains: string[];
  busy: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const retryLabelId = useId();
  const providerLabelId = useId();
  const payloadLabelId = useId();

  const [kind, setKind] = useState<DestinationKind>("email");
  const [name, setName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [retryPolicy, setRetryPolicy] = useState<"none" | "3x" | "5x">("none");
  const [payloadFormat, setPayloadFormat] = useState<"multipart" | "json_signed_url">("multipart");
  const [storageProvider, setStorageProvider] = useState<"s3" | "gcs" | "azure">("s3");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [credentials, setCredentials] = useState("");
  const [retryOpen, setRetryOpen] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setTestResult(null);
    setTestBusy(false);
    setSaveBusy(false);
    setShowSecret(false);
    setEmailInput("");

    if (mode === "edit" && editItem) {
      setKind(editItem.kind);
      setName(editItem.name);
      setEmails(editItem.emails.map((e) => e.address));
      setWebhookUrl(editItem.webhookUrl ?? "");
      setSigningSecret("");
      setRetryPolicy(editItem.retryPolicy ?? "none");
      setPayloadFormat(editItem.payloadFormat ?? "multipart");
      setStorageProvider(editItem.storageProvider ?? "s3");
      setBucket(editItem.storageBucket ?? "");
      setPrefix(editItem.storagePrefix ?? "");
      setCredentials("");
    } else {
      setKind("email");
      setName("");
      setEmails([]);
      setWebhookUrl("");
      setSigningSecret("");
      setRetryPolicy("none");
      setPayloadFormat("multipart");
      setStorageProvider("s3");
      setBucket("");
      setPrefix("");
      setCredentials("");
    }
  }, [open, mode, editItem]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function addEmailFromInput(raw: string) {
    const parts = raw
      .split(/[,;\s]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    setEmails((current) => {
      const next = [...current];
      for (const part of parts) {
        if (!next.includes(part)) next.push(part);
      }
      return next;
    });
    setEmailInput("");
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }

    setSaveBusy(true);
    setFormError(null);
    try {
      if (mode === "create") {
        let body: CreateDestinationBody;
        if (kind === "email") {
          if (emails.length === 0) {
            setFormError("Add at least one email address.");
            setSaveBusy(false);
            return;
          }
          body = { kind: "email", name: trimmedName, emails };
        } else if (kind === "webhook") {
          if (!webhookUrl.trim()) {
            setFormError("Webhook URL is required.");
            setSaveBusy(false);
            return;
          }
          body = {
            kind: "webhook",
            name: trimmedName,
            url: webhookUrl.trim(),
            retryPolicy,
            payloadFormat,
            ...(signingSecret ? { signingSecret } : {}),
          };
        } else {
          if (!bucket.trim()) {
            setFormError("Bucket name is required.");
            setSaveBusy(false);
            return;
          }
          body = {
            kind: "storage",
            name: trimmedName,
            provider: storageProvider,
            bucket: bucket.trim(),
            ...(prefix.trim() ? { prefix: prefix.trim() } : {}),
            ...(credentials.trim() ? { credentials: credentials.trim() } : {}),
          };
        }
        await createDestination(body);
      } else if (editItem) {
        const patch: Parameters<typeof updateDestination>[1] = { name: trimmedName };
        if (kind === "email") {
          if (emails.length === 0) {
            setFormError("Add at least one email address.");
            setSaveBusy(false);
            return;
          }
          patch.emails = emails;
        } else if (kind === "webhook") {
          if (webhookUrl.trim()) patch.url = webhookUrl.trim();
          if (signingSecret.trim()) patch.signingSecret = signingSecret.trim();
          patch.retryPolicy = retryPolicy;
          patch.payloadFormat = payloadFormat;
        } else {
          patch.provider = storageProvider;
          if (bucket.trim()) patch.bucket = bucket.trim();
          patch.prefix = prefix.trim();
          if (credentials.trim()) patch.credentials = credentials.trim();
        }
        await updateDestination(editItem.id, patch);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to save destination.",
      );
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleTest() {
    if (!editItem) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const response = await testDestination(editItem.id);
      setTestResult({ ok: response.data.ok, message: response.data.message });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Test delivery failed.",
      });
    } finally {
      setTestBusy(false);
    }
  }

  const externalEmails = emails.filter((e) => isExternalEmail(e, tenantEmailDomains));
  const maskedSecretDisplay =
    mode === "edit" && editItem?.signingSecretMasked && !signingSecret
      ? editItem.signingSecretMasked
      : signingSecret
        ? signingSecret
        : "";
  const retryLabel =
    retryPolicy === "none" ? "None" : retryPolicy === "3x" ? "3 retries" : "5 retries";
  const providerLabel =
    storageProvider === "s3"
      ? "Amazon S3"
      : storageProvider === "gcs"
        ? "Google Cloud Storage"
        : "Azure Blob";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close destination drawer overlay"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="admin-theme relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.22s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-right"
        role="dialog"
        aria-modal="true"
        aria-labelledby="destination-drawer-title"
      >
        <header className="shrink-0 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="destination-drawer-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              {mode === "create" ? "New destination" : "Edit destination"}
            </h2>
            <button
              type="button"
              className={ghostButtonClassName}
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {mode === "create" ? (
            <div
              className="flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1"
              role="tablist"
              aria-label="Destination type"
            >
              {(
                [
                  ["email", "Email", Mail],
                  ["webhook", "Webhook", Webhook],
                  ["storage", "Storage bucket", HardDrive],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={kind === value}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors ${
                    kind === value
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                  }`}
                  onClick={() => {
                    setKind(value);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type:{" "}
              <span className="font-medium text-[var(--admin-on-surface)]">{kindLabel(kind)}</span>
            </p>
          )}

          <div className="space-y-1">
            <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
              Name
            </label>
            <input
              className={fieldClassName}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Finance team inbox"
            />
          </div>

          {kind === "email" ? (
            <div className="space-y-2">
              <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                Email addresses
              </label>
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1.5">
                {emails.map((email) => {
                  const external = isExternalEmail(email, tenantEmailDomains);
                  return (
                    <span
                      key={email}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                        external
                          ? "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
                      }`}
                    >
                      {email}
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-[var(--admin-surface)]"
                        aria-label={`Remove ${email}`}
                        onClick={() => {
                          setEmails((current) => current.filter((e) => e !== email));
                        }}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  );
                })}
                <input
                  className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
                  value={emailInput}
                  placeholder="Add email, Enter or comma"
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addEmailFromInput(emailInput);
                    }
                  }}
                  onBlur={() => {
                    if (emailInput.trim()) addEmailFromInput(emailInput);
                  }}
                />
              </div>
              {externalEmails.length > 0 ? (
                <div className="flex items-start gap-2 rounded border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-2 text-xs text-[var(--admin-warning)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <p>
                    {externalEmails.length} address{externalEmails.length === 1 ? "" : "es"} outside
                    your tenant domain
                    {tenantEmailDomains.length > 0 ? ` (${tenantEmailDomains.join(", ")})` : ""}.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {kind === "webhook" ? (
            <>
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  URL
                </label>
                <input
                  className={fieldClassName}
                  value={webhookUrl}
                  onChange={(e) => {
                    setWebhookUrl(e.target.value);
                  }}
                  placeholder="https://hooks.example.com/exports"
                />
                <p className="text-xs text-[var(--admin-on-surface-variant)]">Must use HTTPS.</p>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Signing secret
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className={`${fieldClassName} pr-9 font-mono text-xs`}
                      type={showSecret ? "text" : "password"}
                      value={
                        mode === "edit" && editItem?.signingSecretMasked && !signingSecret
                          ? editItem.signingSecretMasked
                          : signingSecret
                      }
                      onChange={(e) => {
                        setSigningSecret(e.target.value);
                      }}
                      placeholder={
                        mode === "edit" && editItem?.hasSigningSecret
                          ? "Leave blank to keep"
                          : "Optional"
                      }
                    />
                    {maskedSecretDisplay ? (
                      <button
                        type="button"
                        className="absolute top-2 right-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        aria-label={showSecret ? "Hide secret" : "Show masked secret"}
                        onClick={() => {
                          setShowSecret((v) => !v);
                        }}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      setSigningSecret(generateSigningSecret());
                    }}
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                      Retry policy
                    </span>
                  }
                  labelId={retryLabelId}
                  open={retryOpen}
                  onToggle={() => {
                    setRetryOpen((o) => !o);
                  }}
                  triggerContent={
                    <span className="flex w-full items-center gap-2 text-[13px]">
                      <span className="flex-1 text-left">{retryLabel}</span>
                    </span>
                  }
                  panelAriaLabel="Retry policy options"
                  portalZIndex={85}
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["none", "None"],
                        ["3x", "3 retries"],
                        ["5x", "5 retries"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={retryPolicy === value}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                        onClick={() => {
                          setRetryPolicy(value);
                          setRetryOpen(false);
                        }}
                      >
                        {retryPolicy === value ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
              <fieldset className="space-y-2">
                <legend
                  id={payloadLabelId}
                  className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase"
                >
                  Payload format
                </legend>
                {(
                  [
                    ["multipart", "Multipart file upload"],
                    ["json_signed_url", "JSON with signed URL"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                  >
                    <input
                      type="radio"
                      name="payloadFormat"
                      checked={payloadFormat === value}
                      onChange={() => {
                        setPayloadFormat(value);
                      }}
                      className="text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </>
          ) : null}

          {kind === "storage" ? (
            <>
              <div className="min-w-[140px]">
                <DropdownField
                  label={
                    <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                      Provider
                    </span>
                  }
                  labelId={providerLabelId}
                  open={providerOpen}
                  onToggle={() => {
                    setProviderOpen((o) => !o);
                  }}
                  triggerContent={
                    <span className="flex w-full items-center gap-2 text-[13px]">
                      <span className="flex-1 text-left">{providerLabel}</span>
                    </span>
                  }
                  panelAriaLabel="Storage provider options"
                  portalZIndex={85}
                >
                  <div className="p-1.5" role="listbox">
                    {(
                      [
                        ["s3", "Amazon S3"],
                        ["gcs", "Google Cloud Storage"],
                        ["azure", "Azure Blob"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={storageProvider === value}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                        onClick={() => {
                          setStorageProvider(value);
                          setProviderOpen(false);
                        }}
                      >
                        {storageProvider === value ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Bucket
                </label>
                <input
                  className={fieldClassName}
                  value={bucket}
                  onChange={(e) => {
                    setBucket(e.target.value);
                  }}
                  placeholder="my-exports-bucket"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Prefix
                </label>
                <input
                  className={`${fieldClassName} font-mono text-xs`}
                  value={prefix}
                  onChange={(e) => {
                    setPrefix(e.target.value);
                  }}
                  placeholder="exports/academy/"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Credentials
                </label>
                <textarea
                  className={`${textareaClassName} font-mono text-xs`}
                  value={
                    mode === "edit" && editItem?.credentialsMasked && !credentials
                      ? editItem.credentialsMasked
                      : credentials
                  }
                  onChange={(e) => {
                    setCredentials(e.target.value);
                  }}
                  placeholder={
                    mode === "edit" && editItem?.hasCredentials
                      ? "Leave blank to keep existing credentials"
                      : "Paste JSON or connection string"
                  }
                />
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Credentials are stored encrypted and shown masked after saving.
                </p>
              </div>
            </>
          ) : null}

          <div className="border-t border-[var(--admin-border)] pt-4">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={mode === "create" || testBusy || saveBusy || busy}
              title={mode === "create" ? "Create first" : undefined}
              onClick={() => {
                void handleTest();
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {testBusy ? "Sending..." : "Send a test delivery"}
            </button>
            <p className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]">
              Live probe: sends a test email, signed webhook ping, or storage write/delete.
            </p>
            {testResult ? (
              <p
                className={`mt-2 flex items-center gap-1.5 text-sm ${
                  testResult.ok ? "text-[var(--admin-success)]" : "text-[var(--admin-danger)]"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                {testResult.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {formError}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={onClose}
            disabled={saveBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={saveBusy || busy}
            onClick={() => {
              void handleSave();
            }}
          >
            {saveBusy ? "Saving..." : mode === "create" ? "Create destination" : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
