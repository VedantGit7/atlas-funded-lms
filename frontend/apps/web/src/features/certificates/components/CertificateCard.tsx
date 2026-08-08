"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { cn } from "@atlas/design-system";
import {
  type CertificateDto,
  certificateIcon,
  formatIssueDate,
  statusMeta,
} from "../certificates-view";

type CertificateCardProps = {
  certificate: CertificateDto;
  issuerName?: string | null;
  /** Absolute public verification URL. Falls back to the relative contract path. */
  verifyUrl?: string;
  onShare?: () => void;
  index?: number;
};

export function CertificateCard({
  certificate,
  issuerName = null,
  verifyUrl,
  onShare,
  index = 0,
}: CertificateCardProps) {
  const [copied, setCopied] = useState(false);
  const resolvedVerifyUrl = verifyUrl ?? certificate.verificationUrl;
  const Icon = certificateIcon(certificate.templateId || certificate.credentialId || String(index));
  const status = statusMeta(certificate.status);
  const isRevoked = certificate.status === "revoked";
  const issued = formatIssueDate(certificate.issuedAt);
  const recipient = certificate.recipientLabel?.trim();

  async function copyCredentialId() {
    if (typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(certificate.credentialId);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard unavailable (permissions or insecure origin); no action needed.
    }
  }

  return (
    <article className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold leading-tight text-foreground">
              {certificate.templateName}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {certificate.credentialId}
              </span>
              <button
                type="button"
                onClick={() => {
                  void copyCredentialId();
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={copied ? "Credential ID copied" : "Copy credential ID"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            backgroundColor: `color-mix(in srgb, var(${status.cssVar}) 14%, transparent)`,
            color: `color-mix(in srgb, var(${status.cssVar}) 80%, var(--foreground))`,
          }}
        >
          {status.label}
        </span>
      </div>

      <div className={cn("mb-6 flex-1 space-y-4", isRevoked && "opacity-60")}>
        <div className="grid grid-cols-2 gap-4">
          {recipient ? (
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recipient
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{recipient}</p>
            </div>
          ) : null}
          {issued ? (
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Issue date
              </p>
              <p className="text-sm font-semibold text-foreground">{issued}</p>
            </div>
          ) : null}
        </div>
        {issuerName ? (
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Institution
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{issuerName}</p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <a
          href={resolvedVerifyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          View credential
        </a>
        {onShare ? (
          <button
            type="button"
            onClick={onShare}
            disabled={isRevoked}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Share
          </button>
        ) : null}
      </div>
    </article>
  );
}
