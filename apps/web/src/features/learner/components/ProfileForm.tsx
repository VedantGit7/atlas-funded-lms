"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type ProfileFormProps = {
  membershipId: string;
  initialDisplayName: string | null;
  initialBio: string | null;
};

function formatClientError(error: unknown): { message: string; requestId: string | null } {
  if (error instanceof ClientApiError) {
    return { message: error.message, requestId: error.requestId };
  }
  return { message: "Unable to update profile.", requestId: null };
}

export function ProfileForm({ membershipId, initialDisplayName, initialBio }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    setRequestId(null);
    try {
      await clientApi.put(
        `/api/v1/members/${membershipId}/profile`,
        {
          displayName: displayName.trim() || null,
          bio: bio.trim() || null,
        },
        "profile-update",
      );
      setMessage("Profile updated.");
      router.refresh();
    } catch (error) {
      const formatted = formatClientError(error);
      setMessage(formatted.message);
      setRequestId(formatted.requestId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4 rounded border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void saveProfile();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>Display name</span>
        <input
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
          className="rounded border px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Bio</span>
        <textarea
          value={bio}
          onChange={(event) => {
            setBio(event.target.value);
          }}
          rows={4}
          className="rounded border px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="rounded-md border px-4 py-2 text-sm font-medium"
        disabled={busy}
      >
        Save profile
      </button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
          {requestId ? ` Request ID: ${requestId}` : ""}
        </p>
      ) : null}
    </form>
  );
}
