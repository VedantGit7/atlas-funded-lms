"use client";

import { useEffect, useState, type ComponentProps } from "react";
import type { DiagnosticIdentityGate as IdentityGate } from "./DiagnosticIdentityGate";

/** Keep form values on reopen without downloading a closed form on first load. */
export function DeferredDiagnosticIdentityGate(props: ComponentProps<typeof IdentityGate>) {
  const [Gate, setGate] = useState<typeof IdentityGate | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!props.open || Gate) return;
    let cancelled = false;
    setFailed(false);
    void import("./DiagnosticIdentityGate")
      .then(({ DiagnosticIdentityGate }) => {
        if (!cancelled) setGate(() => DiagnosticIdentityGate);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, Gate, attempt]);

  useEffect(() => {
    if (!props.open || Gate) return;
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", cancelOnEscape);
    return () => {
      document.removeEventListener("keydown", cancelOnEscape);
    };
  }, [props.open, props.onClose, Gate]);

  // Once loaded, keep the same form mounted when it closes to retain inputs.
  if (Gate) return <Gate {...props} />;
  if (!props.open) return null;
  // A failed optional chunk must not replace the completed diagnostic page.
  return (
    <div role={failed ? "alert" : "status"} className="space-y-3 rounded border p-4">
      <p>
        {failed
          ? "Unable to load the sign-in form. Your diagnostic results are still available."
          : "Loading sign-in form…"}
      </p>
      <div className="flex gap-3">
        {failed ? (
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => {
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </button>
        ) : null}
        <button type="button" className="rounded border px-4 py-2" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
