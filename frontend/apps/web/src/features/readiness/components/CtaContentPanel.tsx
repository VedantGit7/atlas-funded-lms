"use client";

import {
  ctaPreviewPanelClassName,
  fieldClassName,
  labelClassName,
  panelBodyClassName,
  panelClassName,
} from "../readiness-admin-shared";

type CtaCopy = {
  headline: string;
  body: string;
  buttonLabel: string;
};

type CtaContentPanelProps = {
  ctaCopy: CtaCopy;
  disabled?: boolean;
  onChange: (ctaCopy: CtaCopy) => void;
};

export function CtaContentPanel({ ctaCopy, disabled, onChange }: CtaContentPanelProps) {
  return (
    <section
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
      aria-labelledby="cta-content-heading"
    >
      <div className={panelClassName}>
        <div className="border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
          <h2 id="cta-content-heading" className="text-base font-semibold text-[var(--admin-on-surface)]">
            CTA Content Configuration
          </h2>
        </div>
        <div className={`${panelBodyClassName} space-y-4`}>
          <div>
            <label className={labelClassName} htmlFor="cta-headline">
              Headline
            </label>
            <input
              id="cta-headline"
              className={`${fieldClassName} mt-1.5`}
              value={ctaCopy.headline}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...ctaCopy, headline: event.target.value });
              }}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="cta-body">
              Body text
            </label>
            <textarea
              id="cta-body"
              className={`${fieldClassName} mt-1.5 min-h-[88px] resize-y`}
              rows={3}
              value={ctaCopy.body}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...ctaCopy, body: event.target.value });
              }}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="cta-button-label">
              Button label
            </label>
            <input
              id="cta-button-label"
              className={`${fieldClassName} mt-1.5`}
              value={ctaCopy.buttonLabel}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...ctaCopy, buttonLabel: event.target.value });
              }}
            />
          </div>
        </div>
      </div>

      <div className={ctaPreviewPanelClassName} aria-live="polite" aria-label="CTA live preview">
        <span className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest text-[var(--admin-primary)] opacity-70">
          Live preview
        </span>
        <div className="relative max-w-xs px-2 pt-6">
          <h3 className="mb-2 text-xl font-bold text-[var(--admin-on-surface)]">
            {ctaCopy.headline.trim() || "Headline preview"}
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            {ctaCopy.body.trim() || "Body copy appears here as you type."}
          </p>
          <div
            className="w-full rounded-xl bg-[var(--admin-primary)] px-4 py-3.5 text-center text-base font-bold text-[var(--admin-on-primary)] shadow-md motion-safe:transition-transform motion-safe:hover:scale-[1.01]"
            role="presentation"
          >
            {ctaCopy.buttonLabel.trim() || "Button label"}
          </div>
        </div>
      </div>
    </section>
  );
}
