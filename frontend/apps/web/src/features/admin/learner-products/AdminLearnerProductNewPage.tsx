"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileStack,
  Info,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  checkProductSlug,
  createProduct,
  slugifyTitle,
  type LearnerProductKind,
  type PickerCandidate,
  type ProductDetail,
  type ProductTypeSlug,
} from "./learner-products-api";
import {
  catalogueSlugChipClassName,
  statusChipClassName,
  statusLabel,
} from "./learner-products-shared";
import { LearnerProductItemsBuilder, type DraftItem } from "./LearnerProductItemsBuilder";

type TypeMeta = {
  label: string;
  kind: LearnerProductKind;
  /** Mock tests wrap one assessment instead of holding a list. */
  singleAssessment: boolean;
  hasBillingInterval: boolean;
  lead: string;
  contentsHint: string;
};

const TYPE_META: Record<ProductTypeSlug, TypeMeta> = {
  "mock-tests": {
    label: "Mock test",
    kind: "mock_test",
    singleAssessment: true,
    hasBillingInterval: false,
    lead: "Wrap an existing assessment as a product learners can be enrolled into.",
    contentsHint: "Choose the assessment this mock test wraps.",
  },
  "test-series": {
    label: "Test series",
    kind: "test_series",
    singleAssessment: false,
    hasBillingInterval: false,
    lead: "Group mock tests into a series learners work through in order.",
    contentsHint: "Add at least one mock test.",
  },
  bundles: {
    label: "Bundle",
    kind: "bundle",
    singleAssessment: false,
    hasBillingInterval: false,
    lead: "Group courses, mock tests and series into one product.",
    contentsHint: "Add at least one item.",
  },
  "subscription-plans": {
    label: "Subscription plan",
    kind: "subscription_plan",
    singleAssessment: false,
    hasBillingInterval: true,
    lead: "Bundle recurring access to several products.",
    contentsHint: "Add at least one item.",
  },
};

const TYPE_ORDER: ProductTypeSlug[] = [
  "mock-tests",
  "test-series",
  "bundles",
  "subscription-plans",
];

/**
 * Draft and Published only.
 *
 * The API accepts ARCHIVED here, but creating something already retired has no
 * meaning — archive is a thing you do to a product that has been in
 * circulation, not a state to be born in.
 */
const STATUS_CHOICES = [
  {
    value: "DRAFT",
    label: "Draft",
    hint: "Not offered to learners. Admins can still enrol into it.",
  },
  { value: "PUBLISHED", label: "Published", hint: "Offered to learners straight away." },
] as const;

const BILLING_INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
] as const;

const CATALOGUE_HREF = "/admin/manage/learner-products";

const panelClassName = "admin-glass rounded-xl border border-[var(--admin-border)] p-6";
const legendClassName = "text-base font-bold text-[var(--admin-on-surface)]";
const fieldLabelClassName = "block text-sm font-semibold text-[var(--admin-on-surface)]";
const fieldInputClassName =
  "mt-2 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25";

/**
 * Create a learner product.
 *
 * The four `POST` endpoints existed from the module's first commit and had no
 * caller, so a tenant's catalogue could only be filled by a direct database
 * write. The form is one screen per kind rather than a wizard: every field here
 * is required to make a valid product, and paging them would hide the slug
 * conflict — the one thing that fails late — behind a Next button.
 */
