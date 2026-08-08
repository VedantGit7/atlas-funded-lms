"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  MousePointerClick,
  PanelBottom,
  PanelTop,
  Square,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  CTA_LIST_HREF,
  MARKETING_HREF,
  ctaHref,
  ctaTypeLabel,
  type CtaDto,
  type CtaType,
} from "./cta-shared";

const TYPES: ReadonlyArray<{
  id: CtaType;
  hint: string;
  Icon: typeof Square;
}> = [
  {
    id: "POPUP",
    hint: "Center modal. Typically embeds a Live form.",
    Icon: Square,
  },
  {
    id: "STICKY",
    hint: "Banner fixed at the top of the page.",
    Icon: PanelTop,
  },
  {
    id: "SLIDE_IN",
    hint: "Card that slides in, usually bottom-right.",
    Icon: PanelBottom,
  },
  {
    id: "EMBEDDED_BUTTON",
    hint: "Button that opens a pop-up CTA or URL.",
    Icon: MousePointerClick,
  },
];

function TypeMockup({ type }: { type: CtaType }) {
  if (type === "POPUP") {
    return (
      <div className="relative flex h-full w-full items-center justify-center p-3">
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]" />
        <div className="relative z-10 w-2/3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-sm motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-0.5">
          <div className="mb-1 h-1.5 w-full rounded bg-[var(--admin-surface-high)]" />
          <div className="mb-2 h-1 w-4/5 rounded bg-[var(--admin-surface-low)]" />
          <div className="ml-auto h-2.5 w-10 rounded bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface))]" />
        </div>
      </div>
    );
  }
  if (type === "STICKY") {
    return (
      <div className="flex h-full w-full flex-col gap-2 p-3 motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-0.5">
        <div className="h-3 w-full rounded-sm border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-surface))] shadow-sm" />
        <div className="h-1 w-full rounded-full bg-[var(--admin-outline)] opacity-30" />
        <div className="h-1 w-2/3 rounded-full bg-[var(--admin-outline)] opacity-30" />
      </div>
    );
  }
  if (type === "SLIDE_IN") {
    return (
      <div className="relative h-full w-full p-3">
        <div className="space-y-1.5 pt-1">
          <div className="h-1 w-full rounded-full bg-[var(--admin-outline)] opacity-30" />
          <div className="h-1 w-3/4 rounded-full bg-[var(--admin-outline)] opacity-30" />
        </div>
        <div className="absolute bottom-2 right-2 h-12 w-16 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-sm motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-0.5">
          <div className="mb-1 h-1 w-full rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-surface))]" />
          <div className="h-1 w-2/3 rounded-full bg-[var(--admin-surface-low)]" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-0.5">
      <div className="w-full space-y-1">
        <div className="h-1.5 w-full rounded-full bg-[var(--admin-outline)] opacity-30" />
        <div className="h-1.5 w-full rounded-full bg-[var(--admin-outline)] opacity-30" />
      </div>
      <span className="rounded bg-[var(--admin-primary)] px-3 py-1.5 text-[8px] font-bold uppercase tracking-wide text-[var(--admin-on-primary)] shadow-sm">
        Claim offer
      </span>
    </div>
  );
}

export function CtaCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaType, setCtaType] = useState<CtaType>("POPUP");
  const [buttonText, setButtonText] = useState("Learn more");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: CtaDto }>(
        "/api/v1/marketing/ctas",
        {
          title: title.trim(),
          description: description.trim() || null,
          ctaType,
          buttonText: buttonText.trim() || "Learn more",
        },
        "cta-create",
        { successMessage: "CTA created." },
      );
      router.push(ctaHref(response.data.id));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create CTA.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-2xl space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div>
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
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
          <span className="text-[var(--admin-primary)]">Create</span>
        </nav>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Create CTA
        </h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
          Title and description are for admin reference only. They are not shown to visitors.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
        <div>
          <label htmlFor="cta-create-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Title
          </label>
          <input
            id="cta-create-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={MESSENGER_WIZARD_FIELD_CLASS}
            maxLength={200}
            placeholder="Summer signup pop-up"
          />
        </div>
        <div>
          <label htmlFor="cta-create-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Description <span className="font-normal text-[var(--admin-on-surface-variant)]">(optional)</span>
          </label>
          <textarea
            id="cta-create-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
            maxLength={2000}
            placeholder="Internal notes for your team..."
          />
        </div>
        <div>
          <p id="cta-create-type-label" className={MESSENGER_WIZARD_LABEL_CLASS}>
            CTA type
          </p>
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-labelledby="cta-create-type-label"
          >
            {TYPES.map((entry) => {
              const active = ctaType === entry.id;
              const { Icon } = entry;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setCtaType(entry.id);
                  }}
                  className={[
                    "group flex h-44 flex-col overflow-hidden rounded-xl border p-4 text-left transition-all",
                    active
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] ring-2 ring-[var(--admin-primary)]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-primary)]",
                  ].join(" ")}
                >
                  <span className="mb-3 flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-[var(--admin-surface-low)]">
                    <TypeMockup type={entry.id} />
                  </span>
                  <span className="flex items-center gap-2">
                    <Icon
                      className={[
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-[var(--admin-primary)]"
                          : "text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-bold text-[var(--admin-on-surface)]">
                      {ctaTypeLabel(entry.id)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--admin-on-surface-variant)]">
                    {entry.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {ctaType === "EMBEDDED_BUTTON" ? (
          <div>
            <label htmlFor="cta-create-button-text" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Button text
            </label>
            <input
              id="cta-create-button-text"
              value={buttonText}
              onChange={(event) => {
                setButtonText(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              maxLength={80}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            void onCreate();
          }}
        >
          {busy ? "Creating..." : "Create & continue"}
        </button>
        <Link
          href={CTA_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
        >
          Discard
        </Link>
      </div>
    </div>
  );
}
