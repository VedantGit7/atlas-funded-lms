"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type CommunityHubProps = {
  spaces: Array<{
    id: string;
    slug: string;
    name: string;
    visibility: string;
    isMember: boolean;
    postCount?: number | undefined;
  }>;
};

export function CommunityHub({ spaces }: CommunityHubProps) {
  const [items, setItems] = useState(spaces);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function joinSpace(spaceId: string) {
    setJoiningId(spaceId);
    setError(null);

    try {
      await clientApi.post(`/api/v1/spaces/${spaceId}/join`, {}, "community-join");
      setItems((current) =>
        current.map((space) => (space.id === spaceId ? { ...space, isMember: true } : space)),
      );
    } catch (err) {
      const message =
        err instanceof ClientApiError ? err.message : "Unable to join this space right now.";
      setError(message);
    } finally {
      setJoiningId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm opacity-80">No community spaces are available yet.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((space) => (
          <li key={space.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{space.name}</h2>
                <p className="text-xs uppercase tracking-wide opacity-60">{space.visibility}</p>
                {space.postCount !== undefined ? (
                  <p className="mt-1 text-sm opacity-80">{space.postCount} posts</p>
                ) : null}
              </div>
              {space.isMember ? (
                <Link href={`/community/spaces/${space.id}`} className="text-sm underline">
                  Open
                </Link>
              ) : (
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm"
                  disabled={joiningId === space.id}
                  onClick={() => void joinSpace(space.id)}
                >
                  {joiningId === space.id ? "Joining…" : "Join"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
