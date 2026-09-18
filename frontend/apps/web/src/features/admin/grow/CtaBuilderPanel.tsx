"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Copy,
  Eye,
  Monitor,
  MousePointerClick,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  CTA_LIST_HREF,
  MARKETING_HREF,
  ctaStatusLabel,
  ctaTypeLabel,
  defaultTargeting,
  embedButtonSnippet,
  formatCtaCount,
  type CtaDto,
  type CtaTargeting,
  type CtaType,
} from "./cta-shared";
import type { FormDto } from "./forms-shared";

type Tab = "basics" | "design" | "targeting" | "publish";

const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "All visitors" },
  { value: "ANONYMOUS", label: "Anonymous only" },
  { value: "LEARNERS", label: "Signed-in learners" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "REPEAT", label: "Repeat on each visit" },
  { value: "ONCE", label: "Do not display again" },
] as const;

const TRIGGER_OPTIONS = [
  { value: "PAGE_LOAD", label: "On page load" },
  { value: "ELAPSED", label: "After elapsed time" },
] as const;

function statusTone(status: CtaDto["status"]): "success" | "warning" | "neutral" {
  if (status === "LIVE") return "success";
  if (status === "DRAFT") return "neutral";
  return "warning";
}

function StatusChip({ status }: { status: CtaDto["status"] }) {
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
      {ctaStatusLabel(status)}
    </span>
  );
}

function TypeChip({ type }: { type: CtaType }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--admin-primary-container)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-primary-container)]">
      {ctaTypeLabel(type)}
    </span>
  );
}

type PreviewProps = {
  ctaType: CtaType;
  headline: string;
  bodyHtml: string;
  imageUrl: string;
  buttonText: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
};

