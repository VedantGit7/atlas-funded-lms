"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  TENANT: "Academy members",
  PUBLIC: "Public",
  PRIVATE: "Private",
  UNLISTED: "Unlisted (link only)",
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Trading Q&A" as "trading-q-a". */
export function spaceSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
}

/**
 * The server's rules, checked before sending so a bad web address is
 * explained beside the field instead of failing after a round trip (QA
 * review 2 H33: an invalid slug failed silently).
 */
export function spaceFormProblem(slug: string, name: string): string | null {
  if (!name.trim()) return "Give the space a name.";
  if (slug.length < 2) return "The web address needs at least 2 characters.";
  if (slug.length > 64) return "The web address can be at most 64 characters.";
  if (!SLUG_PATTERN.test(slug)) {
    return "The web address can use only lowercase letters, numbers and single hyphens, like trading-questions.";
  }
  return null;
}

const fieldLabelClassName = "flex flex-col gap-1 text-sm font-medium";

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
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editName, setEditName] = useState("");
  const [editVisibility, setEditVisibility] = useState<SpaceVisibility>("TENANT");
  const cancelRef = useRef<HTMLButtonElement>(null);

  const createSpaceMutation = useMutation({
    mutationFn: async () => {
      const response = await clientApi.post<{
        data: AdminSpacesEditorProps["initialSpaces"][number];
      }>("/api/v1/spaces", { slug, name, visibility }, "community-space-create");
      return response.data;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (created) => {
      setSpaces((current) => [...current, created]);
      setSlug("");
      setName("");
      setSlugEdited(false);
    },
    onError: (err) => {
      setError(err instanceof ClientApiError ? err.message : "The space couldn't be created.");
    },
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: async (id: string) => {
      await clientApi.delete("/api/v1/spaces", "community-space-delete", { id, confirm: true });
      return id;
    },
    onMutate: (id) => {
      setListError(null);
      const previous = spaces;
      setSpaces((current) => current.filter((space) => space.id !== id));
      setPendingDeleteId(null);
      if (editingId === id) {
        setEditingId(null);
      }
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        setSpaces(context.previous);
      }
      setListError(err instanceof ClientApiError ? err.message : "The space couldn't be deleted.");
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error("No space selected for edit.");
      }
      const response = await clientApi.put<{
        data: AdminSpacesEditorProps["initialSpaces"][number];
      }>(
        "/api/v1/spaces",
        {
          id: editingId,
          slug: editSlug,
          name: editName,
          visibility: editVisibility,
        },
        `community-space-update-${editingId}`,
      );
      return response.data;
    },
    onMutate: () => {
      setEditError(null);
    },
    onSuccess: (updated) => {
      setSpaces((current) => current.map((space) => (space.id === updated.id ? updated : space)));
      setEditingId(null);
    },
    onError: (err) => {
      setEditError(
        err instanceof ClientApiError
          ? err.message
          : "Your changes to the space couldn't be saved.",
      );
    },
  });

  useEffect(() => {
    if (pendingDeleteId) {
      cancelRef.current?.focus();
    }
  }, [pendingDeleteId]);

  function createSpace() {
    if (createSpaceMutation.isPending) return;
    const problem = spaceFormProblem(slug, name);
    if (problem) {
      setError(problem);
      return;
    }
    createSpaceMutation.mutate();
  }

  function deleteSpace(id: string) {
    if (deleteSpaceMutation.isPending) return;
    deleteSpaceMutation.mutate(id);
  }

  function startEdit(space: AdminSpacesEditorProps["initialSpaces"][number]) {
    setEditingId(space.id);
    setEditSlug(space.slug);
    setEditName(space.name);
    setEditVisibility(space.visibility);
    setEditError(null);
  }

  function saveEdit() {
    if (!editingId || saveEditMutation.isPending) return;
    const problem = spaceFormProblem(editSlug, editName);
    if (problem) {
      setEditError(problem);
      return;
    }
    saveEditMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Create space</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className={fieldLabelClassName}>
            Name
            <input
              className="rounded border px-3 py-2 text-sm font-normal"
              placeholder="Trading questions"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(spaceSlugFromName(event.target.value));
              }}
            />
          </label>
          <label className={fieldLabelClassName}>
            Web address
            <input
              className="rounded border px-3 py-2 text-sm font-normal"
              placeholder="trading-questions"
              aria-describedby="space-slug-help"
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
            />
            <span id="space-slug-help" className="text-xs font-normal text-muted-foreground">
              Lowercase letters, numbers and hyphens. Filled in from the name.
            </span>
          </label>
          <label className={fieldLabelClassName}>
            Who can see it
            <select
              className="rounded border px-3 py-2 text-sm font-normal"
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
          </label>
        </div>
        <button
          type="button"
          className="rounded border px-4 py-2 text-sm"
          disabled={createSpaceMutation.isPending}
          onClick={() => {
            createSpace();
          }}
        >
          {createSpaceMutation.isPending ? "Creating…" : "Create space"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-destructive-text">
            {error}
          </p>
        ) : null}
      </section>

      {listError ? (
        <p role="alert" className="text-sm text-destructive-text">
          {listError}
        </p>
      ) : null}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Web address</th>
            <th className="py-2">Who can see it</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => (
            <tr key={space.id} className="border-b">
              <td className="py-2">{space.name}</td>
              <td className="py-2">{space.slug}</td>
              <td className="py-2">{VISIBILITY_LABELS[space.visibility]}</td>
              <td className="py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      startEdit(space);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setPendingDeleteId(space.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId ? (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Edit space</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className={fieldLabelClassName}>
              Name
              <input
                className="rounded border px-3 py-2 text-sm font-normal"
                value={editName}
                onChange={(event) => {
                  setEditName(event.target.value);
                }}
              />
            </label>
            <label className={fieldLabelClassName}>
              Web address
              <input
                className="rounded border px-3 py-2 text-sm font-normal"
                value={editSlug}
                onChange={(event) => {
                  setEditSlug(event.target.value);
                }}
              />
            </label>
            <label className={fieldLabelClassName}>
              Who can see it
              <select
                className="rounded border px-3 py-2 text-sm font-normal"
                value={editVisibility}
                onChange={(event) => {
                  setEditVisibility(event.target.value as SpaceVisibility);
                }}
              >
                {(["TENANT", "PUBLIC", "PRIVATE", "UNLISTED"] as const).map((option) => (
                  <option key={option} value={option}>
                    {VISIBILITY_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {editError ? (
            <p role="alert" className="text-sm text-destructive-text">
              {editError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              disabled={saveEditMutation.isPending}
              onClick={saveEdit}
            >
              {saveEditMutation.isPending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              onClick={() => {
                setEditingId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {pendingDeleteId ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="space-delete-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-lg">
            <h2 id="space-delete-confirm-title" className="font-semibold">
              Delete community space
            </h2>
            <p className="mt-2 text-sm">
              Delete this space? Learners will no longer see it in the community.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              <button
                type="button"
                className="rounded bg-destructive px-3 py-2 text-sm text-destructive-foreground"
                onClick={() => {
                  deleteSpace(pendingDeleteId);
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
