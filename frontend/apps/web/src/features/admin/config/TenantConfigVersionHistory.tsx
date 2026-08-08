"use client";

import { History } from "lucide-react";
import type { TenantConfigVersionView } from "@atlas/domain-config/schemas/tenant-config";
import {
  cardClassName,
  cardHeaderClassName,
  sectionDescClassName,
  sectionTitleClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";
import { tableHeaderClassName } from "./config-admin-shared";

type TenantConfigVersionHistoryProps = {
  versions: TenantConfigVersionView[];
};

const UNKNOWN_PUBLISHER = "Unknown";

export function TenantConfigVersionHistory({ versions }: TenantConfigVersionHistoryProps) {
  const latestVersion = versions.find((version) => version.isCurrent)?.version ?? versions[0]?.version;

  return (
    <section className="space-y-4" aria-label="Configuration version history">
      <h2 className={sectionTitleClassName}>Version history</h2>

      <div className={cardClassName}>
        <div className={`${cardHeaderClassName} items-start`}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]">
              <History className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className={sectionTitleClassName}>Publishing history</h3>
              <p className={sectionDescClassName}>
                Review prior publishes. Restore flows are not available yet in this console.
              </p>
            </div>
          </div>
        </div>

        {versions.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
            No published configuration versions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">Published tenant configuration versions</caption>
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50">
                  <th className={`px-6 py-3.5 ${tableHeaderClassName}`}>Version</th>
                  <th className={`px-6 py-3.5 ${tableHeaderClassName}`}>Status</th>
                  <th className={`px-6 py-3.5 ${tableHeaderClassName}`}>Published at</th>
                  <th className={`px-6 py-3.5 ${tableHeaderClassName}`}>Publisher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {versions.map((version) => {
                  const isCurrent = version.version === latestVersion && version.isCurrent;
                  return (
                    <tr
                      key={version.id}
                      className="motion-safe:transition-colors motion-safe:duration-150 hover:bg-[var(--admin-surface-low)]/70"
                    >
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                        v{version.version}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                            isCurrent
                              ? "bg-[var(--admin-success)]/15 text-[var(--admin-success)]"
                              : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                          ].join(" ")}
                        >
                          {isCurrent ? (
                            <>
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]"
                                aria-hidden="true"
                              />
                              Current
                            </>
                          ) : (
                            "Historical"
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                        {new Date(version.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {version.createdByMembershipId?.slice(0, 8) ?? UNKNOWN_PUBLISHER}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
