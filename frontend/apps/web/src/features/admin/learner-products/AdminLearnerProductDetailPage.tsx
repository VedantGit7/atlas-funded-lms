"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Copy,
  FileStack,
  Info,
  ListPlus,
  PackageX,
  RotateCcw,
  Send,
  UserPlus,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  manageSecondaryButtonClassName,
  managePrimaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  duplicateProduct,
  fetchProductDetail,
  fetchProductEnrollments,
  enrollInProduct,
  replaceProductContents,
  updateLearnerProductStatuses,
  type LearnerProductKind,
  type ProductDetail,
  type ProductEnrollmentListItem,
  type ProductTypeSlug,
} from "./learner-products-api";
import {
  catalogueNoteClassName,
  catalogueSlugChipClassName,
  statusChipClassName,
  statusLabel,
} from "./learner-products-shared";
import {
  ContentsPanel,
  DescriptionPanel,
  DetailSummaryBand,
  EnrolmentsPanel,
  LinkedAssessmentPanel,
} from "./LearnerProductDetailPanels";
import { LearnerProductEnrolDrawer, type EnrolSubmission } from "./LearnerProductEnrolDrawer";
import { LearnerProductAssessmentDialog } from "./LearnerProductAssessmentDialog";

type TypeMeta = {
  label: string;
  /** Wire value the batch status endpoint dispatches on. */
  kind: LearnerProductKind;
  contentsNoun: string;
  emptyContents: string;
  /** Mock tests wrap a single assessment, so they have no contents list at all. */
  hasContents: boolean;
};

const TYPE_META: Record<ProductTypeSlug, TypeMeta> = {
  "mock-tests": {
    label: "Mock test",
    kind: "mock_test",
    contentsNoun: "items",
    emptyContents: "A mock test wraps one assessment and has no contents list.",
    hasContents: false,
  },
  "test-series": {
    label: "Test series",
    kind: "test_series",
    contentsNoun: "tests",
    emptyContents: "This series has no tests yet.",
    hasContents: true,
  },
  bundles: {
    label: "Bundle",
    kind: "bundle",
    contentsNoun: "items",
    emptyContents: "This bundle has no items yet.",
    hasContents: true,
  },
  "subscription-plans": {
    label: "Subscription plan",
    kind: "subscription_plan",
    contentsNoun: "items",
    emptyContents: "This plan has no items yet.",
    hasContents: true,
  },
};

const CATALOGUE_HREF = "/admin/manage/learner-products";

/**
 * One learner product, with its contents, publish state and enrolments.
 *
 * The four `get*` services existed from the first commit of this module and no
 * route exposed them, so the catalogue could list products and enrol learners
 * into them but never open one — meaning nobody could see what a bundle
 * actually contained before putting a learner into it.
 */
