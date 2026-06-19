"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createLearningPath,
  formatLearningPathApiError,
} from "../../../modules/learning-paths/learning-path.api-client";

type StudioLearningPathsPageProps = {
  paths: Array<{
    id: string;
    title: string;
    status: string;
    pathType: string;
    updatedAt: string;
  }>;
};

export function LearningPathManager({ paths }: StudioLearningPathsPageProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pathType, setPathType] = useState<"roadmap" | "program">("program");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);

    try {
      const created = await createLearningPath({ title, pathType });
      router.push(`/studio/learning-paths/${created.data.id}`);
      router.refresh();
    } catch (createError) {
      setError(formatLearningPathApiError(createError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded border p-4 space-y-3">
        <h2>Create learning path</h2>
        {error ? <p role="alert">{error}</p> : null}
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded border px-3 py-2"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            placeholder="Path title"
          />
          <select
            className="rounded border px-3 py-2"
            value={pathType}
            onChange={(event) => {
              setPathType(event.target.value as "roadmap" | "program");
            }}
          >
            <option value="program">Program</option>
            <option value="roadmap">Roadmap</option>
          </select>
          <button
            type="button"
            onClick={() => {
              void handleCreate();
            }}
            disabled={busy || !title.trim()}
          >
            {busy ? "Creating..." : "Create path"}
          </button>
        </div>
      </section>

      {paths.length === 0 ? (
        <div className="rounded border p-6">
          <p>No learning paths yet.</p>
        </div>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b py-2">Title</th>
              <th className="border-b py-2">Type</th>
              <th className="border-b py-2">Status</th>
              <th className="border-b py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {paths.map((path) => (
              <tr key={path.id}>
                <td className="border-b py-2">
                  <Link href={`/studio/learning-paths/${path.id}`} className="underline">
                    {path.title}
                  </Link>
                </td>
                <td className="border-b py-2">{path.pathType}</td>
                <td className="border-b py-2">{path.status}</td>
                <td className="border-b py-2">{new Date(path.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
