"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ShieldCheck, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { registerMfaStepUpHandler } from "../../lib/api/mfa-step-up";

type MfaFactor = { id: string; factorType: string; status: string };
type Mode = "loading" | "verify" | "enroll" | "unavailable";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-[var(--admin-on-surface)] outline-none transition-all placeholder:tracking-normal placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:opacity-50";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/50 disabled:opacity-70 motion-safe:active:scale-[0.98]";

function setupHref(): string {
  const here = `${window.location.pathname}${window.location.search}`;
  return `/profile/security?setup=mfa&next=${encodeURIComponent(here)}`;
}

/**
 * Step-up MFA for sensitive actions (audit H4).
 *
 * When an action returns MFA_REQUIRED, the API client asks this provider to
 * confirm the user. With an authenticator already set up, the user enters a
 * code here and the action is retried; this session then counts as verified
 * until sign-out. Without one, the dialog sends them to set it up and come
 * back. Mounted by the admin and studio shells, where sensitive actions live;
 * learner pages never reach those routes and do not ship the dialog. The panel
 * carries `admin-theme` so its tokens resolve in either shell, light or dark.
 */
export function MfaStepUpProvider({ children = null }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("loading");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((verified: boolean) => void) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setupRef = useRef<HTMLAnchorElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const errorId = useId();

  const finish = useCallback((verified: boolean) => {
    resolver.current?.(verified);
    resolver.current = null;
    setOpen(false);
    setBusy(false);
    setCode("");
    setError(null);
  }, []);

  useEffect(
    () =>
      registerMfaStepUpHandler(
        () =>
          new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setMode("loading");
            setOpen(true);
            void clientApi
              .get<{ data: { factors: MfaFactor[] } }>("/api/v1/me/security/mfa")
              .then((response) => {
                const enrolled = response.data.factors.some(
                  (factor) => factor.factorType === "totp" && factor.status === "verified",
                );
                setMode(enrolled ? "verify" : "enroll");
              })
              .catch(() => {
                setMode("unavailable");
              });
          }),
      ),
    [],
  );

  // Focus and scroll lock follow `open` only, so a busy re-render never steals focus.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "verify") inputRef.current?.focus();
    else if (mode === "enroll") setupRef.current?.focus();
    else cancelRef.current?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, busy, finish]);

  async function verify() {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi.post("/api/v1/me/security/mfa/step-up", { code }, "mfa-step-up", {
        silent: true,
      });
      finish(true);
    } catch (verifyError) {
      setBusy(false);
      setCode("");
      setError(
        verifyError instanceof ClientApiError
          ? verifyError.message
          : "We couldn't verify that code. Please try again.",
      );
      inputRef.current?.focus();
    }
  }

  const description =
    mode === "enroll"
      ? "This action needs two-factor authentication, and your account doesn't have an authenticator app yet. Set one up, then come back and try again."
      : mode === "unavailable"
        ? "This action needs two-factor authentication, but your security settings couldn't be loaded. Please try again in a moment."
        : "This action needs two-factor authentication. Enter the 6-digit code from your authenticator app. You won't be asked again until you sign out.";

  return (
    <>
      {children}
      {open ? (
        <div className="admin-theme fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
            onClick={() => {
              if (!busy) finish(false);
            }}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={descriptionId}
            aria-busy={mode === "loading" || busy}
            className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <button
              type="button"
              aria-label="Cancel"
              disabled={busy}
              onClick={() => {
                finish(false);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>

            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]">
              <ShieldCheck className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </span>
            <h2 id={headingId} className="text-lg font-bold text-[var(--admin-on-surface)]">
              Confirm it&apos;s you
            </h2>
            <p
              id={descriptionId}
              className="mt-2 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]"
            >
              {mode === "loading" ? "Checking your security settings." : description}
            </p>

            {mode === "verify" ? (
              <form
                className="mt-5 flex flex-col gap-2"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void verify();
                }}
              >
                <label
                  htmlFor={inputId}
                  className="text-[13px] font-medium text-[var(--admin-on-surface-variant)]"
                >
                  Authentication code
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  disabled={busy}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    if (error) setError(null);
                  }}
                  className={fieldClassName}
                />
                {error ? (
                  <p id={errorId} role="alert" className="text-sm text-[var(--admin-danger)]">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    ref={cancelRef}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      finish(false);
                    }}
                    className={secondaryButtonClassName}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={busy} className={primaryButtonClassName}>
                    {busy ? "Verifying" : "Verify"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  ref={cancelRef}
                  type="button"
                  onClick={() => {
                    finish(false);
                  }}
                  className={secondaryButtonClassName}
                >
                  Cancel
                </button>
                {mode === "enroll" ? (
                  <a
                    ref={setupRef}
                    href={setupHref()}
                    onClick={() => {
                      finish(false);
                    }}
                    className={primaryButtonClassName}
                  >
                    Set up authenticator
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
