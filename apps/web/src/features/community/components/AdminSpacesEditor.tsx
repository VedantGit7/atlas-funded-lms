"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type SpaceVisibility = "PRIVATE" | "TENANT" | "PUBLIC" | "UNLISTED";

type AdminSpacesEditorProps = {
  initialSpaces: Array<{
    id: string;
    slug: string;
    name: string;
    visibility: SpaceVisibility;
  }>;
  allowedVisibilityOptions?: SpaceVisibility[];
};

const DEFAULT_VISIBILITY_OPTIONS: SpaceVisibility[] = ["TENANT", "PUBLIC"];

const VISIBILITY_LABELS: Record<SpaceVisibility, string> = {
  TENANT: "Tenant",
  PUBLIC: "Public",
  PRIVATE: "Private",
  UNLISTED: "Unlisted",
};

export function AdminSpacesEditor({
  initialSpaces,
  allowedVisibilityOptions = DEFAULT_VISIBILITY_OPTIONS,
}: AdminSpacesEditorProps) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<SpaceVisibility>(
    allowedVisibilityOptions[0] ?? "TENANT",
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pendingDeleteId) {
      cancelRef.current?.focus();
    }
  }, [pendingDeleteId]);

  async function createSpace() {
    setError(null);

    try {
      const response = await clientApi.post<{
        data: AdminSpacesEditorProps["initialSpaces"][number];
      }>("/api/v1/spaces", { slug, name, visibility }, "community-space-create");

      setSpaces((current) => [...current, response.data]);
      setSlug("");
      setName("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to create space.");
    }
  }

  async function deleteSpace(id: string) {
    setError(null);

    try {
      await clientApi.delete("/api/v1/spaces", "community-space-delete", { id, confirm: true });
      setSpaces((current) => current.filter((space) => space.id !== id));
      setPendingDeleteId(null);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to delete space.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Create space</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="slug"
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
            }}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value as SpaceVisibility);
            }}
          >
            {allowedVisibilityOptions.map((option) => (
              <option key={option} value={option}>
                {VISIBILITY_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm"
          onClick={() => void createSpace()}
        >
          Create space
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Slug</th>
            <th className="py-2">Visibility</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => (
            <tr key={space.id} className="border-b">
              <td className="py-2">{space.name}</td>
              <td className="py-2">{space.slug}</td>
              <td className="py-2">{space.visibility}</td>
              <td className="py-2">
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setPendingDeleteId(space.id);
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendingDeleteId ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="space-delete-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border bg-white p-4 shadow-lg">
            <h2 id="space-delete-confirm-title" className="font-semibold">
              Delete community space
            </h2>
            <p className="mt-2 text-sm">
              Confirm deleting this space. Existing posts remain preserved according to tenant
              policy.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <button
                type="button"
                className="rounded bg-red-700 px-3 py-2 text-sm text-white"
                onClick={() => {
                  void deleteSpace(pendingDeleteId);
                }}
              >
                Confirm delete
              </button>
              <button
                ref={cancelRef}
                type="button"
                className="rounded border px-3 py-2 text-sm"
                onClick={() => {
                  setPendingDeleteId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
