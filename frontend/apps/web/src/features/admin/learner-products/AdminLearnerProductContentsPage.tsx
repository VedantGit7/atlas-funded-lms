"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  ListChecks,
  RotateCcw,
  Save,
  ScrollText,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  fetchProductDetail,
  replaceProductContents,
  type PickerCandidate,
  type ProductDetail,
  type ProductTypeSlug,
} from "./learner-products-api";
import { itemKindLabel } from "./learner-products-shared";
import {
  ALLOWED_ITEM_KINDS,
  LearnerProductItemsBuilder,
  nextDraftKey,
  type DraftItem,
} from "./LearnerProductItemsBuilder";

type TypeMeta = { label: string; singleAssessment: boolean; emptyHint: string };

const TYPE_META: Record<ProductTypeSlug, TypeMeta> = {
  "mock-tests": {
    label: "Mock test",
    singleAssessment: true,
    emptyHint: "Choose the assessment this mock test wraps.",
  },
  "test-series": {
    label: "Test series",
    singleAssessment: false,
    emptyHint: "No items yet — add at least one mock test to build this series.",
  },
  bundles: {
    label: "Bundle",
    singleAssessment: false,
    emptyHint: "No items yet — add at least one course, mock test, or test series.",
  },
  "subscription-plans": {
    label: "Subscription plan",
    singleAssessment: false,
    emptyHint: "No items yet — add at least one product this plan grants access to.",
  },
};

const CATALOGUE_HREF = "/admin/manage/learner-products";
const MAX_ITEMS = 200;

const panelClassName = "admin-glass rounded-xl border border-[var(--admin-border)] p-6";
const panelHeadingClassName =
  "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

function toDraft(product: ProductDetail): DraftItem[] {
  return (product.items ?? []).map((item) => ({
    key: nextDraftKey(),
    kind: item.itemKind ?? (item.mockTestId ? "mock_test" : "assessment"),
    refId: item.refId ?? item.mockTestId ?? item.assessmentId ?? "",
    title: item.title ?? null,
  }));
}

/** Compares by reference and order — the two things a save actually changes. */
function sameOrder(a: DraftItem[], b: DraftItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return other !== undefined && other.kind === item.kind && other.refId === item.refId;
  });
}

/**
 * The contents of one product, on its own page.
 *
 * A page rather than the drawer this replaced: reordering twenty items is a
 * task an operator settles into, it deserves a URL they can return to, and the
 * composition and constraints only fit alongside the list at this width.
 *
 * That same longevity is why the save carries `expectedUpdatedAt` — a page open
 * for minutes is long enough for a colleague to save first, and this list is a
 * complete replacement, so a blind write would erase their work silently.
 */
