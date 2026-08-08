"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { cardClassName, cardHeaderClassName, fieldClassName, labelClassName } from "./member-detail-shared";

type MemberProfileEditorProps = {
  membershipId: string;
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio?: string | null | undefined;
  } | null;
};

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function MemberProfileEditor({ membershipId, profile }: MemberProfileEditorProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function saveProfile() {
    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.put(
        `/api/v1/members/${membershipId}/profile`,
        {
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
        },
        "member-profile-update",
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardClassName}>
      <div className={cardHeaderClassName}>
        <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Profile Details</h2>
      </div>

      <form
        className="space-y-6 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile();
        }}
      >
        <div className="space-y-2">
          <label htmlFor="member-display-name" className={labelClassName}>
            Display Name
          </label>
          <input
            id="member-display-name"
            className={fieldClassName}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            placeholder="Member display name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="member-bio" className={labelClassName}>
            Bio
          </label>
          <textarea
            id="member-bio"
            rows={4}
            className={`${fieldClassName} resize-none`}
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
            }}
            placeholder="Short biography or internal notes about this member"
          />
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-[var(--admin-border)] pt-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}
