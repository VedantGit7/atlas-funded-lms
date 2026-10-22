"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";
import { RenderedAtProvider } from "./viewer-time";
import {
  type CustomFieldDetailPageProps,
  DetailSkeleton,
} from "./admin-custom-field-detail-shared";
import {
  CustomFieldActionsPanel,
  CustomFieldDetailFigures,
  CustomFieldDetailHeader,
  CustomFieldDetailLearners,
  CustomFieldUsage,
} from "./admin-custom-field-detail-sections";
import { useCustomFieldDetail } from "./use-custom-field-detail";

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminCustomFieldDetailPage(props: CustomFieldDetailPageProps) {
  return (
    <RenderedAtProvider renderedAt={props.initialDetail?.loadedAt ?? null}>
      <CustomFieldDetailReport {...props} />
    </RenderedAtProvider>
  );
}

function CustomFieldDetailReport(props: CustomFieldDetailPageProps) {
  const view = useCustomFieldDetail(props);
  const { detail, error, field, load, loading, selectedIds, summary } = view;

  if (loading && !detail && !error) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <DetailSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="fields" />
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex items-center justify-between gap-4 border-b border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden />
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load field detail.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] px-3 text-[13px] font-medium text-[var(--admin-danger)] transition-transform active:translate-y-px"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
          <div className="pointer-events-none p-4 opacity-50">
            <DetailSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!detail || !field || !summary) {
    return null;
  }

  const audienceCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6 pb-16">
      <CustomFieldReportTabs active="fields" />

      <Link
        href="/admin/reports/custom-field/fields"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All fields
      </Link>

      <CustomFieldDetailHeader view={{ ...view, detail, field, summary }} />

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3">
          <p className="text-sm font-medium text-[var(--admin-danger)]">{error}</p>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      <CustomFieldActionsPanel view={{ ...view, audienceCount }} />

      <CustomFieldDetailFigures view={{ ...view, detail, field, summary }} />

      <CustomFieldUsage view={{ ...view, detail, field, summary }} />

      <CustomFieldDetailLearners view={{ ...view, detail, field, summary }} />
    </div>
  );
}
