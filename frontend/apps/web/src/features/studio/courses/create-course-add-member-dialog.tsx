"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mail, X } from "lucide-react";
import type { MembersListResponse } from "@atlas/contracts/membership/schemas/admin-members";
import type { RoleListResponse } from "@atlas/contracts/domain-access/schemas/access-admin";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { RoleToggle } from "./admin-form-dropdown-shared";
import {
  dialogLabelClassName,
  fieldClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./create-course-dialog-shared";

type AddNewMemberDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultRoleKey?: "learner" | "instructor" | "moderator" | "evaluator";
  onMemberInvited: (member: {
    membershipId: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  }) => void | Promise<void>;
};

type RoleToggleConfig = {
  key: string;
  label: string;
  roleId: string | null;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to add member.";
}

export function AddNewMemberDialog({
  open,
  onClose,
  defaultRoleKey = "instructor",
  onMemberInvited,
}: AddNewMemberDialogProps) {
  const titleId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleToggles, setRoleToggles] = useState<Record<string, boolean>>({});
  const [roleOptions, setRoleOptions] = useState<RoleToggleConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadRoles() {
      try {
        const response = await clientApi.get<RoleListResponse>("/api/v1/roles?limit=100");
        if (cancelled) return;

        const byKey = new Map(response.data.items.map((role) => [role.key, role]));
        const configs: RoleToggleConfig[] = [
          { key: "learner", label: "Student", roleId: byKey.get("learner")?.id ?? null },
          {
            key: "instructor",
            label: "Course Creator",
            roleId: byKey.get("instructor")?.id ?? null,
          },
          { key: "moderator", label: "Moderator", roleId: byKey.get("moderator")?.id ?? null },
          {
            key: "evaluator",
            label: "Evaluator",
            roleId:
              response.data.items.find((role) => role.key.includes("evaluat"))?.id ??
              byKey.get("instructor")?.id ??
              null,
          },
        ].filter((config) => config.roleId !== null);

        setRoleOptions(configs);
        setRoleToggles(
          Object.fromEntries(configs.map((config) => [config.key, config.key === defaultRoleKey])),
        );
      } catch {
        if (!cancelled) {
          setRoleOptions([]);
        }
      }
    }

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [open, defaultRoleKey]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      emailRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused.current?.focus();
    };
  }, [open, busy]);

  function handleClose() {
    if (busy) return;
    setEmail("");
    setFirstName("");
    setLastName("");
    setError(null);
    onClose();
  }

  function pickRoleId(): string | undefined {
    const priority = ["instructor", "moderator", "evaluator", "learner"];
    for (const key of priority) {
      if (roleToggles[key]) {
        const match = roleOptions.find((option) => option.key === key);
        if (match?.roleId) return match.roleId;
      }
    }
    return roleOptions.find((option) => option.key === "learner")?.roleId ?? undefined;
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);

    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const roleId = pickRoleId();

    try {
      const response = await clientApi.post<{
        data: { id: string; invitedEmail: string };
      }>(
        "/api/v1/members/invite",
        {
          email: email.trim().toLowerCase(),
          ...(displayName ? { displayName } : {}),
          ...(roleId ? { roleId } : {}),
        },
        "member-invite",
      );

      await onMemberInvited({
        membershipId: response.data.id,
        displayName: displayName || email.trim(),
        email: response.data.invitedEmail,
        avatarUrl: null,
      });
      handleClose();
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
            Add New Member
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div
          className="space-y-5 px-6 py-6"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy && email.trim().length > 0) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        >
          <div>
            <label htmlFor="add-member-email" className={dialogLabelClassName}>
              Email <span className="text-[var(--admin-danger)]">*</span>
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                id="add-member-email"
                ref={emailRef}
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
                disabled={busy}
                placeholder="jane@doe.com"
                className={`${fieldClassName} rounded-xl py-2.5 pl-10`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="add-member-first-name" className={dialogLabelClassName}>
                First Name
              </label>
              <input
                id="add-member-first-name"
                type="text"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                }}
                disabled={busy}
                placeholder="Jane"
                className={`${fieldClassName} rounded-xl py-2.5`}
              />
            </div>
            <div>
              <label htmlFor="add-member-last-name" className={dialogLabelClassName}>
                Last Name
              </label>
              <input
                id="add-member-last-name"
                type="text"
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                }}
                disabled={busy}
                placeholder="Doe"
                className={`${fieldClassName} rounded-xl py-2.5`}
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-[var(--admin-on-surface)]">Roles</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <RoleToggle
                  key={role.key}
                  label={role.label}
                  checked={roleToggles[role.key] ?? false}
                  disabled={busy}
                  onChange={(checked) => {
                    setRoleToggles((current) => ({ ...current, [role.key]: checked }));
                  }}
                />
              ))}
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end border-t border-[var(--admin-border)] pt-5">
            <button
              type="button"
              disabled={busy || email.trim().length === 0}
              onClick={() => {
                void handleSubmit();
              }}
              className={primaryButtonClassName}
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type InstructorMember = {
  membershipId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status?: MembersListResponse["data"]["items"][number]["status"];
};

function mapMemberListItemToInstructor(
  member: MembersListResponse["data"]["items"][number],
): InstructorMember {
  const email = member.accountEmail ?? member.invitedEmail ?? "";
  const displayName = member.profile?.displayName?.trim() || email.split("@")[0] || "Member";
  return {
    membershipId: member.id,
    displayName,
    email,
    avatarUrl: member.profile?.avatarUrl ?? null,
    status: member.status,
  };
}

export async function loadInstructorMembers(): Promise<InstructorMember[]> {
  try {
    const response = await clientApi.get<MembersListResponse>("/api/v1/members?limit=100");

    return response.data.items
      .map(mapMemberListItemToInstructor)
      .filter((member) => member.email.length > 0 || member.displayName.length > 0);
  } catch {
    const me = await clientApi.get<{
      data: {
        membership: { id: string };
        profile: { displayName: string | null; avatarUrl: string | null } | null;
        identity: { email: string | null };
      };
    }>("/api/v1/me");

    const email = me.data.identity.email ?? "";
    return [
      {
        membershipId: me.data.membership.id,
        displayName: me.data.profile?.displayName?.trim() || "You",
        email,
        avatarUrl: me.data.profile?.avatarUrl ?? null,
      },
    ];
  }
}
