"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Globe, Plus, X } from "lucide-react";
import { checkboxClassName } from "../../../../features/admin/roles/role-editor-shared";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "../../branding/_components/branding-admin-shared";

type AddDomainDialogProps = {
  customDomainEntitled: boolean;
};

export function AddDomainDialog({ customDomainEntitled }: AddDomainDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const hostnameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        closeDialog();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => {
      hostnameRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [busy, open]);

  function closeDialog() {
    if (busy) return;
    setOpen(false);
    setErrorMessage(null);
  }

  function resetForm() {
    setHostname("");
    setMakePrimary(false);
    setErrorMessage(null);
  }

  async function submitDomain() {
    if (!customDomainEntitled) {
      setErrorMessage("Custom domains require the branding.custom_domain.enable entitlement.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/domains",
        {
          hostname: hostname.trim().toLowerCase(),
          type: "CUSTOM_DOMAIN",
          makePrimary,
        },
        "domain-create",
      );
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={`${primaryButtonClassName} inline-flex items-center gap-2 px-4 py-2 text-sm`}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Add custom domain
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
            onClick={closeDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-primary)]/10 text-[var(--admin-primary)]">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
                  Add custom domain
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={closeDialog}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>

            <form
              className="space-y-5 px-6 py-6"
              onSubmit={(event) => {
                event.preventDefault();
                void submitDomain();
              }}
            >
              {!customDomainEntitled ? (
                <p
                  className={`${statusBannerClassName} border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
                >
                  Custom domains are not enabled for this tenant. Atlas fallback subdomains remain
                  available without this entitlement.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Enter the hostname learners will use to reach your academy. We will provide DNS
                  records to verify ownership before activation.
                </p>
              )}

              <div className="space-y-2">
                <label htmlFor="add-domain-hostname" className={labelClassName}>
                  Hostname
                </label>
                <input
                  id="add-domain-hostname"
                  ref={hostnameRef}
                  type="text"
                  value={hostname}
                  onChange={(event) => {
                    setHostname(event.target.value);
                  }}
                  required
                  minLength={3}
                  disabled={!customDomainEntitled || busy}
                  placeholder="academy.yourcompany.com"
                  className={`${fieldClassName} font-mono lowercase`}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={makePrimary}
                  onChange={(event) => {
                    setMakePrimary(event.target.checked);
                  }}
                  disabled={!customDomainEntitled || busy}
                  className={`${checkboxClassName} mt-0.5`}
                />
                <span>
                  <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                    Set as primary domain
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                    Primary domains are used as the canonical host for redirects and emails.
                  </span>
                </span>
              </label>

              {errorMessage ? (
                <p
                  role="alert"
                  className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
                >
                  {errorMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--admin-border)] pt-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeDialog}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!customDomainEntitled || busy || hostname.trim().length < 3}
                  className={primaryButtonClassName}
                >
                  {busy ? "Creating…" : "Create pending domain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
