"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Check, Medal, ShieldCheck, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { certificateDtoSchema } from "@atlas/contracts/certificates/certificate.dto";
import { formatFullDate } from "../progress-view";

type CertificateDto = z.infer<typeof certificateDtoSchema>;

type CredentialsGalleryProps = {
  certificates: CertificateDto[];
};

const DECOR_ICONS: LucideIcon[] = [Award, Medal, ShieldCheck];

function CredentialCard({ certificate, index }: { certificate: CertificateDto; index: number }) {
  const [copied, setCopied] = useState(false);
  const DecorIcon = DECOR_ICONS[index % DECOR_ICONS.length] ?? Award;
  const issued = formatFullDate(certificate.issuedAt);

  async function handleShare() {
    if (typeof navigator === "undefined") return;
    const url = certificate.verificationUrl;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: certificate.templateName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // User dismissed the share sheet or clipboard was unavailable; no action needed.
    }
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-300 hover:border-primary">
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-muted p-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, var(--primary) 1px, transparent 0)",
            backgroundSize: "16px 16px",
          }}
        />
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-primary/20 bg-card/60 p-4 backdrop-blur-sm">
          <DecorIcon className="h-9 w-9 text-primary" strokeWidth={1.75} aria-hidden="true" />
          <span className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {certificate.templateName}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{certificate.templateName}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">ID: {certificate.credentialId}</p>
          </div>
          {certificate.status !== "issued" ? (
            <span className="rounded-md bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--warning)_76%,var(--foreground))]">
              {certificate.status}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Earned {issued}</span>
          <button
            type="button"
            onClick={() => {
              void handleShare();
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Share
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function CredentialsGallery({ certificates }: CredentialsGalleryProps) {
  return (
    <section id="credentials" aria-labelledby="credentials-heading" className="scroll-mt-24">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 id="credentials-heading" className="text-xl font-semibold text-foreground">
            Credentials
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified proofs of the skills you have demonstrated.
          </p>
        </div>
        <Link
          href="/achievements"
          className="whitespace-nowrap text-xs font-semibold text-primary transition-colors hover:underline"
        >
          All achievements
        </Link>
      </div>

      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Award className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            No certificates yet. Complete a course to earn your first verified credential.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate, index) => (
            <CredentialCard key={certificate.id} certificate={certificate} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
