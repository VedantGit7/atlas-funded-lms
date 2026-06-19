"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { assessmentSummarySchema } from "../assessment-response-schemas";

type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

type AssessmentTableProps = {
  assessments: AssessmentSummary[];
};

export function AssessmentTable({ assessments }: AssessmentTableProps) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Title</th>
          <th className="py-2">Type</th>
          <th className="py-2">Status</th>
          <th className="py-2">Updated</th>
        </tr>
      </thead>
      <tbody>
        {assessments.map((assessment) => (
          <tr key={assessment.id} className="border-b">
            <td className="py-2">
              <Link href={`/studio/assessments/${assessment.id}`}>{assessment.title}</Link>
            </td>
            <td className="py-2">{assessment.assessmentType}</td>
            <td className="py-2">{assessment.status}</td>
            <td className="py-2">{new Date(assessment.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type CreateAssessmentDialogProps = {
  onCreated?: (assessment: AssessmentSummary) => void;
};

export function CreateAssessmentDialog({ onCreated }: CreateAssessmentDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: AssessmentSummary }>(
        "/api/v1/assessments",
        { title: title.trim(), assessmentType: "quiz", config: {} },
        "assessment-create",
      );
      onCreated?.(response.data);
      router.push(`/studio/assessments/${response.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Failed to create assessment.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded border p-4">
      <h2 className="font-medium">Create assessment</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            className="rounded border px-3 py-2"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            placeholder="Quiz title"
          />
        </label>
        <button
          type="button"
          className="rounded border px-4 py-2"
          disabled={creating || !title.trim()}
          onClick={() => {
            void handleCreate();
          }}
        >
          {creating ? "Creating..." : "Create"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
