"use client";

import { useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import { readinessApiClient } from "../../../modules/readiness/readiness.api-client";
import type { CtaPolicyConfig, CtaProminence } from "../../../server/readiness/readiness.types";

type ReadinessCtaCardProps = {
  prominence: CtaProminence;
  ctaPolicy: CtaPolicyConfig | null;
  disabled?: boolean;
};

const prominenceStyles: Record<CtaProminence, string> = {
  hidden: "opacity-60",
  subtle: "border-dashed",
  standard: "border-solid",
  prominent: "border-2 border-current",
};

export function ReadinessCtaCard({ prominence, ctaPolicy, disabled }: ReadinessCtaCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  if (!ctaPolicy) {
    return (
      <section className="rounded border p-4" aria-label="Outbound CTA">
        <h2 className="text-lg font-semibold">Next step</h2>
        <p className="text-sm opacity-80">Readiness policy is not configured yet.</p>
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

  return (
    <section
      className={`rounded border p-4 ${prominenceStyles[prominence]}`}
      aria-label="Outbound CTA"
    >
      <h2 className="text-lg font-semibold">{ctaPolicy.ctaCopy.headline}</h2>
      <p className="mt-2 text-sm opacity-90">{ctaPolicy.ctaCopy.body}</p>
      {isHidden ? (
        <p className="mt-3 text-sm opacity-80">
          This CTA is de-emphasized for your current band. You may still continue learning in the
          academy.
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 rounded border px-4 py-2 text-sm font-medium disabled:opacity-50"
        disabled={disabled || loading || isHidden}
        onClick={() => {
          setConfirmOpen(true);
        }}
      >
        {ctaPolicy.ctaCopy.buttonLabel}
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cta-confirm-title"
        >
          <div className="max-w-md rounded border bg-white p-4 text-black shadow-lg">
            <h3 id="cta-confirm-title" className="text-lg font-semibold">
              Continue to external site?
            </h3>
            <p className="mt-2 text-sm">
              You will leave the academy and continue on an external destination. This is an
              educational handoff only and does not guarantee outcomes.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setConfirmOpen(false);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded border px-3 py-2 text-sm font-medium"
                onClick={() => void handleConfirm()}
                disabled={loading}
              >
                {loading ? "Redirecting…" : "Continue externally"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}
    </section>
  );
}
