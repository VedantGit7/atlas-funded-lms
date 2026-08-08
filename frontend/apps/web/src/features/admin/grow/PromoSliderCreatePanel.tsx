"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleCheck, Info } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  MARKETING_HREF,
  PROMO_SLIDER_LIST_HREF,
  promoSliderHref,
  type PromoSliderDto,
} from "./promo-slider-shared";

export function PromoSliderCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!title.trim()) {
      toast.error("Slider title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: PromoSliderDto }>(
        "/api/v1/marketing/promo-sliders",
        { title: title.trim(), description: description.trim() || null },
        "promo-slider-create",
        { successMessage: "Promo slider created." },
      );
      router.push(promoSliderHref(response.data.id));
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not create promo slider.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-[600px] space-y-6">
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
            href={PROMO_SLIDER_LIST_HREF}
            prefetch={false}
            className="transition-colors hover:text-[var(--admin-primary)]"
          >
            Promo Slider
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[var(--admin-primary)]">Create</span>
        </nav>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Create Promo Slider
        </h1>
        <p className="mt-1 max-w-xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
          Title and description are for admin reference only. Learners see slide images and links on
          the dashboard carousel.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
        <div>
          <label htmlFor="promo-create-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Slider title
          </label>
          <input
            id="promo-create-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={MESSENGER_WIZARD_FIELD_CLASS}
            maxLength={200}
            placeholder="Summer dashboard banners"
          />
        </div>
        <div>
          <label htmlFor="promo-create-description" className={MESSENGER_WIZARD_LABEL_CLASS}>
            Internal description{" "}
            <span className="font-normal text-[var(--admin-on-surface-variant)]">(optional)</span>
          </label>
          <textarea
            id="promo-create-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
            maxLength={2000}
            placeholder="Internal notes for your team..."
          />
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">What&apos;s next</h2>
          </div>
          <ul className="space-y-2 text-[13px] leading-5 text-[var(--admin-on-surface-variant)]">
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
              Upload image URLs for each slide (up to 20)
            </li>
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
              Set action links and optional start/end schedules per slide
            </li>
            <li className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
              Publish when ready to show on the learner dashboard
            </li>
          </ul>
        </div>
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
          {busy ? "Creating..." : "Create & continue to builder"}
        </button>
        <Link
          href={PROMO_SLIDER_LIST_HREF}
          prefetch={false}
          className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
        >
          Discard
        </Link>
      </div>
    </div>
  );
}
