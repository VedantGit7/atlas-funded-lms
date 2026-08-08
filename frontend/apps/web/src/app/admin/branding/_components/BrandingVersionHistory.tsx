"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, History, RotateCcw } from "lucide-react";
import type { z } from "zod";
import type { BrandingVersionViewSchema } from "@atlas/domain-branding/schemas/branding";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { ConfirmDialog } from "../../../../components/patterns/ConfirmDialog";
import {
  BrandingAnimatedCollapsible,
  cardClassName,
  cardHeaderClassName,
  sectionDescClassName,
  sectionTitleClassName,
  statusBannerClassName,
} from "./branding-admin-shared";

type BrandingVersion = z.infer<typeof BrandingVersionViewSchema>;

type BrandingVersionHistoryProps = {
  versions: BrandingVersion[];
};

type BrandingSnapshot = {
  public_name?: string | null;
  issuer_name?: string | null;
  logo_light_ref_id?: string | null;
  logo_dark_ref_id?: string | null;
  favicon_ref_id?: string | null;
  public_landing_copy_json?: Record<string, unknown> | null;
};

const UNKNOWN_AUTHOR = "Unknown";

export function BrandingVersionHistory({ versions }: BrandingVersionHistoryProps) {
  const router = useRouter();
  const [restoreTarget, setRestoreTarget] = useState<BrandingVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latestVersion = versions[0]?.version ?? null;

  async function restoreVersion() {
    if (!restoreTarget) return;

    setBusy(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const snapshot = restoreTarget.snapshot as BrandingSnapshot;
      await clientApi.put(
        "/api/v1/branding",
        {
          publicName: snapshot.public_name ?? null,
          issuerName: snapshot.issuer_name ?? null,
          publicLandingCopy: snapshot.public_landing_copy_json ?? null,
          logoLight: snapshot.logo_light_ref_id
            ? { storageRefId: snapshot.logo_light_ref_id, altText: snapshot.public_name ?? null }
            : null,
          logoDark: snapshot.logo_dark_ref_id
            ? { storageRefId: snapshot.logo_dark_ref_id, altText: snapshot.public_name ?? null }
            : null,
          favicon: snapshot.favicon_ref_id
            ? { storageRefId: snapshot.favicon_ref_id, altText: snapshot.public_name ?? null }
            : null,
        },
        "branding-restore",
      );
      setRestoreTarget(null);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClassName} aria-label="Branding version history">
      <div className={`${cardHeaderClassName} items-start`}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]">
            <History className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className={sectionTitleClassName}>Publishing history</h2>
            <p className={sectionDescClassName}>
              Review prior publishes and restore a snapshot into your draft.
            </p>
          </div>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No published versions yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Version
                </th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Date published
                </th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Published by
                </th>
                <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {versions.map((version) => {
                const isCurrent = version.version === latestVersion;
                const authorId = version.publishedByMembershipId?.slice(0, 8);
                return (
                  <tr
                    key={version.id}
                    className="motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--admin-surface-low)]/70"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-[var(--admin-on-surface)]">
                      v{version.version}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                      {new Date(version.publishedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {authorId ?? UNKNOWN_AUTHOR}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold",
                          isCurrent
                            ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        {isCurrent ? "Current" : "Superseded"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label={`View version ${version.version}`}
                          className="rounded-lg p-2 text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-primary-container)]/30"
                          onClick={() => {
                            setRestoreTarget(version);
                          }}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {!isCurrent ? (
                          <button
                            type="button"
                            aria-label={`Restore version ${version.version}`}
                            className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
                            onClick={() => {
                              setRestoreTarget(version);
                            }}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BrandingAnimatedCollapsible open={Boolean(message)} id="branding-history-status">
        {message ? (
          <p
            role="status"
            className={`mx-6 mb-4 ${statusBannerClassName} border-[var(--admin-success)]/30 bg-[var(--admin-success)]/10 text-[var(--admin-success)]`}
          >
            {message}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <BrandingAnimatedCollapsible open={Boolean(errorMessage)} id="branding-history-error">
        {errorMessage ? (
          <p
            role="alert"
            className={`mx-6 mb-4 ${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {errorMessage}
          </p>
        ) : null}
      </BrandingAnimatedCollapsible>

      <ConfirmDialog
        open={restoreTarget != null}
        title="Restore branding version?"
        description={`Copy version ${restoreTarget?.version ?? ""} into the current branding draft. You must publish separately to go live.`}
        confirmLabel="Restore draft"
        busy={busy}
        onConfirm={() => {
          void restoreVersion();
        }}
        onCancel={() => {
          setRestoreTarget(null);
        }}
      />
    </section>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return `${error.message} (${error.code})`;
  return "Request failed.";
}
