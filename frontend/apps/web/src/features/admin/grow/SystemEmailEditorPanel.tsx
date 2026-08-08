"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Braces,
  Check,
  Copy,
  Monitor,
  Send,
  Shield,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import {
  MESSENGER_WIZARD_FIELD_CLASS,
  MESSENGER_WIZARD_LABEL_CLASS,
} from "./push-wizard-chrome";
import {
  SYSTEM_EMAIL_LIST_HREF,
  TRANSACTIONAL_EMAIL_SETTINGS_HREF,
  formatSystemEmailCategory,
  renderSystemEmailPreview,
  sampleMapFromVariables,
  type SystemEmailDto,
  type SystemEmailVariable,
} from "./system-email-shared";

type DetailResponse = { data: SystemEmailDto };
type PreviewResponse = {
  data: {
    subject: string;
    body: string;
    sampleVariables: Record<string, string>;
    variables: SystemEmailVariable[];
    defaultActionPath: string;
  };
};
type MeResponse = {
  data: {
    identity: { email: string | null };
    profile: { displayName: string | null } | null;
  };
};
type TransactionalEmailResponse = {
  data: { fromName: string; fromEmail: string; replyToEmail: string | null };
};

type PreviewMode = "desktop" | "mobile";

type SystemEmailEditorPanelProps = {
  emailKey: string;
};

function PreviewAccent({
  emailKey,
  category,
  sampleVariables,
  actionPath,
}: {
  emailKey: string;
  category: SystemEmailDto["category"];
  sampleVariables: Record<string, string>;
  actionPath: string;
}) {
  if (emailKey === "certificate.issued") {
    return (
      <div className="my-6 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--admin-primary)]">
            Verified credential
          </span>
          <Award className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
        </div>
        <h4 className="text-base font-semibold text-[var(--admin-on-surface)]">Certificate</h4>
        <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
          Issued on {sampleVariables["issuedAt"] ?? "—"}
        </p>
        <div className="mt-6 flex justify-center">
          <span className="inline-flex rounded-lg bg-[var(--admin-primary)] px-7 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-[0_8px_20px_color-mix(in_srgb,var(--admin-primary)_22%,transparent)]">
            View certificate
          </span>
        </div>
        <p className="mt-3 text-center text-[11px] text-[var(--admin-on-surface-variant)]">
          Opens {actionPath}
        </p>
      </div>
    );
  }

  if (emailKey === "certificate.revoked") {
    return (
      <div className="my-6 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-5">
        <div className="mb-2 flex items-center gap-2 text-[var(--admin-danger)]">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Revocation notice</span>
        </div>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Revoked on {sampleVariables["revokedAt"] ?? "—"}. Review certificates in your account.
        </p>
      </div>
    );
  }

  if (category === "security") {
    return (
      <div className="my-6 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-5">
        <div className="mb-3 flex items-center gap-2 text-[var(--admin-warning)]">
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Security alert</span>
        </div>
        {sampleVariables["email"] ? (
          <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
            Account:{" "}
            <strong className="text-[var(--admin-on-surface)]">{sampleVariables["email"]}</strong>
          </p>
        ) : null}
        <span className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-on-surface)]">
          Secure my account
        </span>
        <p className="mt-3 text-[11px] text-[var(--admin-on-surface-variant)]">Opens {actionPath}</p>
      </div>
    );
  }

  return null;
}

