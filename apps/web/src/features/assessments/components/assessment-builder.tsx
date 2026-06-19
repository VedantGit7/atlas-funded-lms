"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { assessmentDetailSchema } from "../assessment-response-schemas";

type AssessmentDetail = z.infer<typeof assessmentDetailSchema>;
type ItemOption = {
  id: string;
  itemTypeKey: string;
  contentJson: Record<string, unknown>;
};

type AssessmentBuilderProps = {
  initialAssessment: AssessmentDetail;
  availableItems: ItemOption[];
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function AssessmentBuilder({ initialAssessment, availableItems }: AssessmentBuilderProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState(initialAssessment);
  const [title, setTitle] = useState(assessment.title);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [attemptsAllowed, setAttemptsAllowed] = useState(assessment.config.attemptsAllowed);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(
    assessment.config.timeLimitSeconds?.toString() ?? "",
  );
  const [passMarkPercent, setPassMarkPercent] = useState(assessment.config.passMarkPercent);
  const [shuffleItems, setShuffleItems] = useState(assessment.config.shuffleItems);
  const [secureMode, setSecureMode] = useState(assessment.config.secureMode);
  const [l1ProctoringEnabled, setL1ProctoringEnabled] = useState(
    assessment.config.l1ProctoringEnabled,
  );
  const [selectedItemId, setSelectedItemId] = useState(availableItems[0]?.id ?? "");
  const [items, setItems] = useState(assessment.items);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = assessment.status === "DRAFT" || assessment.status === "REVIEW";
  const nextPosition = useMemo(
    () => (items.length > 0 ? Math.max(...items.map((item) => item.position)) + 1 : 1),
    [items],
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await clientApi.put<{ data: AssessmentDetail }>(
        `/api/v1/assessments/${assessment.id}`,
        {
          title,
          description: description || null,
          config: {
            attemptsAllowed,
            ...(timeLimitSeconds ? { timeLimitSeconds: Number(timeLimitSeconds) } : {}),
            passMarkPercent,
            shuffleItems,
            secureMode,
            l1ProctoringEnabled,
            showAnswersPolicy: assessment.config.showAnswersPolicy,
          },
          items: items.map((item) => ({
            itemId: item.itemId,
            position: item.position,
            points: item.points,
            required: item.required,
          })),
        },
        "assessment-save",
      );
      setAssessment(response.data);
      setItems(response.data.items);
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    if (!window.confirm("Submit this assessment for review?")) return;
    setPublishing(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: { status: AssessmentDetail["status"] } }>(
        `/api/v1/assessments/${assessment.id}/publish`,
        {},
        "assessment-publish",
      );
      setAssessment((current) => ({ ...current, status: response.data.status }));
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this assessment?")) return;
    setDeleting(true);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/assessments/${assessment.id}`, "assessment-delete");
      router.push("/studio/assessments");
      router.refresh();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setDeleting(false);
    }
  }

  function addItem() {
    if (!selectedItemId) return;
    if (items.some((item) => item.itemId === selectedItemId)) {
      setError("Item already added to assessment.");
      return;
    }

    const source = availableItems.find((item) => item.id === selectedItemId);
    if (!source) return;

    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemId: source.id,
        position: nextPosition,
        points: 1,
        required: true,
        itemTypeKey: source.itemTypeKey,
        contentJson: source.contentJson,
      },
    ]);
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-600">Status: {assessment.status}</p>
            <h1 className="text-2xl font-semibold">{assessment.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable ? (
              <button
                type="button"
                className="rounded border px-4 py-2"
                disabled={saving}
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            ) : null}
            {assessment.status === "DRAFT" ? (
              <button
                type="button"
                className="rounded border px-4 py-2"
                disabled={publishing}
                onClick={() => {
                  void handleSubmitForReview();
                }}
              >
                {publishing ? "Submitting..." : "Submit for review"}
              </button>
            ) : null}
            {editable ? (
              <button
                type="button"
                className="rounded border px-4 py-2"
                disabled={deleting}
                onClick={() => {
                  void handleDelete();
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </header>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="rounded border p-4">
          <h2 className="font-medium">Assessment items</h2>
          {editable ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                className="rounded border px-3 py-2"
                value={selectedItemId}
                onChange={(event) => {
                  setSelectedItemId(event.target.value);
                }}
              >
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemTypeKey}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded border px-3 py-2" onClick={addItem}>
                Add item
              </button>
            </div>
          ) : null}
          <ol className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={`${item.itemId}-${String(item.position)}`} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>
                    #{String(item.position)} · {item.itemTypeKey ?? "item"}
                  </strong>
                  {editable ? (
                    <label className="text-sm">
                      Points
                      <input
                        className="ml-2 w-20 rounded border px-2 py-1"
                        type="number"
                        min={0}
                        value={item.points}
                        onChange={(event) => {
                          const points = Number(event.target.value);
                          setItems((current) =>
                            current.map((entry) =>
                              entry.itemId === item.itemId ? { ...entry, points } : entry,
                            ),
                          );
                        }}
                      />
                    </label>
                  ) : (
                    <span className="text-sm">{item.points} pts</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No items added yet.</p>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded border p-4">
          <h2 className="font-medium">Metadata</h2>
          <div className="mt-3 space-y-3">
            <label className="flex flex-col gap-1 text-sm">
              Title
              <input
                className="rounded border px-3 py-2"
                value={title}
                disabled={!editable}
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Description
              <textarea
                className="rounded border px-3 py-2"
                value={description}
                disabled={!editable}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Attempts allowed
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={1}
                value={attemptsAllowed}
                disabled={!editable}
                onChange={(event) => {
                  setAttemptsAllowed(Number(event.target.value));
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Time limit (seconds)
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={60}
                value={timeLimitSeconds}
                disabled={!editable}
                onChange={(event) => {
                  setTimeLimitSeconds(event.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Pass mark (%)
              <input
                className="rounded border px-3 py-2"
                type="number"
                min={0}
                max={100}
                value={passMarkPercent}
                disabled={!editable}
                onChange={(event) => {
                  setPassMarkPercent(Number(event.target.value));
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shuffleItems}
                disabled={!editable}
                onChange={(event) => {
                  setShuffleItems(event.target.checked);
                }}
              />
              Shuffle items
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={secureMode}
                disabled={!editable}
                onChange={(event) => {
                  setSecureMode(event.target.checked);
                }}
              />
              Secure mode
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={l1ProctoringEnabled}
                disabled={!editable}
                onChange={(event) => {
                  setL1ProctoringEnabled(event.target.checked);
                }}
              />
              L1 proctoring
            </label>
          </div>
        </div>
      </aside>
    </div>
  );
}
