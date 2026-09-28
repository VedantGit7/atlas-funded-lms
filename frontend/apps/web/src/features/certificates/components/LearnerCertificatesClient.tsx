"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Loader2, Receipt, Search } from "lucide-react";
import { cn } from "@atlas/design-system";
import { clientApi, ClientApiError } from "../../../lib/client-api";
import { ProgressReveal } from "../../progress/components/ProgressReveal";
import { CertificateCard } from "./CertificateCard";
import type { ShareCertificate } from "./CertificateShareDialog";
import { DeferredCertificateShareDialog } from "./DeferredCertificateShareDialog";
import {
  type CertificateDto,
  type StatusFilter,
  buildListQuery,
  statusMeta,
  STATUS_FILTERS,
} from "../certificates-view";

const PAGE_LIMIT = 12;

type CertificateListResponse = {
  data: CertificateDto[];
  page: { nextCursor: string | null; hasMore: boolean };
};

type LearnerCertificatesClientProps = {
  initial: CertificateListResponse;
  origin: string;
  issuerName: string | null;
};

export function LearnerCertificatesClient({
  initial,
  origin,
  issuerName,
}: LearnerCertificatesClientProps) {
  const [items, setItems] = useState<CertificateDto[]>(initial.data);
  const [cursor, setCursor] = useState<string | null>(initial.page.nextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initial.page.hasMore);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareCertificate | null>(null);

  const verifyUrlFor = (certificate: CertificateDto) => `${origin}${certificate.verificationUrl}`;

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((certificate) => {
      const haystack = [
        certificate.templateName,
        certificate.credentialId,
        certificate.recipientLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, search]);

  async function changeStatus(next: StatusFilter) {
    if (next === status) return;
    setStatus(next);
    setSwitching(true);
    setError(null);
    try {
      const response = await clientApi.get<CertificateListResponse>(
        `/api/v1/certificates?${buildListQuery(next, null, PAGE_LIMIT)}`,
      );
      setItems(response.data);
      setCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? "We could not load those credentials. Please try again."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSwitching(false);
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await clientApi.get<CertificateListResponse>(
        `/api/v1/certificates?${buildListQuery(status, cursor, PAGE_LIMIT)}`,
      );
      setItems((current) => [...current, ...response.data]);
      setCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? "We could not load more credentials. Please try again."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const showLoadMore = hasMore && search.trim() === "" && !switching;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search by credential name"
            aria-label="Search credentials"
            className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div
          className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-muted p-1 sm:w-auto"
          role="tablist"
          aria-label="Filter credentials by status"
        >
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  void changeStatus(filter.value);
                }}
                className={cn(
                  "whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--destructive) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
            color: "color-mix(in srgb, var(--destructive) 82%, var(--foreground))",
          }}
        >
          {error}
        </p>
      ) : null}

      {switching ? (
        <CertificateSkeletonGrid />
      ) : visible.length === 0 ? (
        <EmptyState status={status} hasItems={items.length > 0} searching={search.trim() !== ""} />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
          {visible.map((certificate, index) => (
            <ProgressReveal key={certificate.id} delay={Math.min(index, 6) * 0.05}>
              <CertificateCard
                certificate={certificate}
                issuerName={issuerName}
                verifyUrl={verifyUrlFor(certificate)}
                index={index}
                onShare={() => {
                  setShare({
                    url: verifyUrlFor(certificate),
                    title: certificate.templateName,
                    recipient: certificate.recipientLabel ?? null,
                    issuerName,
                  });
                }}
              />
            </ProgressReveal>
          ))}
        </div>
      )}

      {showLoadMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
            className="group inline-flex items-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                Loading
              </>
            ) : (
              <>
                Load more credentials
                <ChevronDown
                  className="h-4 w-4 transition-transform group-hover:translate-y-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </div>
      ) : null}

      <DeferredCertificateShareDialog
        share={share}
        onClose={() => {
          setShare(null);
        }}
      />
    </div>
  );
}

function CertificateSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="h-4 w-14 animate-pulse rounded bg-muted" />
          </div>
          <div className="mb-6 space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="flex gap-2 border-t border-border pt-4">
            <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
            <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  status,
  hasItems,
  searching,
}: {
  status: StatusFilter;
  hasItems: boolean;
  searching: boolean;
}) {
  if (searching) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Search className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">
          No credentials match your search. Try a different name or credential ID.
        </p>
      </div>
    );
  }

  if (status !== "all" || hasItems) {
    const label =
      status === "all" ? "credentials" : `${statusMeta(status).label.toLowerCase()} credentials`;
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileText className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">You have no {label} to show.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-border bg-card px-6 py-20 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Receipt className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          You have not earned any certificates yet
        </h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Complete courses and assessments to receive official digital credentials you can verify
          and share.
        </p>
      </div>
      <Link
        href="/courses"
        className="inline-flex items-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Browse courses
      </Link>
    </div>
  );
}