export function AdminLearnerProductDetailPage({
  type,
  productId,
}: {
  type: ProductTypeSlug;
  productId: string;
}) {
  const meta = TYPE_META[type];

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [enrollments, setEnrollments] = useState<ProductEnrollmentListItem[]>([]);
  const [enrollmentTotal, setEnrollmentTotal] = useState(0);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  const [duplicating, setDuplicating] = useState(false);

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const router = useRouter();

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await fetchProductDetail(type, productId);
      setProduct(response.data);
    } catch (caught) {
      if (caught instanceof ClientApiError && caught.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caught instanceof ClientApiError ? caught.message : "Could not load this product.",
        );
      }
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [type, productId]);

  const loadEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true);
    setEnrollmentsError(null);
    try {
      const response = await fetchProductEnrollments(type, productId);
      setEnrollments(response.data.items);
      setEnrollmentTotal(response.data.pageInfo.totalCount);
    } catch (caught) {
      setEnrollments([]);
      setEnrollmentTotal(0);
      // A roster the operator is not permitted to read must not read as "nobody
      // is enrolled" — that is the answer to a different question.
      setEnrollmentsError(
        caught instanceof ClientApiError && caught.status === 403
          ? "You do not have permission to view enrolments."
          : "Could not load enrolments.",
      );
    } finally {
      setEnrollmentsLoading(false);
    }
  }, [type, productId]);

  useEffect(() => {
    void loadProduct();
    void loadEnrollments();
  }, [loadProduct, loadEnrollments]);

  async function changeStatus(nextStatus: string) {
    if (!product) return;
    setStatusBusy(true);
    setNotice(null);
    setError(null);
    try {
      const response = await updateLearnerProductStatuses(meta.kind, [product.id], nextStatus);
      if (response.data.updated.length === 0) {
        setError("This product is no longer available.");
      } else {
        setNotice(`Moved to ${statusLabel(nextStatus).toLowerCase()}.`);
      }
      await loadProduct();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not update this product.",
      );
    } finally {
      setStatusBusy(false);
    }
  }

  async function submitEnrolment(submission: EnrolSubmission) {
    if (!product) return;
    setEnrolling(true);
    setEnrolError(null);
    try {
      await enrollInProduct(type, product.id, {
        membershipId: submission.membershipId,
        enrolledType: submission.enrolledType,
        ...(submission.expiresAt ? { expiresAt: submission.expiresAt } : {}),
      });
      setNotice("Learner enrolled.");
      setDrawerOpen(false);
      await loadEnrollments();
    } catch (caught) {
      setEnrolError(
        caught instanceof ClientApiError ? caught.message : "Could not enrol that learner.",
      );
    } finally {
      setEnrolling(false);
    }
  }

  /**
   * A mock test's assessment is its entire contents, and the contents page
   * deliberately sends operators here rather than rendering a one-row list.
   * This is the only path to `PUT /mock-tests/:id/contents`.
   */
  async function saveAssessment(assessmentId: string) {
    if (!product) return;
    setSavingAssessment(true);
    setAssessmentError(null);
    try {
      await replaceProductContents(type, product.id, {
        assessmentId,
        expectedUpdatedAt: product.updatedAt,
      });
      setAssessmentOpen(false);
      setNotice("Assessment updated.");
      await loadProduct();
    } catch (caught) {
      setAssessmentError(
        caught instanceof ClientApiError
          ? caught.status === 409
            ? "This product changed since you opened it. Close this and reload the page."
            : caught.message
          : "Could not change the assessment.",
      );
    } finally {
      setSavingAssessment(false);
    }
  }

  async function duplicate() {
    if (!product) return;
    setDuplicating(true);
    setError(null);
    try {
      const response = await duplicateProduct(type, product.id);
      // Land on the copy: the operator's next action is almost always to edit
      // it, and leaving them on the original invites editing the wrong one.
      router.push(`/admin/manage/learner-products/${type}/${response.data.id}`);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not duplicate this product.",
      );
      setDuplicating(false);
    }
  }

  if (notFound) {
    return (
      <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
          <PackageX className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Product not found</h2>
        <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
          This {meta.label.toLowerCase()} does not exist, or it has been deleted.
        </p>
        <Link href={CATALOGUE_HREF} className={`${manageSecondaryButtonClassName} mt-6`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the catalogue
        </Link>
      </div>
    );
  }

  if (loading) return <DetailSkeleton />;

  if (!product) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
        >
          <span className="text-sm font-semibold text-[var(--admin-danger)]">
            {error ?? "Could not load this product."}
          </span>
          <button
            type="button"
            onClick={() => {
              void loadProduct();
            }}
            className={manageSecondaryButtonClassName}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const status = product.status.toUpperCase();
  const archived = status === "ARCHIVED";
  const items = product.items ?? [];
  const contentsLabel = meta.hasContents ? String(items.length) : "—";
  const contentsHint = meta.hasContents
    ? `${String(items.length)} ${meta.contentsNoun} in learner order`
    : "A mock test wraps one assessment";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          <li>
            <Link
              href={CATALOGUE_HREF}
              className="transition-colors hover:text-[var(--admin-primary)]"
            >
              Learner Products
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li aria-current="page" className="truncate font-medium text-[var(--admin-on-surface)]">
            {product.title}
          </li>
        </ol>
      </nav>

      {archived ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3 text-sm font-medium text-[var(--admin-on-surface-variant)]">
          <Archive className="h-4 w-4" aria-hidden="true" />
          This product is archived and is not offered to learners.
        </p>
      ) : null}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              {product.title}
            </h1>
            <span className={catalogueSlugChipClassName}>{product.slug}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[color-mix(in_srgb,var(--admin-primary)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-primary)]">
              {meta.label}
            </span>
            <span className={statusChipClassName(product.status)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              {statusLabel(product.status)}
            </span>
            {product.billingInterval ? (
              <span className="inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                {product.billingInterval}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={CATALOGUE_HREF} className={manageSecondaryButtonClassName}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Catalogue
          </Link>

          <Link
            href={`${CATALOGUE_HREF}/${type}/${product.id}/contents`}
            className={manageSecondaryButtonClassName}
          >
            <ListPlus className="h-4 w-4" aria-hidden="true" />
            Edit contents
          </Link>

          <button
            type="button"
            disabled={duplicating || statusBusy}
            className={manageSecondaryButtonClassName}
            onClick={() => {
              void duplicate();
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {duplicating ? "Duplicating…" : "Duplicate"}
          </button>

          {status !== "PUBLISHED" ? (
            <button
              type="button"
              disabled={statusBusy}
              className={manageSecondaryButtonClassName}
              onClick={() => {
                void changeStatus("PUBLISHED");
              }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Publish
            </button>
          ) : null}

          {status !== "DRAFT" ? (
            <button
              type="button"
              disabled={statusBusy}
              className={manageSecondaryButtonClassName}
              onClick={() => {
                void changeStatus("DRAFT");
              }}
            >
              <FileStack className="h-4 w-4" aria-hidden="true" />
              Move to draft
            </button>
          ) : null}

          {status !== "ARCHIVED" ? (
            <button
              type="button"
              disabled={statusBusy}
              className={manageSecondaryButtonClassName}
              onClick={() => {
                void changeStatus("ARCHIVED");
              }}
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive
            </button>
          ) : null}

          {!archived ? (
            <button
              type="button"
              className={managePrimaryButtonClassName}
              onClick={() => {
                setEnrolError(null);
                setDrawerOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Enrol a learner
            </button>
          ) : null}
        </div>
      </header>

      <div className={catalogueNoteClassName}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Enrolling here places a learner into this product directly. No payment is taken and no
          invoice is created.
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {notice ?? error ?? ""}
      </p>
      {notice ? (
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <DetailSummaryBand
        contentsLabel={contentsLabel}
        contentsHint={contentsHint}
        status={product.status}
        createdAt={product.createdAt}
        updatedAt={product.updatedAt}
        productId={product.id}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <DescriptionPanel description={product.description} />
          {meta.hasContents ? (
            <ContentsPanel items={items} emptyMessage={meta.emptyContents} />
          ) : product.assessmentId ? (
            <LinkedAssessmentPanel
              assessmentId={product.assessmentId}
              onChange={
                archived
                  ? undefined
                  : () => {
                      setAssessmentError(null);
                      setAssessmentOpen(true);
                    }
              }
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <EnrolmentsPanel
            enrollments={enrollments}
            totalCount={enrollmentTotal}
            loading={enrollmentsLoading}
            error={enrollmentsError}
            canEnrol={!archived}
            rosterHref={`${CATALOGUE_HREF}/${type}/${product.id}/enrollments`}
            onEnrol={() => {
              setEnrolError(null);
              setDrawerOpen(true);
            }}
          />
        </div>
      </div>

      <LearnerProductAssessmentDialog
        open={assessmentOpen}
        productTitle={product.title}
        currentAssessmentId={product.assessmentId ?? null}
        busy={savingAssessment}
        error={assessmentError}
        onSubmit={(assessmentId) => {
          void saveAssessment(assessmentId);
        }}
        onCancel={() => {
          setAssessmentOpen(false);
          setAssessmentError(null);
        }}
      />

      <LearnerProductEnrolDrawer
        open={drawerOpen}
        productTitle={product.title}
        productKindLabel={meta.label}
        productStatusLabel={statusLabel(product.status)}
        busy={enrolling}
        error={enrolError}
        onSubmit={(submission) => {
          void submitEnrolment(submission);
        }}
        onCancel={() => {
          setDrawerOpen(false);
          setEnrolError(null);
        }}
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-3 w-56 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-7 w-72 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-5 w-40 rounded-full bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((button) => (
            <div
              key={button}
              className="h-10 w-28 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="admin-glass grid gap-6 rounded-xl border border-[var(--admin-border)] p-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((cell) => (
          <div key={cell} className="space-y-2">
            <div className="h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="h-7 w-24 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="admin-glass h-40 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse" />
          <div className="admin-glass h-80 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse" />
        </div>
        <div className="admin-glass h-72 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
