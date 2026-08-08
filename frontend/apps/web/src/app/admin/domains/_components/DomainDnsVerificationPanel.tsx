"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Network, RefreshCw } from "lucide-react";
import type { z } from "zod";
import type { TenantDomainViewSchema } from "@atlas/domain-branding/schemas/domains";
import { dnsPanelClassName, tableHeaderClassName } from "./domains-admin-shared";
import { outlineButtonClassName } from "../../branding/_components/branding-admin-shared";

type TenantDomain = z.infer<typeof TenantDomainViewSchema>;

type DomainDnsVerificationPanelProps = {
  domain: TenantDomain;
};

const POLL_INTERVAL_SECONDS = 180;

export function DomainDnsVerificationPanel({ domain }: DomainDnsVerificationPanelProps) {
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<"name" | "value" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(POLL_INTERVAL_SECONDS);

  useEffect(() => {
    if (secondsUntilRefresh <= 0) {
      router.refresh();
      setSecondsUntilRefresh(POLL_INTERVAL_SECONDS);
      return;
    }

    const timer = window.setTimeout(() => {
      setSecondsUntilRefresh((value) => value - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [router, secondsUntilRefresh]);

  async function copyToClipboard(field: "name" | "value", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch {
      // Clipboard may be unavailable in non-secure contexts.
    }
  }

  async function refreshStatus() {
    setRefreshing(true);
    router.refresh();
    setSecondsUntilRefresh(POLL_INTERVAL_SECONDS);
    window.setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }

  const minutes = Math.floor(secondsUntilRefresh / 60);
  const seconds = String(secondsUntilRefresh % 60).padStart(2, "0");

  return (
    <div className="px-6 pb-6 pt-1">
      <div className={dnsPanelClassName}>
        <div className="mb-4 flex items-center gap-2">
          <Network className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[var(--admin-primary)]">
            DNS verification required
          </h3>
        </div>
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          To activate this domain, add the following TXT record to your DNS provider. This lets us
          verify ownership before routing traffic.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--admin-border)]">
                <th className={`px-2 py-2 ${tableHeaderClassName}`}>Type</th>
                <th className={`px-2 py-2 ${tableHeaderClassName}`}>Name</th>
                <th className={`px-2 py-2 ${tableHeaderClassName}`}>Value</th>
                <th className={`px-2 py-2 text-right ${tableHeaderClassName}`}>Action</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px] text-[var(--admin-on-surface)]">
              <tr className="border-b border-[var(--admin-border)]/40 last:border-0">
                <td className="px-2 py-4">TXT</td>
                <td className="break-all px-2 py-4">{domain.verificationTxtName}</td>
                <td className="break-all px-2 py-4">{domain.verificationTxtValue}</td>
                <td className="px-2 py-4">
                  <div className="flex justify-end gap-1">
                    <CopyDnsButton
                      label="Copy record name"
                      copied={copiedField === "name"}
                      onClick={() => {
                        if (domain.verificationTxtName) {
                          void copyToClipboard("name", domain.verificationTxtName);
                        }
                      }}
                    />
                    <CopyDnsButton
                      label="Copy record value"
                      copied={copiedField === "value"}
                      onClick={() => {
                        if (domain.verificationTxtValue) {
                          void copyToClipboard("value", domain.verificationTxtValue);
                        }
                      }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {domain.failureReason ? (
          <p className="mt-4 text-sm text-[var(--admin-danger)]">{domain.failureReason}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
            Polling DNS status. Next check in {minutes}:{seconds}
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              void refreshStatus();
            }}
            className={`${outlineButtonClassName} inline-flex items-center gap-2`}
          >
            <RefreshCw
              className={["h-4 w-4", refreshing ? "motion-safe:animate-spin" : ""].join(" ")}
              aria-hidden="true"
            />
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyDnsButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-lg p-2 text-[var(--admin-primary)] transition-all hover:bg-[var(--admin-primary)]/10 motion-safe:active:scale-95"
    >
      {copied ? (
        <Check className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Copy className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
