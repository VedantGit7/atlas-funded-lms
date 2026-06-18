"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

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
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void saveProfile();
      }}
    >
      <label>
        Display name
        <input
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
        />
      </label>
      <label>
        Bio
        <textarea
          value={bio}
          onChange={(event) => {
            setBio(event.target.value);
          }}
        />
      </label>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={busy}>
        Save profile
      </button>
    </form>
  );
}
