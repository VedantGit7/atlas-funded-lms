"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  MARKETING_HREF,
  PROMO_SLIDER_LIST_HREF,
  formatPromoDateTime,
  newDraftSlide,
  promoImageFitLabel,
  promoStatusLabel,
  slideHasSchedule,
  type PromoSlideDto,
  type PromoSlideImageFit,
  type PromoSliderDto,
} from "./promo-slider-shared";

type Tab = "basics" | "slides" | "publish";

const MAX_SLIDES = 20;

const IMAGE_FIT_OPTIONS: ReadonlyArray<{ value: PromoSlideImageFit; label: string }> = [
  { value: "COVER", label: "Cover" },
  { value: "CONTAIN", label: "Contain" },
  { value: "FILL", label: "Fill" },
];

type EditableSlide = {
  id?: string;
  name: string;
  imageUrl: string;
  imageFit: PromoSlideImageFit;
  linkUrl: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  isDraft?: boolean;
  scheduleEnabled: boolean;
};

function statusTone(status: PromoSliderDto["status"]): "success" | "warning" | "neutral" {
  if (status === "LIVE") return "success";
  if (status === "UNPUBLISHED") return "warning";
  return "neutral";
}

function StatusChip({ status }: { status: PromoSliderDto["status"] }) {
  const tone = statusTone(status);
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {promoStatusLabel(status)}
    </span>
  );
}

function imageFitCss(fit: PromoSlideImageFit): "cover" | "contain" | "fill" {
  if (fit === "CONTAIN") return "contain";
  if (fit === "FILL") return "fill";
  return "cover";
}

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapSlides(slides: PromoSlideDto[]): EditableSlide[] {
  return slides.map((slide, _index) => ({
    id: slide.id,
    name: slide.name,
    imageUrl: slide.imageUrl ?? "",
    imageFit: slide.imageFit,
    linkUrl: slide.linkUrl ?? "",
    startsAt: toLocalInput(slide.startsAt),
    endsAt: toLocalInput(slide.endsAt),
    sortOrder: slide.sortOrder,
    scheduleEnabled: slideHasSchedule(slide),
  }));
}

function reorderSlides(list: EditableSlide[], fromIndex: number, toIndex: number): EditableSlide[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return list;
  next.splice(toIndex, 0, moved);
  return next.map((slide, index) => ({ ...slide, sortOrder: index }));
}

type CarouselPreviewProps = {
  slides: EditableSlide[];
  previewIndex: number;
  onPreviewIndexChange: (index: number) => void;
  selectedHasSchedule: boolean;
};

