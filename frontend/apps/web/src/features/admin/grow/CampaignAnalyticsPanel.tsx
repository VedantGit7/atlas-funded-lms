"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { managePageDescClassName, managePageTitleClassName } from "../manage/manage-ui-shared";
import {
  CAMPAIGNS_HREF,
  MARKETING_HREF,
  campaignGoalLabel,
  campaignHref,
  campaignChannelLabel,
  campaignStatusLabel,
  formatCampaignCount,
  formatCampaignDate,
  type CampaignAnalyticsDto,
  type CampaignChannel,
} from "./campaigns-shared";
import { csvEscape } from "@/lib/export/csv";

type AnalyticsResponse = { data: CampaignAnalyticsDto };

function channelIcon(channel: CampaignChannel) {
  if (channel === "email") return Mail;
  if (channel === "push") return Bell;
  if (channel === "announcement") return Megaphone;
  return MessageCircle;
}

function StatusPill({ status }: { status: CampaignAnalyticsDto["status"] }) {
  const tone = status === "SENT" ? "success" : status === "SCHEDULED" ? "warning" : "neutral";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {campaignStatusLabel(status)}
    </span>
  );
}

function downloadChannelCsv(analytics: CampaignAnalyticsDto) {
  const header = [
    "channel",
    "title",
    "status",
    "recipient_count",
    "delivered_count",
    "failed_count",
    "scheduled_at",
    "sent_at",
    "editor_href",
  ];
  const lines = [
    header.join(","),
    ...analytics.channels.map((row) => {
      const cells = [
        row.channel,
        row.title,
        row.status ?? "",
        String(row.recipientCount),
        row.deliveredCount == null ? "" : String(row.deliveredCount),
        row.failedCount == null ? "" : String(row.failedCount),
        row.scheduledAt ?? "",
        row.sentAt ?? "",
        row.href,
      ];
      // csvEscape also neutralises a leading =, +, -, @ so a learner-supplied
      // value cannot execute as a formula in the admin's spreadsheet (M1).
      return cells.map((cell) => csvEscape(cell)).join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `campaign-analytics-${analytics.campaignId.slice(0, 8)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type CampaignAnalyticsPanelProps = {
  campaignId: string;
};

export function CampaignAnalyticsPanel({ campaignId }: CampaignAnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<CampaignAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<AnalyticsResponse>(
        `/api/v1/marketing/campaigns/${campaignId}/analytics`,
      );
      setAnalytics(response.data);
    } catch (caught) {
      setAnalytics(null);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load campaign analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin text-[var(--admin-primary)]"
          aria-label="Loading analytics"
        />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-4">
        <Link href={CAMPAIGNS_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to campaigns
        </Link>
        <p className="text-[14px] text-[var(--admin-on-surface-variant)]">
          Analytics are not available for this campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      >
        <Link
          href={MARKETING_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Marketing
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={CAMPAIGNS_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Campaigns
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">Analytics</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href={campaignHref(campaignId)}
            prefetch={false}
            className={`${generalSettingsBackLinkClassName} mb-3 inline-flex`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to builder
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={managePageTitleClassName}>{analytics.title}</h1>
            <StatusPill status={analytics.status} />
          </div>
          <p className={`${managePageDescClassName} mt-1 max-w-2xl`}>
            Goal: {campaignGoalLabel(analytics.goal)}
            {analytics.launchedAt ? ` · Launched ${formatCampaignDate(analytics.launchedAt)}` : ""}
            {analytics.audienceLabel ? ` · ${analytics.audienceLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={analytics.channels.length === 0}
            onClick={() => {
              downloadChannelCsv(analytics);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={CAMPAIGNS_HREF}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
          >
            Campaign list
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Total reach
          </span>
          <p className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCampaignCount(analytics.totalReach)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            Recipients targeted or delivered across linked channel sends.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Touchpoints
          </span>
          <p className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCampaignCount(analytics.touchpointCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            Steps in the coordinated campaign sequence.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Channel rows
          </span>
          <p className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCampaignCount(analytics.channels.length)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            Linked sends you can open in channel editors.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-5 py-4">
        <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
          {analytics.note}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] px-6 py-4">
          <h2 className="text-[15px] font-bold text-[var(--admin-on-surface)]">
            Touchpoint delivery
          </h2>
          <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
            Recipient counts come from linked channel campaigns when available.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-[var(--admin-surface-low)]">
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Touchpoint
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Channel
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Recipients
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Sent
                </th>
                <th className="px-6 py-3">
                  <span className="sr-only">Open editor</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {analytics.channels.length === 0 ? (
                <tr>
                  <td
                    className="px-6 py-12 text-center text-[14px] text-[var(--admin-on-surface-variant)]"
                    colSpan={6}
                  >
                    No touchpoint rows yet. Launch the campaign to create linked channel sends.
                  </td>
                </tr>
              ) : (
                analytics.channels.map((row, index) => {
                  const Icon = channelIcon(row.channel);
                  return (
                    <tr
                      key={`${row.channel}-${String(index)}`}
                      className="hover:bg-[var(--admin-surface-low)]"
                    >
                      <td className="px-6 py-4">
                        <p className="text-[14px] font-bold text-[var(--admin-on-surface)]">
                          {row.title}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {campaignChannelLabel(row.channel)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {row.status ? (
                          <StatusPill status={row.status} />
                        ) : (
                          <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                            Planned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-bold text-[var(--admin-on-surface)]">
                          {formatCampaignCount(row.recipientCount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                          {row.sentAt
                            ? formatCampaignDate(row.sentAt)
                            : row.scheduledAt
                              ? `Scheduled ${formatCampaignDate(row.scheduledAt)}`
                              : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={row.href}
                          prefetch={false}
                          className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-primary)] hover:underline"
                        >
                          Open
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