export function AdminLearnerProductNewPage({ type }: { type: ProductTypeSlug }) {
  const meta = TYPE_META[type];
  const router = useRouter();

  const titleFieldId = useId();
  const slugFieldId = useId();
  const descriptionFieldId = useId();
  const statusFieldId = useId();
  const billingFieldId = useId();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("DRAFT");
  const [statusOpen, setStatusOpen] = useState(false);
  const [billingInterval, setBillingInterval] = useState<string>("monthly");
  const [billingOpen, setBillingOpen] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [assessment, setAssessment] = useState<PickerCandidate | null>(null);

  const [slugState, setSlugState] = useState<{
    checking: boolean;
    available: boolean | null;
    conflict: { id: string; title: string } | null;
  }>({ checking: false, available: null, conflict: null });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ProductDetail | null>(null);

  // The slug follows the title until the operator takes it over; after that it
  // is theirs, because silently rewriting an edited slug loses their work.
  useEffect(() => {
    if (slugEdited) return;
    setSlug(slugifyTitle(title));
  }, [title, slugEdited]);

  useEffect(() => {
    const candidate = slug.trim();
    if (!candidate) {
      setSlugState({ checking: false, available: null, conflict: null });
      return;
    }

    let cancelled = false;
    setSlugState((previous) => ({ ...previous, checking: true }));
    const timer = setTimeout(() => {
      checkProductSlug(meta.kind, candidate)
        .then((response) => {
          if (cancelled) return;
          setSlugState({
            checking: false,
            available: response.data.available,
            conflict: response.data.conflict,
          });
        })
        .catch(() => {
          // A failed check must not read as "available" — leave it unknown and
          // let the server be the authority on submit.
          if (!cancelled) setSlugState({ checking: false, available: null, conflict: null });
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, meta.kind]);

  const contentsReady = meta.singleAssessment ? assessment !== null : items.length > 0;
  const canSubmit =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    contentsReady &&
    slugState.available !== false &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await createProduct(type, {
        slug: slug.trim(),
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        status,
        ...(meta.hasBillingInterval ? { billingInterval } : {}),
        ...(meta.singleAssessment
          ? { assessmentId: assessment?.id ?? "" }
          : {
              items: items.map((item, index) =>
                type === "test-series"
                  ? { mockTestId: item.refId, position: index }
                  : { itemKind: item.kind, refId: item.refId, position: index },
              ),
            }),
      });
      setCreated(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not create this product.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForAnother() {
    setCreated(null);
    setTitle("");
    setSlug("");
    setSlugEdited(false);
    setDescription("");
    setStatus("DRAFT");
    setItems([]);
    setAssessment(null);
    setSlugState({ checking: false, available: null, conflict: null });
    setError(null);
  }

  const activeStatus = STATUS_CHOICES.find((entry) => entry.value === status);
  const activeBilling = BILLING_INTERVALS.find((entry) => entry.value === billingInterval);

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
          <li aria-current="page" className="font-medium text-[var(--admin-on-surface)]">
            New {meta.label.toLowerCase()}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            New {meta.label.toLowerCase()}
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{meta.lead}</p>
        </div>
        <Link href={CATALOGUE_HREF} className={manageSecondaryButtonClassName}>
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </Link>
      </header>

      {/* Switching kind is a navigation, not form state: each kind is a
          different product with different required fields, and pretending
          otherwise would carry a half-filled bundle into a mock test. */}
      <div
        role="tablist"
        aria-label="Product type"
        className="flex w-fit flex-wrap gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1"
      >
        {TYPE_ORDER.map((candidate) => {
          const isActive = candidate === type;
          return (
            <Link
              key={candidate}
              role="tab"
              aria-selected={isActive}
              href={`${CATALOGUE_HREF}/${candidate}/new`}
              className={[
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--admin-surface)] font-semibold text-[var(--admin-primary)] shadow-sm"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {TYPE_META[candidate].label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="flex flex-col gap-6 lg:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className={panelClassName}>
            <h2 className={legendClassName}>Basics</h2>

            <div className="mt-4">
              <label className={fieldLabelClassName} htmlFor={titleFieldId}>
                Title <span className="text-[var(--admin-danger)]">*</span>
              </label>
              <input
                id={titleFieldId}
                className={fieldInputClassName}
                value={title}
                required
                maxLength={512}
                placeholder={`e.g. Complete trader ${meta.label.toLowerCase()}`}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-2">
                <label className={fieldLabelClassName} htmlFor={slugFieldId}>
                  Slug <span className="text-[var(--admin-danger)]">*</span>
                </label>
                {!slugEdited ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:underline"
                    onClick={() => {
                      setSlugEdited(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit slug
                  </button>
                ) : null}
              </div>

              <input
                id={slugFieldId}
                className={`${fieldInputClassName} font-data`}
                value={slug}
                required
                maxLength={128}
                readOnly={!slugEdited}
                aria-invalid={slugState.available === false}
                aria-describedby={`${slugFieldId}-hint`}
                onChange={(event) => {
                  setSlug(slugifyTitle(event.target.value));
                }}
              />

              <p
                id={`${slugFieldId}-hint`}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]"
              >
                {slugState.checking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
                    Checking availability…
                  </>
                ) : slugState.available === true ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
                    Available.
                  </>
                ) : slugEdited ? (
                  "Used in the product URL. Lower case, numbers and hyphens."
                ) : (
                  "Generated from the title. Editing it stops that."
                )}
              </p>

              {slugState.available === false && slugState.conflict ? (
                <p
                  role="alert"
                  className="mt-2 flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-3 py-2 text-xs text-[var(--admin-danger)]"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Already used by{" "}
                    <Link
                      href={`${CATALOGUE_HREF}/${type}/${slugState.conflict.id}`}
                      className="font-semibold underline"
                    >
                      {slugState.conflict.title}
                    </Link>
                    . Pick a different slug.
                  </span>
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <label className={fieldLabelClassName} htmlFor={descriptionFieldId}>
                Description
              </label>
              <textarea
                id={descriptionFieldId}
                rows={4}
                maxLength={4096}
                className={`${fieldInputClassName} resize-y`}
                placeholder="What does this product give a learner?"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </div>
          </section>

          <section className={panelClassName}>
            <h2 className={legendClassName}>Status</h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              A product can be published later from its own page.
            </p>

            <div className="mt-4 max-w-sm">
              <DropdownField
                label={<span className="sr-only">Status</span>}
                labelId={statusFieldId}
                open={statusOpen}
                disabled={submitting}
                panelAriaLabel="Status"
                onToggle={() => {
                  setStatusOpen((previous) => !previous);
                }}
                triggerContent={activeStatus?.label ?? "Draft"}
              >
                <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                  {STATUS_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      role="option"
                      aria-selected={choice.value === status}
                      className={dropdownItemClassName}
                      onClick={() => {
                        setStatus(choice.value);
                        setStatusOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{choice.label}</span>
                        <span className="block text-xs text-[var(--admin-on-surface-variant)]">
                          {choice.hint}
                        </span>
                      </span>
                      {choice.value === status ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>
          </section>

          {meta.hasBillingInterval ? (
            <section className={panelClassName}>
              <h2 className={legendClassName}>Billing interval</h2>
              <p className="mt-1 flex items-start gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                How often the plan renews. Prices are configured outside this module.
              </p>

              <div className="mt-4 max-w-sm">
                <DropdownField
                  label={<span className="sr-only">Billing interval</span>}
                  labelId={billingFieldId}
                  open={billingOpen}
                  disabled={submitting}
                  panelAriaLabel="Billing interval"
                  onToggle={() => {
                    setBillingOpen((previous) => !previous);
                  }}
                  triggerContent={activeBilling?.label ?? "Monthly"}
                >
                  <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                    {BILLING_INTERVALS.map((interval) => (
                      <button
                        key={interval.value}
                        type="button"
                        role="option"
                        aria-selected={interval.value === billingInterval}
                        className={dropdownItemClassName}
                        onClick={() => {
                          setBillingInterval(interval.value);
                          setBillingOpen(false);
                        }}
                      >
                        <span className="flex-1">{interval.label}</span>
                        {interval.value === billingInterval ? (
                          <Check
                            className="h-4 w-4 text-[var(--admin-primary)]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>
            </section>
          ) : null}

          <section className={panelClassName}>
            <h2 className={legendClassName}>Contents</h2>
            <p className="mb-4 mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {meta.contentsHint}
            </p>
            <LearnerProductItemsBuilder
              type={type}
              items={items}
              onChange={setItems}
              singleSelection={assessment}
              onSingleSelectionChange={setAssessment}
              disabled={submitting}
              emptyHint={meta.contentsHint}
            />
          </section>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 text-sm font-medium text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <button type="submit" className="sr-only" disabled={!canSubmit}>
            Create product
          </button>
        </form>

        <aside className="lg:col-span-1">
          <div className={`${panelClassName} lg:sticky lg:top-6`}>
            <h2 className={legendClassName}>Summary</h2>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Type</dt>
                <dd className="font-medium text-[var(--admin-on-surface)]">{meta.label}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[var(--admin-on-surface-variant)]">Title</dt>
                <dd className="min-w-0 truncate text-right font-medium text-[var(--admin-on-surface)]">
                  {title.trim() || "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[var(--admin-on-surface-variant)]">Slug</dt>
                <dd className="min-w-0">
                  <span className={`${catalogueSlugChipClassName} block truncate`}>
                    {slug || "—"}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Status</dt>
                <dd>
                  <span className={statusChipClassName(status)}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                    {statusLabel(status)}
                  </span>
                </dd>
              </div>
              {meta.hasBillingInterval ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--admin-on-surface-variant)]">Billing</dt>
                  <dd className="font-medium text-[var(--admin-on-surface)]">
                    {activeBilling?.label}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-[var(--admin-border)] pt-3">
                <dt className="text-[var(--admin-on-surface-variant)]">
                  {meta.singleAssessment ? "Assessment" : "Items"}
                </dt>
                <dd className="font-bold tabular-nums text-[var(--admin-on-surface)]">
                  {meta.singleAssessment ? (assessment ? "Selected" : "None") : items.length}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                void submit();
              }}
              className={`${managePrimaryButtonClassName} mt-5 w-full`}
            >
              <FileStack className="h-4 w-4" aria-hidden="true" />
              {submitting ? "Creating…" : `Create ${meta.label.toLowerCase()}`}
            </button>

            {!canSubmit && !submitting ? (
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {slugState.available === false
                  ? "Pick a slug that is not already used."
                  : !title.trim()
                    ? "A title is required."
                    : !contentsReady
                      ? meta.contentsHint
                      : ""}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {created ? (
        <CreatedDialog
          product={created}
          typeLabel={meta.label}
          onOpen={() => {
            router.push(`${CATALOGUE_HREF}/${type}/${created.id}`);
          }}
          onAnother={resetForAnother}
        />
      ) : null}
    </div>
  );
}

function CreatedDialog({
  product,
  typeLabel,
  onOpen,
  onAnother,
}: {
  product: ProductDetail;
  typeLabel: string;
  onOpen: () => void;
  onAnother: () => void;
}) {
  const headingId = useId();

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 text-center shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_15%,var(--admin-surface))] text-[var(--admin-success)]">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>

        <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
          {typeLabel} created
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          It is in your catalogue and ready to enrol learners into.
        </p>

        <dl className="mt-5 space-y-2.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-left text-sm">
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-[var(--admin-on-surface-variant)]">Title</dt>
            <dd className="min-w-0 truncate font-semibold text-[var(--admin-on-surface)]">
              {product.title}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-[var(--admin-on-surface-variant)]">Slug</dt>
            <dd className="min-w-0">
              <span className={`${catalogueSlugChipClassName} block truncate`}>{product.slug}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--admin-on-surface-variant)]">Status</dt>
            <dd>
              <span className={statusChipClassName(product.status)}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {statusLabel(product.status)}
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={onOpen} className={managePrimaryButtonClassName}>
            Open product
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onAnother} className={manageSecondaryButtonClassName}>
            Create another
          </button>
        </div>
      </div>
    </div>
  );
}