function CtaLivePreview({
  ctaType,
  headline,
  bodyHtml,
  imageUrl,
  buttonText,
  buttonColor,
  buttonTextColor,
  backgroundColor,
}: PreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const displayHeadline = headline.trim() || "Your headline";
  const displayBody = bodyHtml.trim() || "Add body copy to describe your offer.";
  const displayButton = buttonText.trim() || "Learn more";

  const ctaContent = (
    <div
      className="overflow-hidden rounded-lg shadow-lg"
      style={{ backgroundColor, colorScheme: "light" }}
    >
      {imageUrl.trim() ? (
        <div className="aspect-[2/1] w-full overflow-hidden bg-[var(--admin-surface-high)]">
          <img
            src={imageUrl.trim()}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : null}
      <div className="space-y-3 p-4">
        <p className="text-base font-bold" style={{ color: "CanvasText" }}>
          {displayHeadline}
        </p>
        <p className="text-sm leading-5" style={{ color: "GrayText" }}>
          {displayBody}
        </p>
        <button
          type="button"
          className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: buttonColor, color: buttonTextColor }}
        >
          {displayButton}
        </button>
      </div>
    </div>
  );

  const pageMock = (
    <div
      className={[
        "relative min-h-[320px] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm transition-[max-width] duration-200",
        device === "mobile" ? "mx-auto max-w-[320px]" : "w-full",
      ].join(" ")}
    >
      <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-80" />
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--admin-outline)] opacity-60" />
          <div className="ml-2 h-6 flex-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-[10px] leading-6 text-[var(--admin-on-surface-variant)]">
            your-site/preview
          </div>
        </div>
      </div>
      <div
        className="relative min-h-[280px]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, color-mix(in srgb, var(--admin-surface-high) 80%, transparent) 25%, transparent 25%), linear-gradient(-45deg, color-mix(in srgb, var(--admin-surface-high) 80%, transparent) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, color-mix(in srgb, var(--admin-surface-high) 80%, transparent) 75%), linear-gradient(-45deg, transparent 75%, color-mix(in srgb, var(--admin-surface-high) 80%, transparent) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
        }}
      >
        <div className="space-y-3 p-4 opacity-40">
          <div className="h-3 w-3/4 rounded bg-[var(--admin-outline)]" />
          <div className="h-2 w-full rounded bg-[var(--admin-outline)]" />
          <div className="h-2 w-5/6 rounded bg-[var(--admin-outline)]" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="aspect-video rounded-lg bg-[var(--admin-outline)]" />
            <div className="aspect-video rounded-lg bg-[var(--admin-outline)]" />
          </div>
        </div>

        {ctaType === "POPUP" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-[240px]">{ctaContent}</div>
          </div>
        ) : null}

        {ctaType === "STICKY" ? (
          <div
            className="absolute inset-x-0 top-0 border-b border-[var(--admin-border)] px-3 py-2 shadow-sm"
            style={{ backgroundColor, colorScheme: "light" }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-bold" style={{ color: "CanvasText" }}>
                {displayHeadline}
              </p>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-1 text-[10px] font-bold"
                style={{ backgroundColor: buttonColor, color: buttonTextColor }}
              >
                {displayButton}
              </button>
            </div>
          </div>
        ) : null}

        {ctaType === "SLIDE_IN" ? (
          <div className="absolute bottom-3 right-3 w-[200px]">{ctaContent}</div>
        ) : null}

        {ctaType === "EMBEDDED_BUTTON" ? (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-md"
              style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            >
              <MousePointerClick className="h-4 w-4" aria-hidden="true" />
              {displayButton}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="sticky top-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
          Live preview
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
            {ctaTypeLabel(ctaType)}
          </span>
          <div
            className="flex gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5"
            role="group"
            aria-label="Preview device"
          >
            <button
              type="button"
              aria-pressed={device === "desktop"}
              onClick={() => {
                setDevice("desktop");
              }}
              className={[
                "rounded-md p-1.5 transition-colors",
                device === "desktop"
                  ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              aria-label="Desktop preview"
            >
              <Monitor className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-pressed={device === "mobile"}
              onClick={() => {
                setDevice("mobile");
              }}
              className={[
                "rounded-md p-1.5 transition-colors",
                device === "mobile"
                  ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              aria-label="Mobile preview"
            >
              <Smartphone className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {pageMock}
      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Preview updates as you edit messaging, colors, and action settings.
      </p>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={MESSENGER_WIZARD_LABEL_CLASS}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          disabled={disabled}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${label} color picker`}
        />
        <input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          disabled={disabled}
          className={MESSENGER_WIZARD_FIELD_CLASS}
        />
      </div>
    </div>
  );
}

export function CtaBuilderPanel({ ctaId }: { ctaId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("basics");
  const [cta, setCta] = useState<CtaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [buttonText, setButtonText] = useState("Learn more");
  const [buttonColor, setButtonColor] = useState("#5B5BD6");
  const [buttonTextColor, setButtonTextColor] = useState("#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [linkUrl, setLinkUrl] = useState("");
  const [formId, setFormId] = useState<string>("");
  const [linkedPopupCtaId, setLinkedPopupCtaId] = useState<string>("");
  const [targeting, setTargeting] = useState<CtaTargeting>(defaultTargeting());
  const [includeText, setIncludeText] = useState("*");
  const [exceptionText, setExceptionText] = useState("");
  const [liveForms, setLiveForms] = useState<FormDto[]>([]);
  const [popupCtas, setPopupCtas] = useState<CtaDto[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: CtaDto }>(`/api/v1/marketing/ctas/${ctaId}`);
      const data = response.data;
      setCta(data);
      setTitle(data.title);
      setDescription(data.description ?? "");
      setHeadline(data.headline);
      setBodyHtml(data.bodyHtml ?? "");
      setImageUrl(data.imageUrl ?? "");
      setButtonText(data.buttonText);
      setButtonColor(data.buttonColor);
      setButtonTextColor(data.buttonTextColor);
      setBackgroundColor(data.backgroundColor);
      setLinkUrl(data.linkUrl ?? "");
      setFormId(data.formId ?? "");
      setLinkedPopupCtaId(data.linkedPopupCtaId ?? "");
      setTargeting(data.targeting);
      setIncludeText(data.targeting.includeUrls.join("\n") || "*");
      setExceptionText(data.targeting.exceptionUrls.join("\n"));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load CTA.");
    } finally {
      setLoading(false);
    }
  }, [ctaId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const [formsRes, ctasRes] = await Promise.all([
          clientApi.get<{ data: { items: FormDto[] } }>(
            "/api/v1/marketing/forms?status=LIVE&limit=50",
          ),
          clientApi.get<{ data: { items: CtaDto[] } }>(
            "/api/v1/marketing/ctas?ctaType=POPUP&limit=50",
          ),
        ]);
        setLiveForms(formsRes.data.items);
        setPopupCtas(ctasRes.data.items.filter((item) => item.id !== ctaId));
      } catch {
        // pickers stay empty
      }
    })();
  }, [ctaId]);

  const live = cta?.status === "LIVE";
  const editable = !live;
  const embedSnippet = useMemo(() => (cta ? embedButtonSnippet(cta) : ""), [cta]);

  const formOptions = useMemo(
    () => [
      { value: "", label: "No form (empty skeleton)" },
      ...liveForms.map((form) => ({ value: form.id, label: form.title })),
    ],
    [liveForms],
  );

  const popupOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...popupCtas.map((item) => ({ value: item.id, label: item.title })),
    ],
    [popupCtas],
  );

  async function saveBasics() {
    if (!cta) return;
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: CtaDto }>(
        `/api/v1/marketing/ctas/${cta.id}`,
        { title: title.trim(), description: description.trim() || null },
        "cta-basics",
        { successMessage: "Saved." },
      );
      setCta(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDesign() {
    if (!cta) return;
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: CtaDto }>(
        `/api/v1/marketing/ctas/${cta.id}/design`,
        {
          headline: headline.trim(),
          bodyHtml: bodyHtml.trim() || null,
          imageUrl: imageUrl.trim() || null,
          buttonText: buttonText.trim() || "Learn more",
          buttonColor,
          buttonTextColor,
          backgroundColor,
          linkUrl: linkUrl.trim() || null,
          formId: cta.ctaType === "POPUP" ? formId || null : null,
          linkedPopupCtaId: cta.ctaType === "EMBEDDED_BUTTON" ? linkedPopupCtaId || null : null,
        },
        "cta-design",
        { successMessage: "Design saved." },
      );
      setCta(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save design.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTargeting() {
    if (!cta) return;
    const includeUrls = includeText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const exceptionUrls = exceptionText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      const next: CtaTargeting = {
        ...targeting,
        includeUrls: includeUrls.length > 0 ? includeUrls : ["*"],
        exceptionUrls,
      };
      const response = await clientApi.patch<{ data: CtaDto }>(
        `/api/v1/marketing/ctas/${cta.id}/targeting`,
        { targeting: next },
        "cta-targeting",
        { successMessage: "Targeting saved." },
      );
      setCta(response.data);
      setTargeting(response.data.targeting);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save targeting.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!cta) return;
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: CtaDto }>(
        `/api/v1/marketing/ctas/${cta.id}/publish`,
        {},
        "cta-publish",
        { successMessage: "CTA is Live." },
      );
      setCta(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!cta) return;
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: CtaDto }>(
        `/api/v1/marketing/ctas/${cta.id}/unpublish`,
        {},
        "cta-unpublish",
        { successMessage: "CTA unpublished." },
      );
      setCta(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not unpublish.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!cta) return;
    if (deleteConfirm.trim() !== cta.title.trim()) {
      toast.error("Type the CTA title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/ctas/${cta.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "cta-delete",
        { successMessage: "CTA deleted." },
      );
      router.push(CTA_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading CTA...</p>;
  }
  if (!cta) {
    return <p className="text-sm text-[var(--admin-danger)]">CTA not found.</p>;
  }

  const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
    { id: "basics", label: "Basic information" },
    { id: "design", label: "Design" },
    { id: "targeting", label: "Targeting" },
    { id: "publish", label: "Publish" },
  ];

  const deleteMatches = deleteConfirm.trim() === cta.title.trim();

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
          href={CTA_LIST_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          CTA
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">{cta.title}</span>
      </nav>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
              {cta.title}
            </h1>
            <TypeChip type={cta.ctaType} />
            <StatusChip status={cta.status} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[13px] text-[var(--admin-on-surface-variant)]">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" aria-hidden="true" />
              {formatCtaCount(cta.viewCount)} views
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              {cta.clickRate}% click rate
            </span>
            <span>{formatCtaCount(cta.clickCount)} clicks</span>
          </div>
          {editable ? (
            <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              Draft mode: design and targeting are editable. Publish when you are ready to go Live.
            </p>
          ) : (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              This CTA is Live. Unpublish to edit design or targeting.
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
            <label htmlFor="cta-basics-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Title
            </label>
            <input
              id="cta-basics-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
            />
          </div>
          <div>
            <label htmlFor="cta-basics-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Description
            </label>
            <textarea
              id="cta-basics-description"
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

      {tab === "design" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {live ? (
              <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                Unpublish before editing design.
              </p>
            ) : null}

            <section className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                Messaging
              </h2>
              <div>
                <label htmlFor="cta-design-headline" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Headline (visitor-facing)
                </label>
                <input
                  id="cta-design-headline"
                  value={headline}
                  onChange={(event) => {
                    setHeadline(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  disabled={live}
                />
              </div>
              <div>
                <label htmlFor="cta-design-body" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Body
                </label>
                <textarea
                  id="cta-design-body"
                  value={bodyHtml}
                  onChange={(event) => {
                    setBodyHtml(event.target.value);
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-28`}
                  disabled={live}
                />
              </div>
              <div>
                <label htmlFor="cta-design-image" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Image URL
                </label>
                <input
                  id="cta-design-image"
                  value={imageUrl}
                  onChange={(event) => {
                    setImageUrl(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  disabled={live}
                  placeholder="https://"
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                Visuals & branding
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  id="cta-button-color"
                  label="Button color"
                  value={buttonColor}
                  onChange={setButtonColor}
                  disabled={live}
                />
                <ColorField
                  id="cta-button-text-color"
                  label="Button text color"
                  value={buttonTextColor}
                  onChange={setButtonTextColor}
                  disabled={live}
                />
                <ColorField
                  id="cta-background-color"
                  label="Background"
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                  disabled={live}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-on-surface)]">
                Action
              </h2>
              <div>
                <label htmlFor="cta-design-button-text" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Button text
                </label>
                <input
                  id="cta-design-button-text"
                  value={buttonText}
                  onChange={(event) => {
                    setButtonText(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  disabled={live}
                />
              </div>
              <div>
                <label htmlFor="cta-design-link-url" className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Link URL (optional)
                </label>
                <input
                  id="cta-design-link-url"
                  value={linkUrl}
                  onChange={(event) => {
                    setLinkUrl(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  disabled={live}
                  placeholder="https://"
                />
              </div>

              {cta.ctaType === "POPUP" ? (
                <div>
                  <AdminSelectDropdown
                    id="cta-design-form"
                    label="Connect to LMS form"
                    ariaLabel="Connect to LMS form"
                    value={formId}
                    options={formOptions}
                    disabled={live}
                    onChange={setFormId}
                  />
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Only Live forms appear here.
                  </p>
                </div>
              ) : null}

              {cta.ctaType === "EMBEDDED_BUTTON" ? (
                <div className="space-y-4">
                  <AdminSelectDropdown
                    id="cta-design-linked-popup"
                    label="Link to pop-up CTA"
                    ariaLabel="Link to pop-up CTA"
                    value={linkedPopupCtaId}
                    options={popupOptions}
                    disabled={live}
                    onChange={setLinkedPopupCtaId}
                  />
                  <div>
                    <label htmlFor="cta-embed-snippet" className={MESSENGER_WIZARD_LABEL_CLASS}>
                      Embed HTML
                    </label>
                    <pre
                      id="cta-embed-snippet"
                      className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 text-xs text-[var(--admin-on-surface)]"
                    >
                      {embedSnippet}
                    </pre>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        void navigator.clipboard.writeText(embedSnippet).then(() => {
                          toast.success("Embed code copied.");
                        });
                      }}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || live}
                onClick={() => {
                  void saveDesign();
                }}
              >
                Save design
              </button>
            </section>
          </div>

          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <CtaLivePreview
              ctaType={cta.ctaType}
              headline={headline}
              bodyHtml={bodyHtml}
              imageUrl={imageUrl}
              buttonText={buttonText}
              buttonColor={buttonColor}
              buttonTextColor={buttonTextColor}
              backgroundColor={backgroundColor}
            />
          </div>
        </div>
      ) : null}

      {tab === "targeting" ? (
        <div className="max-w-2xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          {live ? (
            <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              Unpublish before editing targeting.
            </p>
          ) : null}
          <div>
            <label htmlFor="cta-target-include" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Include page URLs (one per line, use * for all)
            </label>
            <textarea
              id="cta-target-include"
              value={includeText}
              onChange={(event) => {
                setIncludeText(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-28 font-mono text-xs`}
              disabled={live}
            />
          </div>
          <div>
            <label htmlFor="cta-target-exception" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Exception URLs (one per line)
            </label>
            <textarea
              id="cta-target-exception"
              value={exceptionText}
              onChange={(event) => {
                setExceptionText(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-20 font-mono text-xs`}
              disabled={live}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminSelectDropdown
              id="cta-target-audience"
              label="Audience"
              ariaLabel="Audience"
              value={targeting.audience}
              options={[...AUDIENCE_OPTIONS]}
              disabled={live}
              onChange={(value) => {
                setTargeting((prev) => ({
                  ...prev,
                  audience: value as CtaTargeting["audience"],
                }));
              }}
            />
            <AdminSelectDropdown
              id="cta-target-frequency"
              label="Frequency"
              ariaLabel="Frequency"
              value={targeting.frequency}
              options={[...FREQUENCY_OPTIONS]}
              disabled={live}
              onChange={(value) => {
                setTargeting((prev) => ({
                  ...prev,
                  frequency: value as CtaTargeting["frequency"],
                }));
              }}
            />
            <AdminSelectDropdown
              id="cta-target-trigger"
              label="Trigger"
              ariaLabel="Trigger"
              value={targeting.trigger}
              options={[...TRIGGER_OPTIONS]}
              disabled={live}
              onChange={(value) => {
                setTargeting((prev) => ({
                  ...prev,
                  trigger: value as CtaTargeting["trigger"],
                }));
              }}
            />
            <div>
              <label htmlFor="cta-target-elapsed" className={MESSENGER_WIZARD_LABEL_CLASS}>
                Elapsed seconds
              </label>
              <input
                id="cta-target-elapsed"
                type="number"
                min={0}
                max={3600}
                value={targeting.elapsedSeconds}
                onChange={(event) => {
                  setTargeting((prev) => ({
                    ...prev,
                    elapsedSeconds: Number(event.target.value) || 0,
                  }));
                }}
                className={MESSENGER_WIZARD_FIELD_CLASS}
                disabled={live || targeting.trigger !== "ELAPSED"}
              />
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
            disabled={busy || live}
            onClick={() => {
              void saveTargeting();
            }}
          >
            Save targeting
          </button>
        </div>
      ) : null}

      {tab === "publish" ? (
        <div className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Status:{" "}
            <strong className="text-[var(--admin-on-surface)]">{ctaStatusLabel(cta.status)}</strong>
            . Configure design and targeting before going Live.
            {cta.ctaType === "POPUP" && !cta.formId && !cta.linkUrl
              ? " Pop-up needs a Live form or a link URL before you can publish."
              : null}
            {cta.ctaType === "POPUP" && !cta.formId && cta.linkUrl
              ? " Link-only pop-up: visitors will see the headline and button (no form)."
              : null}
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
              className="inline-flex items-center rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:opacity-50"
              disabled={busy || live}
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
              }}
            >
              Delete CTA
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
            aria-labelledby="cta-builder-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="cta-builder-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete CTA
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type <span className="font-semibold text-[var(--admin-on-surface)]">{cta.title}</span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm CTA title"
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
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
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
