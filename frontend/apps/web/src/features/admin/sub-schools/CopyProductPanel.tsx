"use client";

import Link from "next/link";
import { ChevronLeft, Layers, Database, FileText } from "lucide-react";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import type { SubSchoolRow } from "./SubSchoolsListPanel";
import { subSchoolCopyFlowHref, type CopyProductKind } from "./copy-product-flows";
import { subSchoolDetailHref } from "./sub-schools-shared";

export type CopyProductHistoryRow = {
  id: string;
  source: string;
  type: string;
  destination: string;
  date: string;
  status: "Queued" | "In progress" | "Completed" | "Failed";
};

export type ProductCopyJobDto = {
  id: string;
  productType: "COURSE" | "MOCK_TEST" | "TEST_SERIES";
  sourceProductTitle: string;
  destinationProductName: string;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  createdAt: string;
  errorMessage: string | null;
};

export function mapProductCopyJobToHistoryRow(job: ProductCopyJobDto): CopyProductHistoryRow {
  const typeLabel =
    job.productType === "COURSE"
      ? "Course"
      : job.productType === "MOCK_TEST"
        ? "Mock-Test"
        : "Test Series";

  const status: CopyProductHistoryRow["status"] =
    job.status === "SUCCEEDED"
      ? "Completed"
      : job.status === "RUNNING"
        ? "In progress"
        : job.status === "QUEUED"
          ? "Queued"
          : "Failed";

  return {
    id: job.id,
    source: job.sourceProductTitle,
    type: typeLabel,
    destination: job.destinationProductName,
    date: new Date(job.createdAt).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    status,
  };
}

type CopyProductPanelProps = {
  subSchool: SubSchoolRow;
  history?: CopyProductHistoryRow[];
};

const COPY_ACTIONS: Array<{
  id: CopyProductKind;
  title: string;
  subtitle: string;
  buttonLabel: string;
  Icon: typeof FileText;
}> = [
  {
    id: "course",
    title: "Copy Course",
    subtitle: "Start copying a course",
    buttonLabel: "Copy course",
    Icon: FileText,
  },
  {
    id: "mock-test",
    title: "Copy Mock-Test",
    subtitle: "Start copying a mock-test",
    buttonLabel: "Copy mock-test",
    Icon: Database,
  },
  {
    id: "test-series",
    title: "Copy Test Series",
    subtitle: "Start copying a test series",
    buttonLabel: "Copy test series",
    Icon: Layers,
  },
];

const HISTORY_COLUMNS = ["Source", "Type", "Destination", "Date", "Status"] as const;

export function CopyProductPanel({ subSchool, history = [] }: CopyProductPanelProps) {
  const detailHref = subSchoolDetailHref(subSchool.id);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <Link href={detailHref} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {subSchool.name}
      </Link>

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]"
      >
        <Link
          href={detailHref}
          prefetch={false}
          className="text-[var(--admin-primary)] transition-colors hover:opacity-80"
        >
          {subSchool.name}
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">
          /
        </span>
        <span className="text-[var(--admin-on-surface)]">Copy Product</span>
      </nav>

      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
          Copy Product
        </h1>
        <p className="max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
          Create a copy of an existing product and view the completion status of your copied
          products
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COPY_ACTIONS.map((action) => {
          const Icon = action.Icon;
          return (
            <article
              key={action.id}
              className="flex flex-col rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm"
            >
              <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
              <h2 className="text-base font-bold text-[var(--admin-on-surface)]">{action.title}</h2>
              <p className="mt-1 flex-1 text-sm text-[var(--admin-on-surface-variant)]">
                {action.subtitle}
              </p>
              <Link
                href={subSchoolCopyFlowHref(subSchool.id, action.id)}
                prefetch={false}
                className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] motion-safe:active:scale-[0.99]"
              >
                {action.buttonLabel}
              </Link>
            </article>
          );
        })}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Copy Product History</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  {HISTORY_COLUMNS.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td
                      colSpan={HISTORY_COLUMNS.length}
                      className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      No copy history yet. Start by copying a course, mock-test, or test series.
                    </td>
                  </tr>
                ) : (
                  history.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--admin-border)] last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                        {row.source}
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                        {row.type}
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                        {row.destination}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--admin-on-surface-variant)]">
                        {row.date}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: CopyProductHistoryRow["status"] }) {
  const className =
    status === "Completed"
      ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"
      : status === "Failed"
        ? "bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]"
        : status === "In progress"
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] text-[var(--admin-primary)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";

  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}