function CarouselPreview({
  slides,
  previewIndex,
  onPreviewIndexChange,
  selectedHasSchedule,
}: CarouselPreviewProps) {
  const safeIndex = slides.length === 0 ? 0 : Math.min(previewIndex, slides.length - 1);
  const current = slides[safeIndex];
  const hasMultiple = slides.length > 1;

  function goPrev() {
    if (slides.length === 0) return;
    onPreviewIndexChange((safeIndex - 1 + slides.length) % slides.length);
  }

  function goNext() {
    if (slides.length === 0) return;
    onPreviewIndexChange((safeIndex + 1) % slides.length);
  }

  return (
    <div className="sticky top-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Live preview
        </h3>
        {selectedHasSchedule ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-primary)]">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            Scheduled
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-80" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-60" />
            <div className="ml-2 h-6 flex-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-[10px] leading-6 text-[var(--admin-on-surface-variant)]">
              learner-dashboard/preview
            </div>
          </div>
        </div>

        <div
          className="relative bg-[var(--admin-surface-low)] p-4"
          style={{ colorScheme: "light" }}
        >
          {slides.length === 0 ? (
            <div
              className="flex aspect-[21/9] items-center justify-center rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] text-sm"
              style={{ color: "GrayText" }}
            >
              Add slides to preview the carousel
            </div>
          ) : (
            <div className="relative">
              <div className="relative aspect-[21/9] overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                {current?.imageUrl.trim() ? (
                  <img
                    src={current.imageUrl.trim()}
                    alt={current.name}
                    className="h-full w-full"
                    style={{ objectFit: imageFitCss(current.imageFit) }}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm"
                    style={{ color: "GrayText" }}
                  >
                    <span>No image URL</span>
                    <span className="text-xs">{current?.name ?? "Slide"}</span>
                  </div>
                )}

                {hasMultiple ? (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_92%,transparent)] text-[var(--admin-on-surface)] shadow-sm transition-colors hover:bg-[var(--admin-surface)]"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface)_92%,transparent)] text-[var(--admin-on-surface)] shadow-sm transition-colors hover:bg-[var(--admin-surface)]"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>

              {hasMultiple ? (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {slides.map((slide, index) => {
                    const active = index === safeIndex;
                    return (
                      <button
                        key={slide.id ?? `dot-${String(index)}`}
                        type="button"
                        onClick={() => {
                          onPreviewIndexChange(index);
                        }}
                        className={[
                          "h-2 w-2 rounded-full transition-all",
                          active
                            ? "w-5 bg-[var(--admin-primary)]"
                            : "bg-[var(--admin-outline)] hover:bg-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                        aria-label={`Go to slide ${String(index + 1)}`}
                        aria-current={active ? "true" : undefined}
                      />
                    );
                  })}
                </div>
              ) : null}

              {current?.name ? (
                <p className="mt-2 truncate text-center text-xs" style={{ color: "CanvasText" }}>
                  {current.name}
                  {current.linkUrl.trim() ? (
                    <span style={{ color: "GrayText" }}> · {current.linkUrl.trim()}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Preview reflects unsaved slide order and image fit. Visitor-facing colors use system light
        scheme.
      </p>
    </div>
  );
}

export function PromoSliderBuilderPanel({ sliderId }: { sliderId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("slides");
  const [slider, setSlider] = useState<PromoSliderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: PromoSliderDto }>(
        `/api/v1/marketing/promo-sliders/${sliderId}`,
      );
      const data = response.data;
      setSlider(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      const mapped = mapSlides(data.slides);
      setSlides(mapped);
      setSelectedIndex(0);
      setPreviewIndex(0);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load promo slider.",
      );
    } finally {
      setLoading(false);
    }
  }, [sliderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = slider?.status === "LIVE";
  const editable = !live;
  const selectedSlide = slides[selectedIndex] ?? null;

  const selectedHasSchedule = useMemo(() => {
    if (!selectedSlide) return false;
    if (!selectedSlide.scheduleEnabled) return false;
    return Boolean(selectedSlide.startsAt.trim() || selectedSlide.endsAt.trim());
  }, [selectedSlide]);

  useEffect(() => {
    if (selectedIndex >= slides.length && slides.length > 0) {
      setSelectedIndex(slides.length - 1);
    }
  }, [selectedIndex, slides.length]);

  function updateSlide(index: number, patch: Partial<EditableSlide>) {
    setSlides((prev) => prev.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));
  }

  function moveSlide(fromIndex: number, toIndex: number) {
    setSlides((prev) => reorderSlides(prev, fromIndex, toIndex));
    setSelectedIndex(toIndex);
    setPreviewIndex(toIndex);
  }

  function removeSlide(index: number) {
    setSlides((prev) => {
      const next = prev
        .filter((_, i) => i !== index)
        .map((slide, i) => ({ ...slide, sortOrder: i }));
      return next;
    });
    setSelectedIndex((current) => Math.max(0, current >= index ? current - 1 : current));
    setPreviewIndex((current) => Math.max(0, current >= index ? current - 1 : current));
  }

  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    const draft = newDraftSlide(slides.length);
    const next: EditableSlide = {
      id: draft.id,
      name: draft.name,
      imageUrl: draft.imageUrl ?? "",
      imageFit: draft.imageFit,
      linkUrl: draft.linkUrl ?? "",
      startsAt: "",
      endsAt: "",
      sortOrder: slides.length,
      isDraft: true,
      scheduleEnabled: false,
    };
    setSlides((prev) => [...prev, next]);
    setSelectedIndex(slides.length);
    setPreviewIndex(slides.length);
  }

  async function saveBasics() {
    if (!slider) return;
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: PromoSliderDto }>(
        `/api/v1/marketing/promo-sliders/${slider.id}`,
        { title: title.trim(), description: description.trim() || null },
        "promo-slider-basics",
        { successMessage: "Saved." },
      );
      setSlider(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSlides() {
    if (!slider) return;
    setBusy(true);
    try {
      const response = await clientApi.put<{ data: PromoSliderDto }>(
        `/api/v1/marketing/promo-sliders/${slider.id}/slides`,
        {
          slides: slides.map((slide, index) => ({
            ...(slide.id && !slide.isDraft ? { id: slide.id } : {}),
            name: slide.name.trim() || `Slide ${index + 1}`,
            imageUrl: slide.imageUrl.trim() || null,
            imageFit: slide.imageFit,
            linkUrl: slide.linkUrl.trim() || null,
            startsAt: slide.scheduleEnabled ? fromLocalInput(slide.startsAt) : null,
            endsAt: slide.scheduleEnabled ? fromLocalInput(slide.endsAt) : null,
            sortOrder: index,
          })),
        },
        "promo-slider-slides",
        { successMessage: "Slides saved." },
      );
      setSlider(response.data);
      setSlides(mapSlides(response.data.slides));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save slides.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!slider) return;
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: PromoSliderDto }>(
        `/api/v1/marketing/promo-sliders/${slider.id}/publish`,
        {},
        "promo-slider-publish",
        { successMessage: "Promo slider is Live." },
      );
      setSlider(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!slider) return;
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: PromoSliderDto }>(
        `/api/v1/marketing/promo-sliders/${slider.id}/unpublish`,
        {},
        "promo-slider-unpublish",
        { successMessage: "Promo slider unpublished." },
      );
      setSlider(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!slider) return;
    if (deleteConfirm.trim() !== slider.title.trim()) {
      toast.error("Type the slider title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/promo-sliders/${slider.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "promo-slider-delete",
        { successMessage: "Promo slider deleted." },
      );
      router.push(PROMO_SLIDER_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading promo slider...</p>
    );
  }
  if (!slider) {
    return <p className="text-sm text-[var(--admin-danger)]">Promo slider not found.</p>;
  }

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: "basics", label: "Basics" },
    { id: "slides", label: "Slides" },
    { id: "publish", label: "Publish" },
  ];

  const deleteMatches = deleteConfirm.trim() === slider.title.trim();

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
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
          href={PROMO_SLIDER_LIST_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Promo Slider
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">{slider.title}</span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
              {slider.title}
            </h1>
            <StatusChip status={slider.status} />
            <span className="inline-flex rounded-full bg-[var(--admin-primary-container)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-primary-container)]">
              {slides.length}/{MAX_SLIDES} slides
            </span>
          </div>
          {editable ? (
            <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              Draft mode: edit slides and schedules, then publish when ready.
            </p>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              This slider is Live. Unpublish to edit slides or schedules.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void unpublish();
              }}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void publish();
              }}
            >
              Publish
            </button>
          )}
        </div>
      </header>

      <div role="tablist" className="flex flex-wrap gap-4 border-b border-[var(--admin-border)]">
        {tabs.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(entry.id);
              }}
              className={[
                "relative -mb-px pb-3 text-xs font-bold tracking-[0.08em]",
                active ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface-variant)]",
              ].join(" ")}
            >
              {entry.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--admin-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "basics" ? (
        <div className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div>
            <label htmlFor="promo-basics-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Slider title
            </label>
            <input
              id="promo-basics-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="promo-basics-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Internal description
            </label>
            <textarea
              id="promo-basics-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              void saveBasics();
            }}
          >
            Save
          </button>
        </div>
      ) : null}

      {tab === "slides" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {live ? (
              <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                Unpublish before editing slides.
              </p>
            ) : null}

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                  Slide sequence
                </h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={live || slides.length >= MAX_SLIDES}
                  onClick={addSlide}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add slide
                </button>
              </div>

              {slides.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No slides yet. Add your first slide to get started.
                </p>
              ) : (
                <ul className="space-y-2">
                  {slides.map((slide, index) => {
                    const active = index === selectedIndex;
                    const scheduled =
                      slide.scheduleEnabled &&
                      Boolean(slide.startsAt.trim() || slide.endsAt.trim());
                    return (
                      <li
                        key={slide.id ?? `slide-${String(index)}`}
                        draggable={editable}
                        onDragStart={() => {
                          if (!editable) return;
                          setDragIndex(index);
                        }}
                        onDragOver={(event) => {
                          if (!editable) return;
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!editable || dragIndex == null) return;
                          moveSlide(dragIndex, index);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                        }}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                          active
                            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                            : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                          dragIndex === index ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "cursor-grab text-[var(--admin-on-surface-variant)]",
                            editable ? "" : "cursor-not-allowed opacity-40",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setSelectedIndex(index);
                            setPreviewIndex(index);
                          }}
                        >
                          <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                            {slide.name.trim() || `Slide ${String(index + 1)}`}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                            <span>#{String(index + 1)}</span>
                            {scheduled ? (
                              <span className="inline-flex items-center gap-0.5 text-[var(--admin-primary)]">
                                <Calendar className="h-3 w-3" aria-hidden="true" />
                                Scheduled
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            disabled={live || index === 0}
                            onClick={() => {
                              moveSlide(index, index - 1);
                            }}
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Move slide ${String(index + 1)} up`}
                          >
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={live || index >= slides.length - 1}
                            onClick={() => {
                              moveSlide(index, index + 1);
                            }}
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Move slide ${String(index + 1)} down`}
                          >
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedSlide ? (
              <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                    Edit slide {String(selectedIndex + 1)}
                  </h2>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={live || slides.length <= 1}
                    onClick={() => {
                      removeSlide(selectedIndex);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>

                <div>
                  <label htmlFor="promo-slide-name" className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Slide name
                  </label>
                  <input
                    id="promo-slide-name"
                    value={selectedSlide.name}
                    disabled={live}
                    onChange={(event) => {
                      updateSlide(selectedIndex, { name: event.target.value });
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                  />
                </div>

                <div>
                  <label htmlFor="promo-slide-image" className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Image URL
                  </label>
                  <input
                    id="promo-slide-image"
                    value={selectedSlide.imageUrl}
                    disabled={live}
                    onChange={(event) => {
                      updateSlide(selectedIndex, { imageUrl: event.target.value });
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    placeholder="https://"
                  />
                </div>

                <div>
                  <p className={MESSENGER_WIZARD_LABEL_CLASS}>Image fit</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Image fit">
                    {IMAGE_FIT_OPTIONS.map((option) => {
                      const active = selectedSlide.imageFit === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={live}
                          onClick={() => {
                            updateSlide(selectedIndex, { imageFit: option.value });
                          }}
                          className={[
                            "rounded-lg border px-3 py-2 text-[12px] font-bold uppercase tracking-[0.04em] transition-all",
                            active
                              ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                              : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]",
                          ].join(" ")}
                        >
                          {promoImageFitLabel(option.value)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="promo-slide-link" className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Action link
                  </label>
                  <input
                    id="promo-slide-link"
                    value={selectedSlide.linkUrl}
                    disabled={live}
                    onChange={(event) => {
                      updateSlide(selectedIndex, { linkUrl: event.target.value });
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    placeholder="https:// or /courses/..."
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Schedule this slide
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedSlide.scheduleEnabled}
                      disabled={live}
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        updateSlide(selectedIndex, {
                          scheduleEnabled: enabled,
                          startsAt: enabled ? selectedSlide.startsAt : "",
                          endsAt: enabled ? selectedSlide.endsAt : "",
                        });
                      }}
                      className="h-4 w-4 rounded border-[var(--admin-border)] accent-[var(--admin-primary)]"
                    />
                  </label>

                  {selectedSlide.scheduleEnabled ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="promo-slide-starts"
                          className={MESSENGER_WIZARD_LABEL_CLASS}
                        >
                          Starts at
                        </label>
                        <input
                          id="promo-slide-starts"
                          type="datetime-local"
                          value={selectedSlide.startsAt}
                          disabled={live}
                          onChange={(event) => {
                            updateSlide(selectedIndex, { startsAt: event.target.value });
                          }}
                          className={MESSENGER_WIZARD_FIELD_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="promo-slide-ends" className={MESSENGER_WIZARD_LABEL_CLASS}>
                          Ends at
                        </label>
                        <input
                          id="promo-slide-ends"
                          type="datetime-local"
                          value={selectedSlide.endsAt}
                          disabled={live}
                          onChange={(event) => {
                            updateSlide(selectedIndex, { endsAt: event.target.value });
                          }}
                          className={MESSENGER_WIZARD_FIELD_CLASS}
                        />
                      </div>
                      <p className="sm:col-span-2 text-xs text-[var(--admin-on-surface-variant)]">
                        Leave start blank to show immediately when Live. Leave end blank for no
                        expiry.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Slide shows whenever the slider is Live.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
                  disabled={busy || live}
                  onClick={() => {
                    void saveSlides();
                  }}
                >
                  Save slides
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <CarouselPreview
              slides={slides}
              previewIndex={previewIndex}
              onPreviewIndexChange={setPreviewIndex}
              selectedHasSchedule={selectedHasSchedule}
            />
          </div>
        </div>
      ) : null}

      {tab === "publish" ? (
        <div className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Status:{" "}
            <strong className="text-[var(--admin-on-surface)]">
              {promoStatusLabel(slider.status)}
            </strong>
            . At least one slide with an image is required to go Live. Expired slides are hidden
            automatically.
            {slider.publishedAt ? (
              <> Last published {formatPromoDateTime(slider.publishedAt)}.</>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {live ? (
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  void unpublish();
                }}
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  void publish();
                }}
              >
                Publish to Live
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-danger)] disabled:opacity-50"
              disabled={busy || live}
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
              }}
            >
              Delete slider
            </button>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
          onClick={() => {
            if (!busy) {
              setDeleteOpen(false);
              setDeleteConfirm("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promo-builder-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="promo-builder-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete promo slider
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{slider.title}</span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm slider title"
              disabled={busy}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
                disabled={busy}
                onClick={() => {
                  setDeleteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-danger)] disabled:opacity-50"
                disabled={busy || !deleteMatches}
                onClick={() => {
                  void onDelete();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
