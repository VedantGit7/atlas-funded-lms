import type { z } from "zod";
import type { publicVerifyResponseSchema } from "@atlas/contracts/certificates/certificate.dto";
import { VerificationActions } from "./VerificationActions";

type PublicVerifyData = z.infer<typeof publicVerifyResponseSchema>["data"];

type VerificationCardProps = {
  data: PublicVerifyData;
  issuerName?: string | null;
  verificationUrl: string;
  openBadgeUrl?: string | null;
  qrDataUrl?: string | null;
};

const FALLBACK_LOGO = "/brand/avatar-gradient.svg";

type StatusPresentation = {
  label: string;
  dotClass: string;
  badgeClass: string;
};

function presentStatus(status: PublicVerifyData["status"]): StatusPresentation {
  switch (status) {
    case "issued":
      return {
        label: "Valid",
        dotClass: "bg-emerald-500",
        badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      };
    case "revoked":
      return {
        label: "Revoked",
        dotClass: "bg-red-500",
        badgeClass: "bg-red-50 text-red-700 ring-red-600/20",
      };
    case "expired":
      return {
        label: "Expired",
        dotClass: "bg-amber-500",
        badgeClass: "bg-amber-50 text-amber-700 ring-amber-600/20",
      };
    case "suspended":
      return {
        label: "Suspended",
        dotClass: "bg-orange-500",
        badgeClass: "bg-orange-50 text-orange-700 ring-orange-600/20",
      };
    default:
      return {
        label: status,
        dotClass: "bg-neutral-400",
        badgeClass: "bg-neutral-100 text-neutral-700 ring-neutral-500/20",
      };
  }
}

function buildLinkedInAddToProfileUrl(args: {
  certName: string;
  organizationName: string;
  issuedAt: string;
  expiresAt?: string;
  certId: string;
  certUrl: string;
}): string {
  const issued = new Date(args.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: args.certName,
    organizationName: args.organizationName,
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certId: args.certId,
    certUrl: args.certUrl,
  });

  if (args.expiresAt) {
    const expires = new Date(args.expiresAt);
    params.set("expirationYear", String(expires.getUTCFullYear()));
    params.set("expirationMonth", String(expires.getUTCMonth() + 1));
  }

  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function VerificationCard({
  data,
  issuerName,
  verificationUrl,
  openBadgeUrl,
  qrDataUrl,
}: VerificationCardProps) {
  const displayIssuer = data.issuer.displayName ?? issuerName ?? "Issuer";
  const status = presentStatus(data.status);
  const courseTitle = data.courseTitle ?? "Certificate of completion";
  const issuedDate = formatDate(data.issuedAt);
  const expiresDate = formatDate(data.expiresAt);
  const verifiedDate = formatDate(data.verifiedAt);

  const linkedInUrl = buildLinkedInAddToProfileUrl({
    certName: courseTitle,
    organizationName: displayIssuer,
    issuedAt: data.issuedAt,
    ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
    certId: data.serialNumber ?? data.credentialId,
    certUrl: verificationUrl,
  });

  return (
    <article className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm print:shadow-none">
      <header className="flex items-start gap-4 border-b border-neutral-200 bg-neutral-50/60 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.issuer.logoUrl ?? FALLBACK_LOGO}
          alt={`${displayIssuer} logo`}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl border border-neutral-200 bg-white object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Credential verification
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-neutral-900">{displayIssuer}</h1>
          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.badgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} aria-hidden />
            {status.label}
          </span>
        </div>
      </header>

      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto]">
        <dl className="grid gap-4 text-sm">
          {data.recipientName ? (
            <div>
              <dt className="font-medium text-neutral-500">Recipient</dt>
              <dd className="mt-0.5 text-base text-neutral-900">{data.recipientName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-neutral-500">Credential</dt>
            <dd className="mt-0.5 text-base text-neutral-900">{courseTitle}</dd>
          </div>
          <div>
            <dt className="font-medium text-neutral-500">Credential ID</dt>
            <dd className="mt-0.5 break-all font-mono text-neutral-900">{data.credentialId}</dd>
          </div>
          {data.serialNumber ? (
            <div>
              <dt className="font-medium text-neutral-500">Serial number</dt>
              <dd className="mt-0.5 font-mono text-neutral-900">{data.serialNumber}</dd>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            {issuedDate ? (
              <div>
                <dt className="font-medium text-neutral-500">Issued</dt>
                <dd className="mt-0.5 text-neutral-900">{issuedDate}</dd>
              </div>
            ) : null}
            {expiresDate ? (
              <div>
                <dt className="font-medium text-neutral-500">Expires</dt>
                <dd className="mt-0.5 text-neutral-900">{expiresDate}</dd>
              </div>
            ) : null}
          </div>
        </dl>

        {qrDataUrl ? (
          <div className="flex flex-col items-center justify-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Verification QR code"
              width={140}
              height={140}
              className="h-[140px] w-[140px] rounded-lg border border-neutral-200 bg-white p-1.5"
            />
            <span className="text-[11px] text-neutral-400">Scan to verify</span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-neutral-200 px-6 pb-6">
        <VerificationActions
          verificationUrl={verificationUrl}
          shareTitle={`${courseTitle} — ${displayIssuer}`}
          downloadUrl={data.downloadUrl ?? null}
        />

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm print:hidden">
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-[#0a66c2] hover:underline"
          >
            Add to LinkedIn profile
          </a>
          {openBadgeUrl ? (
            <a
              href={openBadgeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-neutral-600 hover:underline"
            >
              View Open Badge (VC)
            </a>
          ) : null}
        </div>

        {verifiedDate ? (
          <p className="mt-4 text-xs text-neutral-400">Verified {verifiedDate}</p>
        ) : null}
      </div>
    </article>
  );
}

export function VerificationNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-neutral-900">Credential not found</h1>
      <p className="mt-2 text-sm text-neutral-600">
        This credential could not be verified for the current site. Check the link or contact the
        issuer.
      </p>
    </div>
  );
}
