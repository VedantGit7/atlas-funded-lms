"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilterX,
  HardDrive,
  Inbox,
  Mail,
  MoreVertical,
  Plus,
  Search,
  Send,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  createDestination,
  deleteDestination,
  exportDestinationsList,
  fetchDestinationsRoster,
  testDestination,
  updateDestination,
  type CreateDestinationBody,
  type DestinationItem,
  type DestinationKind,
  type DestinationSort,
  type DestinationStatusFilter,
  type DestinationsRosterSummary,
  type HealthDayStatus,
} from "./admin-export-destinations-api";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const ghostButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const textareaClassName =
  "min-h-[88px] w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const EMPTY_SUMMARY: DestinationsRosterSummary = {
  totalCount: 0,
  emailCount: 0,
  webhookCount: 0,
  storageCount: 0,
  deliveriesThisMonth: 0,
  deliveriesSucceededThisMonth: 0,
  failingCount: 0,
  failingCaption: null,
  externalRecipientCount: 0,
  lastDeliveryAt: null,
  tenantEmailDomains: [],
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatRelative(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    const ahead = Math.abs(diffMs);
    if (ahead < 60_000) return "in under a minute";
    const mins = Math.floor(ahead / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `in ${hours}h`;
    return `in ${Math.floor(hours / 24)}d`;
  }
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isExternalEmail(email: string, tenantDomains: string[]): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true;
  return !tenantDomains.some((d) => d.toLowerCase() === domain);
}

function generateSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function KindIcon({ kind }: { kind: DestinationKind }) {
  if (kind === "email") return <Mail className="h-3 w-3" aria-hidden="true" />;
  if (kind === "webhook") return <Webhook className="h-3 w-3" aria-hidden="true" />;
  return <HardDrive className="h-3 w-3" aria-hidden="true" />;
}

function kindLabel(kind: DestinationKind): string {
  if (kind === "email") return "Email";
  if (kind === "webhook") return "Webhook";
  return "Storage";
}

