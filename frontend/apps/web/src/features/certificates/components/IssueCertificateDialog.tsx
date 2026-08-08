"use client";

import { Award, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { CertificateSelectField } from "./CertificateSelectField";
import {
  errorBannerClassName,
  helperClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "./certificate-template-admin-shared";

type SourceOption = {
  type: "course" | "learning_path" | "assessment";
  id: string;
  label: string;
};

type IssueCertificateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  templates: Array<{ id: string; name: string }>;
  members: Array<{ id: string; label: string }>;
  sourceOptions: SourceOption[];
  defaultSource: { type: "course" | "learning_path" | "assessment"; id: string };
};

export function IssueCertificateDialog({
  open,
  onClose,
  onSuccess,
  templates,
  members,
  sourceOptions,
  defaultSource,
}: IssueCertificateDialogProps) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [recipientMembershipId, setRecipientMembershipId] = useState(members[0]?.id ?? "");
  const [sourceKey, setSourceKey] = useState(`${defaultSource.type}:${defaultSource.id}`);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  async function submit() {
    setMessage(null);
    setRequestId(null);

    const selectedSource = sourceOptions.find(
      (option) => `${option.type}:${option.id}` === sourceKey,
    );
    if (!selectedSource) {
      setMessage("Select a valid completion source.");
      return;
    }

    setBusy(true);
    try {
      await clientApi.post(
        "/api/v1/certificates/issue",
        {
          templateId,
          recipientMembershipId,
          source: {
            type: selectedSource.type,
            id: selectedSource.id,
          },
        },
        "issue-certificate",
      );
      onSuccess();
      onClose();
    } catch (caught) {
      if (caught instanceof ClientApiError) {
        setMessage(caught.message);
        setRequestId(caught.requestId);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-theme fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-primary-container)]">
              <Award className="h-4 w-4 text-[var(--admin-on-primary-container)]" aria-hidden="true" />
            </div>
            <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Issue certificate
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <CertificateSelectField
            label="Template"
            value={templateId}
            onChange={setTemplateId}
            portalZIndex={130}
            options={templates.map((template) => ({ value: template.id, label: template.name }))}
          />

          <CertificateSelectField
            label="Recipient"
            value={recipientMembershipId}
            onChange={setRecipientMembershipId}
            portalZIndex={130}
            options={members.map((member) => ({ value: member.id, label: member.label }))}
          />

          <div className="flex flex-col gap-1.5">
            <CertificateSelectField
              label="Completion source"
              value={sourceKey}
              onChange={setSourceKey}
              portalZIndex={130}
              options={sourceOptions.map((option) => ({
                value: `${option.type}:${option.id}`,
                label: option.label,
              }))}
            />
            <span className={helperClassName}>
              The course, learning path, or assessment this certificate reflects completion of.
            </span>
          </div>

          {message ? (
            <div className={errorBannerClassName}>
              <p>{message}</p>
              {requestId ? <p className="mt-1 text-xs opacity-70">Request ID: {requestId}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={outlineButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Issuing…" : "Issue certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}
