"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

type AdminSpacesEditorProps = {
  initialSpaces: Array<{
    id: string;
    slug: string;
    name: string;
    visibility: "PRIVATE" | "TENANT" | "PUBLIC" | "UNLISTED";
  }>;
};

export function AdminSpacesEditor({ initialSpaces }: AdminSpacesEditorProps) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [visibility, setVisibility] =
    useState<AdminSpacesEditorProps["initialSpaces"][number]["visibility"]>("TENANT");
  const [error, setError] = useState<string | null>(null);

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
              setVisibility(
                event.target.value as AdminSpacesEditorProps["initialSpaces"][number]["visibility"],
              );
            }}
          >
            <option value="TENANT">Tenant</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
            <option value="UNLISTED">Unlisted</option>
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
                  onClick={() => void deleteSpace(space.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
