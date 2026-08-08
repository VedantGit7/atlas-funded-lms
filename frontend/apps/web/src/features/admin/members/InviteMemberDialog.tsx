"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Mail, ShieldCheck, UserPlus, X } from "lucide-react";
import { INVITE_EXPIRY_DAYS } from "@atlas/contracts/membership/schemas/admin-members";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { RoleOption } from "./MembersTable";
import { MEMBERS_LIST_REFRESH_EVENT } from "./members-events";

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  return "Request failed.";
}

const fieldClassName =
  "w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] py-2.5 pl-11 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const labelClassName =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

type InviteMemberDialogProps = {
  availableRoles?: RoleOption[];
};

export function InviteMemberDialog({ availableRoles = [] }: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const assignableRoles = useMemo(
    () => availableRoles.filter((role) => role.key !== "owner"),
    [availableRoles],
  );
  const learnerRole = useMemo(
    () => availableRoles.find((role) => role.key === "learner") ?? null,
    [availableRoles],
  );

  function closeDialog() {
    if (busy) return;
    setOpen(false);
    setErrorMessage(null);
  }

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    emailRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        setOpen(false);
        setErrorMessage(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy]);

  async function submitInvite() {
    setBusy(true);
    setErrorMessage(null);

    try {
      const selectedRole = assignableRoles.find((role) => role.id === roleId) ?? null;
      const includeRole = selectedRole !== null && selectedRole.key !== "learner";
      await clientApi.post(
        "/api/v1/members/invite",
        {
          email: email.trim().toLowerCase(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          ...(includeRole ? { roleId: selectedRole.id } : {}),
        },
        "member-invite",
      );
      setEmail("");
      setDisplayName("");
      setRoleId(learnerRole?.id ?? "");
      setOpen(false);
      window.dispatchEvent(new CustomEvent(MEMBERS_LIST_REFRESH_EVENT));
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
          setRoleId(learnerRole?.id ?? "");
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <UserPlus className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Invite member
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
            onClick={closeDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/40 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--admin-primary)]/15 text-[var(--admin-primary)]">
                  <UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h2 id={titleId} className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Invite member
                  </h2>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Send a secure sign-up link to a new member.
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={closeDialog}
                className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitInvite();
              }}
            >
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label htmlFor="invite-email" className={labelClassName}>
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id="invite-email"
                      ref={emailRef}
                      type="email"
                      required
                      autoComplete="off"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                      placeholder="name@company.com"
                      className={fieldClassName}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="invite-display-name" className={labelClassName}>
                    Display name <span className="font-normal lowercase tracking-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <UserPlus
                      className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id="invite-display-name"
                      type="text"
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value);
                      }}
                      placeholder="e.g. Jordan Doe"
                      className={fieldClassName}
                    />
                  </div>
                </div>

                {assignableRoles.length > 0 ? (
                  <div>
                    <label htmlFor="invite-role" className={labelClassName}>
                      Role
                    </label>
                    <div className="relative">
                      <ShieldCheck
                        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <select
                        id="invite-role"
                        value={roleId}
                        onChange={(event) => {
                          setRoleId(event.target.value);
                        }}
                        className={`${fieldClassName} appearance-none pr-10`}
                      >
                        {assignableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)]/30 px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  The invite link expires {INVITE_EXPIRY_DAYS} days after it is sent.
                </p>

                {errorMessage ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-[var(--admin-danger)]/40 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
                  >
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)]/20 px-6 py-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeDialog}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-70"
                >
                  {busy ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
