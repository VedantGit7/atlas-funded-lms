"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { CertificateShareDialog } from "./CertificateShareDialog";

/** Keep the closed sharing UI and its animation engine out of the certificate list. */
export function DeferredCertificateShareDialog(
  props: ComponentProps<typeof CertificateShareDialog>,
) {
  const [Dialog, setDialog] = useState<typeof CertificateShareDialog | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const open = props.share !== null;

  useEffect(() => {
    if (!open || Dialog) return;
    let cancelled = false;
    setFailed(false);
    void import("./CertificateShareDialog")
      .then((module) => {
        if (!cancelled) setDialog(() => module.CertificateShareDialog);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, Dialog, attempt]);

  useEffect(() => {
    if (!open || Dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fallbackRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
      if (event.key !== "Tab") return;
      const buttons = fallbackRef.current?.querySelectorAll<HTMLButtonElement>("button");
      const first = buttons?.[0];
      const last = buttons?.[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, Dialog, props.onClose]);

  // Retain the loaded component through close so its existing exit transition runs.
  if (Dialog) return <Dialog {...props} />;
  if (!open) return null;
  return (
    <div
      ref={fallbackRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-loading-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h2 id="share-loading-title" className="text-lg font-semibold">
          Share credential
        </h2>
        <p role={failed ? "alert" : "status"}>
          {failed
            ? "Unable to load sharing options. Your certificates are still available."
            : "Loading sharing options…"}
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
    </div>
  );
}