function healthBarClass(status: HealthDayStatus): string {
  if (status === "success") return "bg-[var(--admin-success)]";
  if (status === "fail") return "bg-[var(--admin-danger)]";
  return "bg-[var(--admin-surface-variant)]";
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--admin-surface-low)] ${className ?? "h-4 w-24"}`}
    />
  );
}

function DestinationsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading destinations">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
          <SkeletonBar className="mb-3 h-3 w-24" />
          <SkeletonBar className="mb-2 h-8 w-16" />
          <SkeletonBar className="h-3 w-40" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"
          >
            <SkeletonBar className="mb-3 h-3 w-24" />
            <SkeletonBar className="mb-2 h-8 w-16" />
            <SkeletonBar className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <SkeletonBar className="h-full w-1 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBar className="h-4 w-48" />
              <SkeletonBar className="h-3 w-64" />
              <SkeletonBar className="h-3 w-32" />
            </div>
            <SkeletonBar className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DeleteDestinationModal({
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

type DrawerMode = "create" | "edit";

function DestinationDrawer({
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

function DestinationBlock({
  item,
  menuOpen,
  onToggleMenu,
  onEdit,
  onTest,
  onToggleActive,
  onDelete,
  onCopyWebhook,
}: {
  item: DestinationItem;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onTest: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onCopyWebhook: () => void;
}) {
  const [secretVisible, setSecretVisible] = useState(false);

  const railClass = item.isFailing
    ? "bg-[var(--admin-danger)]"
    : !item.isActive
      ? "bg-[var(--admin-surface-variant)]"
      : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,transparent)]";

  const statusTone = item.isFailing
    ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]"
    : !item.isActive
      ? "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]"
      : "border-[color-mix(in_srgb,var(--admin-success)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";

  const statusLabel = item.isFailing ? "Failing" : !item.isActive ? "Disabled" : "Enabled";

  return (
    <article
      className={`relative flex overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${
        !item.isActive ? "opacity-75" : ""
      }`}
    >
      <div className={`w-1 shrink-0 ${railClass}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">{item.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs">
              <KindIcon kind={item.kind} />
              {kindLabel(item.kind)}
            </span>
          </div>

          {item.kind === "email" ? (
            <div className="flex flex-wrap gap-1.5">
              {item.emails.map((target) => (
                <span
                  key={target.address}
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                    target.isExternal
                      ? "border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
                  }`}
                >
                  {target.address}
                </span>
              ))}
            </div>
          ) : null}

          {item.kind === "webhook" ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                <span className="font-mono text-[var(--admin-on-surface)]">
                  {item.webhookHost}
                  {item.webhookPathTruncated ? item.webhookPathTruncated : ""}
                </span>
                {item.webhookUrl ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--admin-surface-low)]"
                    onClick={onCopyWebhook}
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy URL
                  </button>
                ) : null}
              </div>
              {item.hasSigningSecret && item.signingSecretMasked ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {secretVisible ? item.signingSecretMasked : "••••••••••••"}
                  </span>
                  <button
                    type="button"
                    className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    aria-label={
                      secretVisible ? "Hide signing secret" : "Show masked signing secret"
                    }
                    onClick={() => {
                      setSecretVisible((v) => !v);
                    }}
                  >
                    {secretVisible ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {item.kind === "storage" ? (
            <p className="font-mono text-xs text-[var(--admin-on-surface)]">
              {item.storageProvider}/{item.storageBucket}
              {item.storagePrefix ? `/${item.storagePrefix}` : ""}
            </p>
          ) : null}

          {item.isFailing && item.lastError ? (
            <p className="text-xs text-[var(--admin-danger)]">{item.lastError}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:min-w-[180px]">
          <span
            className={`inline-flex rounded border px-1.5 py-px font-mono text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}
          >
            {statusLabel}
          </span>
          <div className="flex items-end gap-0.5" role="img" aria-label="30-day delivery health">
            {item.health30d.map((day, index) => (
              <span
                key={`${item.id}-health-${index}`}
                className={`h-4 w-1 rounded-sm ${healthBarClass(day)}`}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Last delivered {formatRelative(item.lastDeliveryAt)}
          </p>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            {formatCount(item.scheduleCount)} schedule{item.scheduleCount === 1 ? "" : "s"}
          </p>
          <div className="relative">
            <button
              type="button"
              className={ghostButtonClassName}
              aria-label={`Actions for ${item.name}`}
              onClick={onToggleMenu}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
                role="menu"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onEdit}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onTest}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Send a test
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onToggleActive}
                >
                  {item.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-low)]"
                  role="menuitem"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function AdminExportDestinationsPage() {
  const kindLabelId = useId();
  const statusLabelId = useId();
  const sortLabelId = useId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DestinationItem[]>([]);
  const [summary, setSummary] = useState<DestinationsRosterSummary>(EMPTY_SUMMARY);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState<DestinationKind | "any">("any");
  const [status, setStatus] = useState<DestinationStatusFilter>("all");
  const [sort, setSort] = useState<DestinationSort>("name_asc");

  const [kindOpen, setKindOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [editItem, setEditItem] = useState<DestinationItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DestinationItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDestinationsRoster({
        q: debouncedQ || undefined,
        kind,
        status,
        sort,
        page,
        limit: 50,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load destinations.",
      );
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, kind, status, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, kind, status, sort]);

  const hasFilters = Boolean(debouncedQ) || kind !== "any" || status !== "all";

  function clearFilters() {
    setQ("");
    setKind("any");
    setStatus("all");
    setSort("name_asc");
  }

  async function handleExportList() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportDestinationsList();
      downloadCsv(response.data.content, response.data.filename);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to export list.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: DestinationItem) {
    setBusy(true);
    setError(null);
    setMenuOpenId(null);
    try {
      await updateDestination(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to update destination.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(item: DestinationItem) {
    setBusy(true);
    setError(null);
    setMenuOpenId(null);
    try {
      await testDestination(item.id);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Test delivery failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDestination(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to delete destination.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditItem(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(item: DestinationItem) {
    setDrawerMode("edit");
    setEditItem(item);
    setDrawerOpen(true);
    setMenuOpenId(null);
  }

  async function copyWebhookUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setError("Unable to copy URL to clipboard.");
    }
  }

  const moduleTabs: Array<{ key: string; label: string; href?: string; active?: boolean }> = [
    { key: "history", label: "History", href: "/admin/reports/exports" },
    { key: "new", label: "New export", href: "/admin/reports/exports/new" },
    { key: "schedules", label: "Schedules", href: "/admin/reports/exports/schedules" },
    {
      key: "destinations",
      label: "Destinations",
      href: "/admin/reports/exports/destinations",
      active: true,
    },
    { key: "settings", label: "Settings", href: "/admin/reports/exports/settings" },
  ];

  const kindFilterLabel =
    kind === "any"
      ? "Any kind"
      : kind === "email"
        ? "Email"
        : kind === "webhook"
          ? "Webhook"
          : "Storage";
  const statusFilterLabel =
    status === "all"
      ? "All statuses"
      : status === "enabled"
        ? "Enabled"
        : status === "disabled"
          ? "Disabled"
          : "Failing";
  const sortFilterLabel =
    sort === "name_asc"
      ? "Name (A-Z)"
      : sort === "updated_desc"
        ? "Recently updated"
        : sort === "last_delivery_desc"
          ? "Last delivery (latest)"
          : "Failures (most)";

  const showEmptyTrue =
    !loading && !error && items.length === 0 && !hasFilters && summary.totalCount === 0;
  const showEmptyFiltered = !loading && !error && items.length === 0 && hasFilters;

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * 50 + 1;
  const showingTo = Math.min(page * 50, totalCount);

  return (
    <div className="relative flex flex-col gap-6 pb-28">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
            Admin / Reports / Exports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Destinations
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Where scheduled and delivered exports are sent.
          </p>
          <nav
            className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
            aria-label="Exports module"
          >
            {moduleTabs.map((tab) => {
              const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
                tab.active
                  ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
              }`;
              if (tab.href) {
                return (
                  <Link key={tab.key} href={tab.href} className={className}>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled
                  title="Coming soon"
                  className={`${className} cursor-not-allowed opacity-50`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              void handleExportList();
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export this list
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              openCreateDrawer();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New destination
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
          role="alert"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load destinations.
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--admin-danger)]"
            onClick={() => {
              void load();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <DestinationsLoadingSkeleton />
      ) : showEmptyTrue ? (
        <section className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <Inbox className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No destinations configured
          </h2>
          <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Exports can still be downloaded manually. Add a destination to deliver scheduled exports
            by email, webhook, or cloud storage.
          </p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              openCreateDrawer();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New destination
          </button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Destinations
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.totalCount)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {formatCount(summary.emailCount)} email · {formatCount(summary.webhookCount)}{" "}
                webhook · {formatCount(summary.storageCount)} storage
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Deliveries this month
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.deliveriesThisMonth)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-success)]">
                {formatCount(summary.deliveriesSucceededThisMonth)} succeeded
              </p>
            </div>
            <button
              type="button"
              className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)]"
              onClick={() => {
                setStatus("failing");
              }}
            >
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-danger)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-danger)] uppercase">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Failing
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-danger)]">
                {formatCount(summary.failingCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-danger)_80%,transparent)]">
                {summary.failingCaption ?? "No failing destinations"}
              </p>
            </button>
            <div className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5">
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-warning)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-warning)] uppercase">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                External recipients
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-warning)]">
                {formatCount(summary.externalRecipientCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]">
                addresses outside tenant domain
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {formatCount(showingFrom)} of {formatCount(totalCount)}
            {summary.lastDeliveryAt ? (
              <> · Last delivery {formatRelative(summary.lastDeliveryAt)}</>
            ) : null}
          </p>

          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                Search destinations
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className={`${fieldClassName} pl-9`}
                  placeholder="By name or target..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="min-w-[130px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Kind
                  </span>
                }
                labelId={kindLabelId}
                open={kindOpen}
                onToggle={() => {
                  setKindOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{kindFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Kind options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["any", "Any kind"],
                      ["email", "Email"],
                      ["webhook", "Webhook"],
                      ["storage", "Storage"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={kind === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setKind(value);
                        setKindOpen(false);
                      }}
                    >
                      {kind === value ? (
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

            <div className="min-w-[140px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Status
                  </span>
                }
                labelId={statusLabelId}
                open={statusOpen}
                onToggle={() => {
                  setStatusOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{statusFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Status options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["all", "All statuses"],
                      ["enabled", "Enabled"],
                      ["disabled", "Disabled"],
                      ["failing", "Failing"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={status === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setStatus(value);
                        setStatusOpen(false);
                      }}
                    >
                      {status === value ? (
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

            <div className="min-w-[170px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Sort by
                  </span>
                }
                labelId={sortLabelId}
                open={sortOpen}
                onToggle={() => {
                  setSortOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{sortFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Sort options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["name_asc", "Name (A-Z)"],
                      ["updated_desc", "Recently updated"],
                      ["last_delivery_desc", "Last delivery (latest)"],
                      ["failures_desc", "Failures (most)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={sort === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setSort(value);
                        setSortOpen(false);
                      }}
                    >
                      {sort === value ? (
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

            <button
              type="button"
              className={ghostButtonClassName}
              title="Clear filters"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <FilterX className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {showEmptyFiltered ? (
            <section className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
              <Inbox
                className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No destinations match these filters
              </h2>
              <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or adding a new destination.
              </p>
              <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
                Clear filters
              </button>
            </section>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <DestinationBlock
                    key={item.id}
                    item={item}
                    menuOpen={menuOpenId === item.id}
                    onToggleMenu={() => {
                      setMenuOpenId((current) => (current === item.id ? null : item.id));
                    }}
                    onEdit={() => {
                      openEditDrawer(item);
                    }}
                    onTest={() => {
                      void handleTest(item);
                    }}
                    onToggleActive={() => {
                      void handleToggleActive(item);
                    }}
                    onDelete={() => {
                      setMenuOpenId(null);
                      setDeleteTarget(item);
                    }}
                    onCopyWebhook={() => {
                      if (item.webhookUrl) void copyWebhookUrl(item.webhookUrl);
                    }}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between text-sm text-[var(--admin-on-surface-variant)]">
                  <span>
                    {formatCount(showingFrom)}-{formatCount(showingTo)} of {formatCount(totalCount)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page <= 1 || busy}
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page >= totalPages || busy}
                      onClick={() => {
                        setPage((p) => p + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <DestinationDrawer
        open={drawerOpen}
        mode={drawerMode}
        editItem={editItem}
        tenantEmailDomains={summary.tenantEmailDomains}
        busy={busy}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSaved={() => {
          void load();
        }}
      />

      {deleteTarget ? (
        <DeleteDestinationModal
          item={deleteTarget}
          busy={busy}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      ) : null}
    </div>
  );
}
