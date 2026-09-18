"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import type { SubSchoolRow } from "./SubSchoolsListPanel";
import { CopySelectDialog } from "./CopySelectDialog";
import {
  COPY_PRODUCT_FLOWS,
  type CopyProductKind,
  type CopySelectableItem,
  toApiProductType,
} from "./copy-product-flows";
import { subSchoolCopyProductHref } from "./sub-schools-shared";

type StudioCourseListResponse = {
  data: { items: Array<{ id: string; title: string }> };
};

type StudioModulesResponse = {
  data: { items: Array<{ id: string; title: string }> };
};

type ProductCopyJobResponse = {
  data: {
    id: string;
    status: string;
    destinationProductName: string;
    errorMessage: string | null;
  };
};

type WizardStep = "select" | "destination";

type CopyProductWizardPanelProps = {
  subSchool: SubSchoolRow;
  kind: CopyProductKind;
};

export function CopyProductWizardPanel({ subSchool, kind }: CopyProductWizardPanelProps) {
  const router = useRouter();
  const config = COPY_PRODUCT_FLOWS[kind];
  const copyProductHref = subSchoolCopyProductHref(subSchool.id);

  const [step, setStep] = useState<WizardStep>("select");
  const [primary, setPrimary] = useState<CopySelectableItem | null>(null);
  const [sections, setSections] = useState<CopySelectableItem[]>([]);
  const [primaryItems, setPrimaryItems] = useState<CopySelectableItem[]>([]);
  const [sectionItems, setSectionItems] = useState<CopySelectableItem[]>([]);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [loadingPrimary, setLoadingPrimary] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [destinationName, setDestinationName] = useState("");
  const [continueOpen, setContinueOpen] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canGoNext = primary !== null;
  const sectionsEnabled = config.hasSections && primary !== null;
  const canConfirmCopy = destinationName.trim().length > 0 && primary !== null;

  const loadPrimaryItems = useCallback(async () => {
    setLoadingPrimary(true);
    try {
      if (kind === "course") {
        const response = await clientApi.get<StudioCourseListResponse>(
          "/api/v1/courses?view=studio&limit=100",
        );
        setPrimaryItems(response.data.items.map((item) => ({ id: item.id, label: item.title })));
      } else {
        setPrimaryItems([]);
      }
    } catch (caught) {
      setPrimaryItems([]);
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : `Could not load ${config.primaryLabel.toLowerCase()} options.`,
      );
    } finally {
      setLoadingPrimary(false);
    }
  }, [kind, config.primaryLabel]);

  const loadSectionItems = useCallback(
    async (courseId: string) => {
      if (kind !== "course") {
        setSectionItems([]);
        return;
      }
      setLoadingSections(true);
      try {
        const response = await clientApi.get<StudioModulesResponse>(
          `/api/v1/courses/${courseId}/modules?view=studio`,
        );
        setSectionItems(response.data.items.map((item) => ({ id: item.id, label: item.title })));
      } catch {
        setSectionItems([]);
      } finally {
        setLoadingSections(false);
      }
    },
    [kind],
  );

  async function openPrimaryPicker() {
    setPrimaryOpen(true);
    await loadPrimaryItems();
  }

  async function openSectionsPicker() {
    if (!primary) return;
    setSectionsOpen(true);
    if (kind === "course") {
      await loadSectionItems(primary.id);
    } else {
      setSectionItems([]);
    }
  }

  function onSelectNext() {
    if (!primary) return;
    setContinueOpen(true);
  }

  function onContinueConfirmed() {
    setContinueOpen(false);
    setDestinationName(primary ? `${primary.label} (Copy)` : "");
    setStep("destination");
  }

  async function submitCopy() {
    if (!primary || !canConfirmCopy) return;
    setSubmitting(true);
    try {
      const response = await clientApi.post<ProductCopyJobResponse>(
        `/api/v1/sub-schools/${subSchool.id}/copy-jobs`,
        {
          productType: toApiProductType(kind),
          sourceProductId: primary.id,
          sourceProductTitle: primary.label,
          destinationProductName: destinationName.trim(),
          ...(config.hasSections && sections.length > 0
            ? { sectionIds: sections.map((item) => item.id) }
            : {}),
        },
        `product-copy-${kind}-${primary.id}`,
        { silent: true },
      );

      if (response.data.status === "SUCCEEDED") {
        toast.success(`“${response.data.destinationProductName}” was copied successfully.`);
      } else if (response.data.status === "FAILED") {
        toast.error(response.data.errorMessage ?? "Product copy failed.");
      } else {
        toast.success("Copy job queued.");
      }
      setFinalConfirmOpen(false);
      router.push(copyProductHref);
      router.refresh();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not copy the product.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const primaryDisplay = primary?.label ?? "";
  const onlySection = sections.length === 1 ? sections[0] : undefined;
  const sectionsDisplay =
    sections.length === 0
      ? ""
      : onlySection
        ? onlySection.label
        : `${sections.length} sections selected`;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-6 pb-28">
        <Link
          href={step === "destination" ? "#" : copyProductHref}
          prefetch={false}
          onClick={(event) => {
            if (step === "destination") {
              event.preventDefault();
              setStep("select");
            }
          }}
          className={generalSettingsBackLinkClassName}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {step === "destination" ? config.title : "Copy Product"}
        </Link>

        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide"
        >
          <span className="text-[var(--admin-on-surface-variant)]">utilities</span>
          <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">
            &gt;
          </span>
          <Link
            href={copyProductHref}
            prefetch={false}
            className="text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
          >
            Copy Product
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]" aria-hidden="true">
            &gt;
          </span>
          <span className="text-[var(--admin-success)]">
            {step === "destination" ? "Destination" : config.breadcrumbLabel}
          </span>
        </nav>

        {step === "select" ? (
          <>
            <header className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
                {config.title}
              </h1>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">{config.subtitle}</p>
            </header>

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-6">
              <div className="space-y-5">
                <SelectRow
                  label={config.primaryLabel}
                  value={primaryDisplay}
                  placeholder={config.primaryPlaceholder}
                  onSelect={() => {
                    void openPrimaryPicker();
                  }}
                />

                {config.hasSections ? (
                  <SelectRow
                    label={config.sectionsLabel}
                    value={sectionsDisplay}
                    placeholder={config.sectionsPlaceholder}
                    disabled={!sectionsEnabled}
                    onSelect={() => {
                      void openSectionsPicker();
                    }}
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
                Choose destination
              </h1>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Select the sub-school and name for the new {config.productNoun}.
              </p>
            </header>

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm sm:p-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-[var(--admin-on-surface)]">
                    Destination
                  </label>
                  <div className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-3.5 py-2.5 text-sm font-medium text-[var(--admin-on-surface)]">
                    {subSchool.name}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                    Product will be copied into this sub-school.
                  </p>
                </div>

                <fieldset>
                  <legend className="mb-1.5 block text-sm font-bold text-[var(--admin-on-surface)]">
                    Copy as
                  </legend>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-3.5 py-3">
                    <input
                      type="radio"
                      name="copy-mode"
                      checked
                      readOnly
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                    />
                    <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      New {config.productNoun}
                    </span>
                  </label>
                </fieldset>

                <div>
                  <label
                    htmlFor="destination-product-name"
                    className="mb-1.5 block text-sm font-bold text-[var(--admin-on-surface)]"
                  >
                    Name
                  </label>
                  <input
                    id="destination-product-name"
                    type="text"
                    value={destinationName}
                    maxLength={200}
                    onChange={(event) => {
                      setDestinationName(event.target.value);
                    }}
                    placeholder={`Enter new ${config.productNoun.toLowerCase()} name`}
                    className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="admin-glass fixed inset-x-0 bottom-0 z-30 border-t border-[var(--admin-border)] px-4 py-4 md:px-8 lg:left-[280px]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          {step === "select" ? (
            <>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={onSelectNext}
                className="rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-70"
              >
                Next
              </button>
              <Link
                href={copyProductHref}
                prefetch={false}
                className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Cancel
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!canConfirmCopy || submitting}
                onClick={() => {
                  setFinalConfirmOpen(true);
                }}
                className="rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-70"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setStep("select");
                }}
                className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Back
              </button>
            </>
          )}
        </div>
      </footer>

      <CopySelectDialog
        open={primaryOpen}
        title={config.primaryLabel}
        emptyMessage={
          kind === "course"
            ? "No courses found. Create a course in Studio first."
            : kind === "mock-test"
              ? "No mock-tests available yet."
              : "No test series available yet."
        }
        items={primaryItems}
        selectedIds={primary ? [primary.id] : []}
        busy={loadingPrimary}
        onClose={() => {
          setPrimaryOpen(false);
        }}
        onConfirm={(selected) => {
          const next = selected[0] ?? null;
          setPrimary(next);
          setSections([]);
          setSectionItems([]);
        }}
      />

      {config.hasSections ? (
        <CopySelectDialog
          open={sectionsOpen}
          title={config.sectionsLabel}
          emptyMessage={
            kind === "course"
              ? "This course has no sections yet."
              : "No sections available for this test series yet."
          }
          items={sectionItems}
          selectedIds={sections.map((item) => item.id)}
          multi
          busy={loadingSections}
          onClose={() => {
            setSectionsOpen(false);
          }}
          onConfirm={(selected) => {
            setSections(selected);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={continueOpen}
        title="Continue?"
        description={`Continue copying “${primary?.label ?? "this product"}” to ${subSchool.name}?`}
        confirmLabel="Continue"
        onConfirm={onContinueConfirmed}
        onCancel={() => {
          setContinueOpen(false);
        }}
      />

      <ConfirmDialog
        open={finalConfirmOpen}
        title="Confirm copy"
        description={`Create “${destinationName.trim()}” in ${subSchool.name}? This cannot be undone from this screen.`}
        confirmLabel="Continue"
        busy={submitting}
        onConfirm={() => {
          void submitCopy();
        }}
        onCancel={() => {
          if (!submitting) setFinalConfirmOpen(false);
        }}
      />
    </>
  );
}

function SelectRow({
  label,
  value,
  placeholder,
  disabled = false,
  onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <div className={disabled ? "opacity-55" : undefined}>
      <label className="mb-1.5 block text-sm font-bold text-[var(--admin-on-surface)]">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onClick={() => {
            if (!disabled) onSelect();
          }}
          className="min-w-0 flex-1 cursor-pointer rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)]"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="shrink-0 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-variant)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Select
        </button>
      </div>
    </div>
  );
}
