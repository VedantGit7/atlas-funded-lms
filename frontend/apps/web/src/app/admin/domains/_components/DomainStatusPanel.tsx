"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe, Lock, Star, Trash2 } from "lucide-react";
import type { z } from "zod";
import type { TenantDomainViewSchema } from "@atlas/domain-branding/schemas/domains";
import { AdminConfirmDialog } from "../../../../components/shells/admin/AdminConfirmDialog";
import {
  BrandingAnimatedCollapsible,
  cardClassName,
  statusBannerClassName,
} from "../../branding/_components/branding-admin-shared";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { DomainDnsVerificationPanel } from "./DomainDnsVerificationPanel";
import {
  domainStatusBadgeClassName,
  domainStatusDotClassName,
  domainTypeBadgeClassName,
  formatDomainStatus,
  formatDomainType,
  monoHostnameClassName,
  needsDnsVerification,
  tableHeaderClassName,
} from "./domains-admin-shared";

type TenantDomain = z.infer<typeof TenantDomainViewSchema>;

type DomainStatusPanelProps = {
  domains: TenantDomain[];
};

export function DomainStatusPanel({ domains }: DomainStatusPanelProps) {
  const router = useRouter();
  const [busyDomainId, setBusyDomainId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<TenantDomain | null>(null);
  const [primaryTarget, setPrimaryTarget] = useState<TenantDomain | null>(null);

  const sortedDomains = [...domains].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    if (left.type !== right.type) {
      return left.type === "ATLAS_SUBDOMAIN" ? -1 : 1;
    }
    return left.hostname.localeCompare(right.hostname);
  });

  async function disableDomain(domain: TenantDomain) {
    if (domain.type === "ATLAS_SUBDOMAIN") {
      setErrorMessage("Atlas fallback subdomains cannot be removed.");
      return;
    }

    setBusyDomainId(domain.id);
    setErrorMessage(null);

    try {
      await clientApi.delete(`/api/v1/domains/${domain.id}`, "domain-delete");
      setDisableTarget(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyDomainId(null);
    }
  }

  async function setPrimaryDomain(domain: TenantDomain) {
    setBusyDomainId(domain.id);
    setErrorMessage(null);

    try {
      await clientApi.put(`/api/v1/domains/${domain.id}/primary`, {}, "domain-set-primary");
      setPrimaryTarget(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusyDomainId(null);
    }
  }

  return (
    <section className={cardClassName} aria-label="Configured domains">
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 px-6 py-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
          Configured domains
        </h2>
      </div>

      <BrandingAnimatedCollapsible open={Boolean(errorMessage)} id="domains-error-banner">
        {errorMessage ? (
          <p
            role="alert"
            className={`mx-6 mt-4 ${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {errorMessage}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      {sortedDomains.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <Globe className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-[var(--admin-on-surface)]">No domains configured</p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Add a custom domain to route learners to your branded hostname.
          </p>
        </div>
      ) : (
        <>
          <div
            className="hidden grid-cols-12 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-3 md:grid"
            aria-hidden="true"
          >
            <div className={`col-span-5 ${tableHeaderClassName}`}>Hostname</div>
            <div className={`col-span-3 text-center ${tableHeaderClassName}`}>Type</div>
            <div className={`col-span-2 text-center ${tableHeaderClassName}`}>Status</div>
            <div className={`col-span-2 text-right ${tableHeaderClassName}`}>Actions</div>
          </div>

          <div className="divide-y divide-[var(--admin-border)]">
            {sortedDomains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                busy={busyDomainId === domain.id}
                onDisable={() => {
                  setDisableTarget(domain);
                }}
                onSetPrimary={() => {
                  setPrimaryTarget(domain);
                }}
              />
            ))}
          </div>
        </>
      )}

      <AdminConfirmDialog
        open={disableTarget != null}
        title="Remove custom domain?"
        description={`Disable ${disableTarget?.hostname ?? "this domain"}? Traffic will stop resolving to this tenant on that host.`}
        confirmLabel="Remove domain"
        busyLabel="Removing…"
        cancelLabel="Keep domain"
        icon={Trash2}
        tone="danger"
        busy={busyDomainId != null}
        onConfirm={() => {
          if (disableTarget) {
            void disableDomain(disableTarget);
          }
        }}
        onCancel={() => {
          setDisableTarget(null);
        }}
      />

      <AdminConfirmDialog
        open={primaryTarget != null}
        title="Set primary domain?"
        description={`Make ${primaryTarget?.hostname ?? "this domain"} the primary host for this tenant?`}
        confirmLabel="Set primary"
        busyLabel="Updating…"
        icon={Star}
        tone="primary"
        busy={busyDomainId != null}
        onConfirm={() => {
          if (primaryTarget) {
            void setPrimaryDomain(primaryTarget);
          }
        }}
        onCancel={() => {
          setPrimaryTarget(null);
        }}
      />
    </section>
  );
}

function DomainRow({
  domain,
  busy,
  onDisable,
  onSetPrimary,
}: {
  domain: TenantDomain;
  busy: boolean;
  onDisable: () => void;
  onSetPrimary: () => void;
}) {
  const showDnsPanel =
    needsDnsVerification(domain.status) &&
    domain.verificationTxtName &&
    domain.verificationTxtValue;

  const isSystemLocked = domain.type === "ATLAS_SUBDOMAIN";

  return (
    <div className="motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--admin-surface-low)]/40">
      <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-12 md:items-center md:gap-0">
        <div className="md:col-span-5">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] md:sr-only">
            Hostname
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                monoHostnameClassName,
                domain.type === "CUSTOM_DOMAIN" && !domain.isPrimary
                  ? "!text-[var(--admin-on-surface)] !bg-[var(--admin-surface-high)]"
                  : "",
              ].join(" ")}
            >
              {domain.hostname}
            </span>
            {domain.isPrimary ? (
              <Star
                className="h-4 w-4 fill-[var(--admin-primary)] text-[var(--admin-primary)]"
                aria-label="Primary domain"
              />
            ) : null}
          </div>
        </div>

        <div className="md:col-span-3 md:flex md:justify-center">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] md:sr-only">
            Type
          </p>
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              domainTypeBadgeClassName(domain.type),
            ].join(" ")}
          >
            {formatDomainType(domain.type)}
          </span>
        </div>

        <div className="md:col-span-2 md:flex md:justify-center">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] md:sr-only">
            Status
          </p>
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              domainStatusBadgeClassName(domain.status),
            ].join(" ")}
          >
            <span
              className={["h-1.5 w-1.5 rounded-full", domainStatusDotClassName(domain.status)].join(" ")}
              aria-hidden="true"
            />
            {formatDomainStatus(domain.status)}
          </span>
        </div>

        <div className="md:col-span-2 md:text-right">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)] md:sr-only">
            Actions
          </p>
          <div className="flex items-center gap-2 md:justify-end">
            {domain.status === "ACTIVE" && !domain.isPrimary ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSetPrimary}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-primary-container)]/30 disabled:opacity-50"
              >
                {busy ? "Updating…" : "Set primary"}
              </button>
            ) : null}
            {isSystemLocked ? (
              <span
                className="inline-flex items-center text-[var(--admin-on-surface-variant)]/50"
                title="System domain locked"
              >
                <Lock className="h-4 w-4" aria-label="System domain locked" />
              </span>
            ) : domain.type === "CUSTOM_DOMAIN" ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDisable}
                className="text-sm font-semibold text-[var(--admin-danger)] transition-opacity hover:underline motion-safe:active:opacity-70 disabled:opacity-50"
              >
                {busy ? "Removing…" : "Remove"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showDnsPanel ? <DomainDnsVerificationPanel domain={domain} /> : null}
    </div>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