export function AdminLearnerProductContentsPage({
  type,
  productId,
}: {
  type: ProductTypeSlug;
  productId: string;
}) {
  const meta = TYPE_META[type];
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [baseline, setBaseline] = useState<DraftItem[]>([]);
  const [assessment, setAssessment] = useState<PickerCandidate | null>(null);
  const [baselineAssessment, setBaselineAssessment] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    try {
      const response = await fetchProductDetail(type, productId);
      const draft = toDraft(response.data);
      setProduct(response.data);
      setItems(draft);
      setBaseline(draft);
      setAssessment(
        response.data.assessmentId
          ? {
              id: response.data.assessmentId,
              title: "Current assessment",
              subtitle: response.data.assessmentId,
            }
          : null,
      );
      setBaselineAssessment(response.data.assessmentId ?? null);
      setStale(false);
      setSaveError(null);
    } catch (caught) {
      if (caught instanceof ClientApiError && caught.status === 404) setNotFound(true);
      else {
        setLoadError(
          caught instanceof ClientApiError ? caught.message : "Could not load these contents.",
        );
      }
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [type, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = meta.singleAssessment
    ? (assessment?.id ?? null) !== baselineAssessment
    : !sameOrder(items, baseline);

  // A full page can be navigated away from mid-edit; the browser prompt is the
  // only guard that survives a tab close, which a router hook cannot see.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  const composition = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return ALLOWED_ITEM_KINDS[type].map((kind) => ({ kind, count: counts.get(kind) ?? 0 }));
  }, [items, type]);

  const unresolved = items.filter((item) => item.title === null).length;
  const canSave =
    dirty &&
    !saving &&
    (meta.singleAssessment ? assessment !== null : items.length > 0 && items.length <= MAX_ITEMS);

  async function save() {
    if (!canSave || !product) return;
    setSaving(true);
    setSaveError(null);
    try {
      await replaceProductContents(type, product.id, {
        expectedUpdatedAt: product.updatedAt,
        ...(meta.singleAssessment
          ? { assessmentId: assessment?.id ?? "" }
          : type === "test-series"
            ? { items: items.map((item) => ({ mockTestId: item.refId })) }
            : { items: items.map((item) => ({ itemKind: item.kind, refId: item.refId })) }),
      });
      setConfirming(false);
      router.push(`${CATALOGUE_HREF}/${type}/${product.id}`);
    } catch (caught) {
      setConfirming(false);
      // 409 is a colleague's save landing first, not bad input — the recovery is
      // to reload, so it gets its own affordance rather than a generic message.
      if (caught instanceof ClientApiError && caught.status === 409) {
        setStale(true);
        setSaveError(caught.message);
      } else {
        setSaveError(
          caught instanceof ClientApiError ? caught.message : "Could not save these contents.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <CentredPanel
        icon={<AlertTriangle className="h-7 w-7" aria-hidden="true" />}
        title="Product not found"
        body={`This ${meta.label.toLowerCase()} does not exist, or it has been deleted.`}
        action={
          <Link href={CATALOGUE_HREF} className={manageSecondaryButtonClassName}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the catalogue
          </Link>
        }
      />
    );
  }

  // A mock test wraps one assessment, so it has no contents list to order. The
  // screen says so rather than rendering an empty builder that cannot be right.
  if (meta.singleAssessment && !loading && product) {
    return (
      <div className="space-y-6">
        <Breadcrumbs type={type} product={product} />
        <CentredPanel
          icon={<ScrollText className="h-7 w-7" aria-hidden="true" />}
          title="A mock test has no contents list"
          body="A mock test wraps a single assessment. Change which assessment it points at from the product page."
          action={
            <Link
              href={`${CATALOGUE_HREF}/${type}/${product.id}`}
              className={managePrimaryButtonClassName}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to product
            </Link>
          }
        />
      </div>
    );
  }

  if (loading) return <ContentsSkeleton />;

  if (!product) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3"
      >
        <span className="text-sm font-semibold text-[var(--admin-danger)]">
          {loadError ?? "Could not load these contents."}
        </span>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className={manageSecondaryButtonClassName}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs type={type} product={product} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Edit contents
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            {product.title} · {meta.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${CATALOGUE_HREF}/${type}/${product.id}`}
            className={manageSecondaryButtonClassName}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to product
          </Link>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => {
              setItems(baseline);
              setSaveError(null);
            }}
            className={manageSecondaryButtonClassName}
          >
            Discard changes
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              setConfirming(true);
            }}
            className={managePrimaryButtonClassName}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save contents
          </button>
        </div>
      </header>

      <p aria-live="polite" className="sr-only">
        {dirty ? "You have unsaved changes." : "No unsaved changes."}
      </p>

      {stale ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-[var(--admin-on-surface)]">
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-[var(--admin-warning)]"
              aria-hidden="true"
            />
            {saveError}
          </span>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className={manageSecondaryButtonClassName}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reload contents
          </button>
        </div>
      ) : saveError ? (
        <p
          role="alert"
          className="rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 text-sm font-medium text-[var(--admin-danger)]"
        >
          {saveError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className={panelClassName}>
            <h2 className="text-base font-bold text-[var(--admin-on-surface)]">
              {meta.label} items{" "}
              <span className="tabular-nums text-[var(--admin-on-surface-variant)]">
                ({items.length})
              </span>
            </h2>
            <p className="mb-4 mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              The order here is the order learners receive.
            </p>

            <LearnerProductItemsBuilder
              type={type}
              items={items}
              onChange={setItems}
              singleSelection={assessment}
              onSingleSelectionChange={setAssessment}
              disabled={saving}
              emptyHint={meta.emptyHint}
            />
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <div className={panelClassName}>
            <h2 className={panelHeadingClassName}>
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Composition
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              {composition.map((entry) => (
                <li key={entry.kind} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--admin-on-surface-variant)]">
                    {itemKindLabel(entry.kind)}
                  </span>
                  <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-0.5 font-semibold tabular-nums text-[var(--admin-on-surface)]">
                    {entry.count}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-2 font-semibold">
                <span className="text-[var(--admin-on-surface)]">Total items</span>
                <span className="tabular-nums text-[var(--admin-primary)]">{items.length}</span>
              </li>
            </ul>

            {unresolved > 0 ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-xs text-[var(--admin-danger)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {unresolved} {unresolved === 1 ? "item points" : "items point"} at a deleted
                product. Saving with {unresolved === 1 ? "it" : "them"} still listed will be
                rejected — remove {unresolved === 1 ? "it" : "them"} first.
              </p>
            ) : null}
          </div>

          {/* The real rules the API enforces, not aspirational ones: an operator
              who reads a constraint here and hits a different error on save
              stops trusting the panel. */}
          <div className={panelClassName}>
            <h2 className={panelHeadingClassName}>
              <Info className="h-4 w-4" aria-hidden="true" />
              Rules
            </h2>
            <ul className="mt-4 list-disc space-y-1.5 pl-4 text-xs text-[var(--admin-on-surface-variant)]">
              <li>At least one item. To retire a product, archive it instead of emptying it.</li>
              <li>At most {MAX_ITEMS} items.</li>
              <li>
                May contain:{" "}
                {ALLOWED_ITEM_KINDS[type]
                  .map((kind) => itemKindLabel(kind).toLowerCase())
                  .join(", ")}
                .
              </li>
              <li>Every item must still exist in this school when you save.</li>
            </ul>
          </div>
        </aside>
      </div>

      {confirming ? (
        <SaveConfirmDialog
          productTitle={product.title}
          itemCount={items.length}
          published={product.status.toUpperCase() === "PUBLISHED"}
          busy={saving}
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            void save();
          }}
        />
      ) : null}
    </div>
  );
}

function Breadcrumbs({ type, product }: { type: ProductTypeSlug; product: ProductDetail }) {
  return (
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
        <li>
          <Link
            href={`${CATALOGUE_HREF}/${type}/${product.id}`}
            className="truncate transition-colors hover:text-[var(--admin-primary)]"
          >
            {product.title}
          </Link>
        </li>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <li aria-current="page" className="font-medium text-[var(--admin-on-surface)]">
          Contents
        </li>
      </ol>
    </nav>
  );
}

function CentredPanel({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="admin-glass flex flex-col items-center rounded-xl border border-dashed border-[var(--admin-outline)] px-6 py-16 text-center">
      <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
        {icon}
      </span>
      <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

function SaveConfirmDialog({
  productTitle,
  itemCount,
  published,
  busy,
  onCancel,
  onConfirm,
}: {
  productTitle: string;
  itemCount: number;
  published: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="contents-save-heading"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <h2 id="contents-save-heading" className="text-lg font-bold text-[var(--admin-on-surface)]">
          Save content changes
        </h2>
        <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
          <span className="font-semibold text-[var(--admin-on-surface)]">{productTitle}</span> will
          contain {itemCount} {itemCount === 1 ? "item" : "items"} in the order shown.
        </p>

        {/* Only claim immediate learner impact when the product is actually
            published — saying it of a draft is simply untrue. */}
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-xs text-[var(--admin-on-surface-variant)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {published
            ? "This product is published, so learners see the new contents and order immediately."
            : "This product is a draft, so nothing changes for learners until it is published."}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={manageSecondaryButtonClassName}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={managePrimaryButtonClassName}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContentsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="h-3 w-64 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-4 w-64 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((button) => (
            <div
              key={button}
              className="h-10 w-32 rounded-lg bg-[var(--admin-surface-high)] motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="admin-glass h-96 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse lg:col-span-2" />
        <div className="flex flex-col gap-6">
          <div className="admin-glass h-48 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse" />
          <div className="admin-glass h-40 rounded-xl border border-[var(--admin-border)] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