export function SystemEmailEditorPanel({ emailKey }: SystemEmailEditorPanelProps) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const [item, setItem] = useState<SystemEmailDto | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [variables, setVariables] = useState<SystemEmailVariable[]>([]);
  const [actionPath, setActionPath] = useState("/notifications");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const sampleVariables = useMemo(() => sampleMapFromVariables(variables), [variables]);

  const liveSubject = useMemo(
    () => renderSystemEmailPreview(subject, sampleVariables),
    [subject, sampleVariables],
  );
  const liveBody = useMemo(
    () => renderSystemEmailPreview(body, sampleVariables),
    [body, sampleVariables],
  );

  const dirty = useMemo(() => {
    if (!item) return false;
    return subject !== item.subject || body !== item.body;
  }, [item, subject, body]);

  const previewRecipient =
    sampleVariables["email"]?.trim() ||
    testEmail.trim() ||
    "learner@example.com";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, preview] = await Promise.all([
        clientApi.get<DetailResponse>(
          `/api/v1/marketing/system-emails/${encodeURIComponent(emailKey)}`,
        ),
        clientApi.get<PreviewResponse>(
          `/api/v1/marketing/system-emails/${encodeURIComponent(emailKey)}/preview`,
        ),
      ]);
      setItem(detail.data);
      setSubject(detail.data.subject);
      setBody(detail.data.body);
      setVariables(preview.data.variables ?? []);
      setActionPath(preview.data.defaultActionPath || detail.data.defaultActionPath);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load system email.",
      );
      router.replace(SYSTEM_EMAIL_LIST_HREF);
    } finally {
      setLoading(false);
    }
  }, [emailKey, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void clientApi
      .get<MeResponse>("/api/v1/me")
      .then((me) => {
        if (cancelled) return;
        if (me.data.identity.email) setTestEmail(me.data.identity.email);
      })
      .catch(() => {
        /* optional prefills */
      });
    void clientApi
      .get<TransactionalEmailResponse>("/api/v1/tenant-settings/transactional-email")
      .then((response) => {
        if (cancelled) return;
        setFromName(response.data.fromName?.trim() || "");
        setFromEmail(response.data.fromEmail?.trim() || "");
      })
      .catch(() => {
        /* preview falls back to generic sender label */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!item) return;
    setBusy(true);
    try {
      const response = await clientApi.put<DetailResponse>(
        `/api/v1/marketing/system-emails/${encodeURIComponent(item.key)}`,
        { subject: subject.trim(), body: body.trim() },
        `system-email-save-${item.key}`,
      );
      setItem(response.data);
      setSubject(response.data.subject);
      setBody(response.data.body);
      toast.success("System email saved.");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function resetToDefault() {
    if (!item) return;
    setBusy(true);
    try {
      const response = await clientApi.post<DetailResponse>(
        `/api/v1/marketing/system-emails/${encodeURIComponent(item.key)}/reset`,
        null,
        `system-email-reset-${item.key}`,
      );
      setItem(response.data);
      setSubject(response.data.subject);
      setBody(response.data.body);
      toast.success("Reset to default template.");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not reset.");
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!item) return;
    setBusy(true);
    try {
      const response = await clientApi.post<DetailResponse>(
        `/api/v1/marketing/system-emails/${encodeURIComponent(item.key)}/enabled`,
        { enabled },
        `system-email-enabled-${item.key}`,
      );
      setItem(response.data);
      toast.success(enabled ? "System email enabled." : "System email disabled.");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!item || !testEmail.trim()) {
      toast.error("Enter a test email address.");
      return;
    }
    if (!item.enabled) {
      toast.error("Enable this system email before sending a test.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/system-emails/${encodeURIComponent(item.key)}/test`,
        { testEmail: testEmail.trim() },
        `system-email-test-${item.key}`,
        { silent: true },
      );
      toast.success(`Test email sent to ${testEmail.trim()}.`);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not send test.");
    } finally {
      setBusy(false);
    }
  }

  function insertToken(tokenKey: string) {
    const token = `{{${tokenKey}}}`;
    const field = bodyRef.current;
    if (!field) {
      setBody((current) => `${current}${token}`);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + token.length;
      field.setSelectionRange(cursor, cursor);
    });
  }

  async function copyToken(tokenKey: string) {
    const token = `{{${tokenKey}}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopiedKey(tokenKey);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === tokenKey ? null : current));
      }, 1600);
      toast.success("Token copied.");
    } catch {
      toast.error("Could not copy token.");
    }
  }

  if (loading || !item) {
    return (
      <div className="space-y-4">
        <Link
          href={SYSTEM_EMAIL_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to catalog
        </Link>
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <div className="h-10 w-72 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
          <div className="h-[28rem] animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
        </div>
      </div>
    );
  }

  const senderLabel = fromName || "Transactional sender";
  const testDisabled = busy || !item.enabled;

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)] lg:-mx-0">
      {/* Top bar */}
      <header className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href={SYSTEM_EMAIL_LIST_HREF}
            prefetch={false}
            className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to catalog
          </Link>
          <span className="hidden h-6 w-px bg-[var(--admin-border)] sm:block" aria-hidden="true" />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold tracking-[-0.01em] text-[var(--admin-on-surface)] sm:text-2xl">
              {item.name}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              {item.category === "certificates" ? (
                <Award className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Shield className="h-3 w-3" aria-hidden="true" />
              )}
              {formatSystemEmailCategory(item.category)}
            </span>
            {dirty ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-warning)]">
                Unsaved
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 sm:px-4">
            <span className="text-[12px] font-bold text-[var(--admin-on-surface-variant)]">Status</span>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <span className="relative inline-flex h-5 w-9 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={item.enabled}
                  disabled={busy}
                  onChange={(event) => void setEnabled(event.target.checked)}
                  aria-label={item.enabled ? "Disable system email" : "Enable system email"}
                />
                <span
                  className={[
                    "absolute inset-0 rounded-full transition-colors",
                    item.enabled
                      ? "bg-[var(--admin-success)]"
                      : "bg-[var(--admin-outline)]",
                  ].join(" ")}
                  aria-hidden="true"
                />
                <span
                  className={[
                    "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform",
                    item.enabled ? "translate-x-4" : "translate-x-0",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </span>
              <span className="text-[12px] font-bold text-[var(--admin-on-surface)]">
                {item.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
          <Link
            href={TRANSACTIONAL_EMAIL_SETTINGS_HREF}
            prefetch={false}
            className="text-[12px] font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Sender settings
          </Link>
        </div>
      </header>

      {item.isCustomized ? (
        <div className="flex flex-col gap-2 border-b border-[color-mix(in_srgb,var(--admin-warning)_24%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-2 text-[var(--admin-warning)] sm:items-center">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden="true" />
            <p className="text-[12px] font-semibold leading-snug">
              You are using a customized version of this email. System updates to the base
              template will not be applied.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resetToDefault()}
            className="shrink-0 text-left text-[12px] font-bold text-[var(--admin-warning)] underline underline-offset-2 transition-opacity hover:opacity-80 disabled:opacity-50 sm:text-right"
          >
            Reset to default
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Editor */}
        <section className="flex w-full flex-col overflow-y-auto border-b border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-[450px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="space-y-6 p-4 sm:p-6">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{item.description}</p>

            <div>
              <label htmlFor="system-email-subject" className={MESSENGER_WIZARD_LABEL_CLASS}>
                Subject line
              </label>
              <input
                id="system-email-subject"
                type="text"
                value={subject}
                maxLength={200}
                onChange={(event) => setSubject(event.target.value)}
                className={MESSENGER_WIZARD_FIELD_CLASS}
                placeholder="Enter email subject…"
              />
            </div>

            <div>
              <label htmlFor="system-email-body" className={MESSENGER_WIZARD_LABEL_CLASS}>
                Email body
              </label>
              <p className="mb-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                Plain text with personalization tokens. HTML is not supported in system emails.
              </p>
              <textarea
                id="system-email-body"
                ref={bodyRef}
                value={body}
                rows={14}
                maxLength={4000}
                onChange={(event) => setBody(event.target.value)}
                className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[18rem] resize-y`}
                placeholder="Write the email body…"
              />
            </div>

            <div className="space-y-3 border-t border-[var(--admin-border)] pt-5">
              <div className="flex items-center gap-2">
                <Braces className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Personalization tokens
                </h2>
              </div>
              {variables.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  This template does not expose personalization tokens.
                </p>
              ) : (
                <ul className="space-y-3">
                  {variables.map((variable) => {
                    const token = `{{${variable.key}}}`;
                    const copied = copiedKey === variable.key;
                    return (
                      <li key={variable.key}>
                        <div className="group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 transition-colors hover:border-[var(--admin-primary)]">
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => insertToken(variable.key)}
                              className="rounded bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-2 py-0.5 font-mono text-[12px] font-bold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))]"
                              title="Insert into body"
                            >
                              {token}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyToken(variable.key)}
                              className="rounded p-1 text-[var(--admin-outline)] opacity-70 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                              aria-label={copied ? `Copied ${token}` : `Copy ${token}`}
                            >
                              {copied ? (
                                <Check className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
                              ) : (
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                          <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                            {variable.description}
                          </p>
                          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]/80">
                            Sample: {variable.sample}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Live preview */}
        <section
          className="flex min-h-[24rem] flex-1 flex-col overflow-y-auto bg-[radial-gradient(var(--admin-border)_1px,transparent_1px)] bg-[length:20px_20px] bg-[var(--admin-bg)] p-4 sm:p-6"
          aria-label="Live email preview"
        >
          <div
            className={[
              "mx-auto mb-4 flex w-full items-center justify-between px-1",
              previewMode === "mobile" ? "max-w-[380px]" : "max-w-[650px]",
            ].join(" ")}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
              Live preview
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Preview width">
              <button
                type="button"
                onClick={() => setPreviewMode("desktop")}
                className={[
                  "rounded p-1.5 transition-colors",
                  previewMode === "desktop"
                    ? "bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
                aria-pressed={previewMode === "desktop"}
                aria-label="Desktop preview"
              >
                <Monitor className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("mobile")}
                className={[
                  "rounded p-1.5 transition-colors",
                  previewMode === "mobile"
                    ? "bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
                aria-pressed={previewMode === "mobile"}
                aria-label="Mobile preview"
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className={[
              "mx-auto w-full overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_18px_40px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]",
              previewMode === "mobile" ? "max-w-[380px]" : "max-w-[650px]",
            ].join(" ")}
          >
            <div className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,var(--admin-surface))] p-5 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
                  {item.category === "certificates" ? (
                    <Award className="h-6 w-6 text-[var(--admin-primary)]" aria-hidden="true" />
                  ) : (
                    <Shield className="h-6 w-6 text-[var(--admin-warning)]" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[var(--admin-on-surface)]">{senderLabel}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-[var(--admin-outline)]">
                      Just now
                    </span>
                  </div>
                  {fromEmail ? (
                    <p className="truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                      {fromEmail}
                    </p>
                  ) : null}
                  <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                    <span className="text-[var(--admin-on-surface-variant)]/80">Subject:</span>{" "}
                    {liveSubject || "—"}
                  </p>
                  <p className="truncate text-[13px] text-[var(--admin-on-surface-variant)]">
                    <span className="text-[var(--admin-on-surface-variant)]/80">To:</span>{" "}
                    {previewRecipient}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--admin-surface)] px-6 py-8 sm:px-10 sm:py-10">
              <div className="mx-auto max-w-[480px] space-y-5">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--admin-on-surface-variant)]">
                  {liveBody || "Body preview will appear here."}
                </p>

                <PreviewAccent
                  emailKey={item.key}
                  category={item.category}
                  sampleVariables={sampleVariables}
                  actionPath={actionPath}
                />

                <div className="space-y-3 border-t border-[var(--admin-border)] pt-6 text-center">
                  <p className="text-[11px] leading-relaxed text-[var(--admin-outline)]">
                    Preview uses sample personalization values. Delivery uses your transactional
                    email channel settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Action bar */}
      <footer className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div
          className={[
            "flex flex-col gap-2 sm:flex-row sm:items-center",
            testDisabled ? "opacity-55" : "",
          ].join(" ")}
        >
          <label className="sr-only" htmlFor="system-email-test">
            Test email address
          </label>
          <input
            id="system-email-test"
            type="email"
            value={testEmail}
            disabled={busy}
            onChange={(event) => setTestEmail(event.target.value)}
            placeholder="test@example.com"
            className={`${MESSENGER_WIZARD_FIELD_CLASS} w-full sm:w-64`}
          />
          <button
            type="button"
            disabled={testDisabled}
            onClick={() => void sendTest()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-on-surface-variant)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] px-4 py-2.5 text-[12px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_14%,var(--admin-surface))] disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Send test
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void resetToDefault()}
            className="rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_24%,var(--admin-border))] px-5 py-2.5 text-[12px] font-bold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] disabled:opacity-50"
          >
            Reset to default
          </button>
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => void save()}
            className="rounded-xl bg-[var(--admin-primary)] px-7 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] shadow-[0_8px_20px_color-mix(in_srgb,var(--admin-primary)_22%,transparent)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </footer>
    </div>
  );
}
