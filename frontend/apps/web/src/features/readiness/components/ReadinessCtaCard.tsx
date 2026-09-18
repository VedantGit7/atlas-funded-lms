"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleAlert, Rocket, X } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { readinessApiClient } from "@atlas/contracts-modules/readiness/readiness.api-client";
import type { CtaPolicyConfig, CtaProminence } from "@atlas/contracts/readiness/readiness.types";

type ReadinessCtaCardProps = {
  prominence: CtaProminence;
  ctaPolicy: CtaPolicyConfig | null;
  disabled?: boolean;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function ReadinessCtaCard({ prominence, ctaPolicy, disabled }: ReadinessCtaCardProps) {
  const reduce = useReducedMotion();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmOpen, loading]);

  if (!ctaPolicy) {
    return (
      <section aria-label="Next step" className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Next step</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Readiness policy is not configured yet.
        </p>
      </section>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    setRequestId(null);

    try {
      const result = await readinessApiClient.createAttributionToken({
        sourceSurface: "L12",
        sourcePath: "/readiness",
      });
      window.location.assign(result.data.outboundUrl);
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
        setRequestId(err.requestId);
      } else {
        setError("Unable to create attribution token.");
      }
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const isHidden = prominence === "hidden";
  const isBanner = prominence === "standard" || prominence === "prominent";
  const buttonDisabled = disabled || loading || isHidden;
  const { headline, body, buttonLabel } = ctaPolicy.ctaCopy;

  return (
    <section
      aria-label="Next step"
      className={
        isBanner
          ? `relative overflow-hidden rounded-2xl bg-primary p-8 text-primary-foreground md:p-10 ${
              prominence === "prominent"
                ? "ring-2 ring-inset ring-[color-mix(in_srgb,var(--primary-foreground)_28%,transparent)]"
                : ""
            }`
          : "rounded-2xl border border-border bg-card p-6 md:p-8"
      }
    >
      {isBanner ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{ background: "color-mix(in srgb, var(--primary-foreground) 10%, transparent)" }}
        />
      ) : null}

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2
            className={
              isBanner
                ? "text-2xl font-semibold tracking-tight md:text-3xl"
                : "text-xl font-semibold text-foreground"
            }
          >
            {headline}
          </h2>
          <p
            className={`mt-3 text-sm leading-relaxed ${
              isBanner
                ? "text-[color-mix(in_srgb,var(--primary-foreground)_85%,transparent)]"
                : "text-muted-foreground"
            }`}
          >
            {body}
          </p>
          {isHidden ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This step is de-emphasized for your current band. You can keep learning in the academy
              at any time.
            </p>
          ) : null}
        </div>

        {!isHidden ? (
          <button
            type="button"
            disabled={buttonDisabled}
            onClick={() => {
              setConfirmOpen(true);
            }}
            className={
              isBanner
                ? "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-foreground px-7 py-3.5 text-sm font-bold text-primary transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100"
                : "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-primary px-6 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            }
          >
            {buttonLabel}
            {isBanner ? (
              <Rocket className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          className={`relative mt-4 flex items-start gap-2 text-sm ${
            isBanner
              ? "text-[color-mix(in_srgb,var(--primary-foreground)_90%,transparent)]"
              : "text-[var(--destructive)]"
          }`}
          role="alert"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            {error}
            {requestId ? ` (Request ID: ${requestId})` : null}
          </span>
        </p>
      ) : null}

      <AnimatePresence>
        {confirmOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: reduce ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduce ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cta-confirm-title"
          >
            <button
              type="button"
              aria-label="Close dialog"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                if (!loading) setConfirmOpen(false);
              }}
            />
            <motion.div
              className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 id="cta-confirm-title" className="text-lg font-semibold text-foreground">
                  Continue to external site?
                </h3>
                <button
                  type="button"
                  aria-label="Close"
                  disabled={loading}
                  onClick={() => {
                    setConfirmOpen(false);
                  }}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                You will leave the academy and continue on an external destination. This is an
                educational handoff only and does not guarantee outcomes.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  ref={cancelRef}
                  type="button"
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  onClick={() => {
                    setConfirmOpen(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  onClick={() => void handleConfirm()}
                  disabled={loading}
                >
                  {loading ? "Redirecting…" : "Continue externally"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
