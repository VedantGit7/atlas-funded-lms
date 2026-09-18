"use client";

import { Award, Ban, Copy, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import {
  avatarInitials,
  CertificateStatusPill,
  dangerOutlineButtonClassName,
  ghostButtonClassName,
  outlineButtonClassName,
  type CertificateDto,
} from "./certificate-template-admin-shared";

type CertificateDetailPanelProps = {
  certificate: CertificateDto | null;
  onClose: () => void;
  onRevoke: (certificate: CertificateDto) => void;
};

export function CertificateDetailPanel({
  certificate,
  onClose,
  onRevoke,
}: CertificateDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!certificate) return null;

  const recipient = certificate.recipientLabel ?? certificate.membershipId;

  function copyCredentialId() {
    if (!certificate) return;
    void navigator.clipboard.writeText(certificate.credentialId).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }

  return (
    <aside className="flex w-full max-w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm motion-safe:animate-[admin-slide-up_0.2s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
          Credential details
        </h3>
        <button
          type="button"
          aria-label="Close details"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div
          className="relative flex h-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 p-4 text-center"
          style={{
            backgroundColor: "var(--admin-certificate-paper)",
            color: "var(--admin-certificate-ink)",
            borderColor: "var(--admin-primary)",
          }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border-2"
            style={{ borderColor: "color-mix(in srgb, var(--admin-primary) 40%, transparent)" }}
          >
            <Award
              className="h-4 w-4"
              style={{ color: "var(--admin-primary)" }}
              aria-hidden="true"
            />
          </div>
          <p className="font-ceremonial text-sm font-semibold leading-tight">
            {certificate.templateName}
          </p>
          <span className="rounded-full bg-[var(--admin-surface)] px-3 py-1 font-mono text-[11px] tracking-wide text-[var(--admin-primary)]">
            {certificate.credentialId}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Status
            </dt>
            <dd>
              <CertificateStatusPill status={certificate.status} />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Issued
            </dt>
            <dd className="text-sm font-medium text-[var(--admin-on-surface)]">
              {new Date(certificate.issuedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </dd>
          </div>
          {certificate.status === "revoked" && certificate.revokedAt ? (
            <div className="flex flex-col gap-1">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-danger)]">
                Revoked
              </dt>
              <dd className="text-sm font-medium text-[var(--admin-danger)]">
                {new Date(certificate.revokedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Recipient
          </span>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-bold text-[var(--admin-on-primary-container)]">
              {avatarInitials(recipient)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                {recipient}
              </p>
              <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {certificate.membershipId}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Credential ID
          </span>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2">
            <span className="truncate font-mono text-xs text-[var(--admin-on-surface)]">
              {certificate.credentialId}
            </span>
            <button type="button" className={ghostButtonClassName} onClick={copyCredentialId}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--admin-border)] p-5">
        <a
          href={certificate.verificationUrl}
          target="_blank"
          rel="noreferrer"
          className={outlineButtonClassName}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open public verification page
        </a>
        {certificate.status === "issued" ? (
          <button
            type="button"
            className={dangerOutlineButtonClassName}
            onClick={() => {
              onRevoke(certificate);
            }}
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Revoke certificate
          </button>
        ) : null}
      </div>
    </aside>
  );
}
