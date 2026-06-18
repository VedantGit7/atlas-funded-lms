"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { z } from "zod";
import type { studioModuleOutlineItemSchema } from "../../../server/courses/course-authoring-schemas";

type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type CourseModuleTreeProps = {
  courseId: string;
  modules: ModuleItem[];
  editable: boolean;
  onChanged: (modules: ModuleItem[]) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Module action failed.";
}

export function CourseModuleTree({
  courseId,
  modules,
  editable,
  onChanged,
}: CourseModuleTreeProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  async function refreshModules() {
    const response = await clientApi.get<{ data: { items: ModuleItem[] } }>(
      `/api/v1/courses/${courseId}/modules?view=studio`,
    );
    onChanged(response.data.items);
  }

  async function createModule() {
    if (!editable || !newTitle.trim()) return;
    setBusyId("create");
    setError(null);
    try {
      await clientApi.post(
        `/api/v1/courses/${courseId}/modules`,
        { title: newTitle.trim() },
        "module-create",
      );
      setNewTitle("");
      await refreshModules();
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setBusyId(null);
    }
  }

  async function saveModule(moduleId: string) {
    if (!editable) return;
    setBusyId(moduleId);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/modules/${moduleId}`,
        { title: editingTitle.trim() },
        "module-update",
      );
      setEditingId(null);
      await refreshModules();
    } catch (updateError) {
      setError(formatError(updateError));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteModule(moduleId: string) {
    if (!editable || !window.confirm("Delete this module?")) return;
    setBusyId(moduleId);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/modules/${moduleId}`, "module-delete");
      await refreshModules();
    } catch (deleteError) {
      setError(formatError(deleteError));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded border p-4">
      <header>
        <h2>Modules</h2>
        <p className="text-sm opacity-80">
          Organize course sections. Lesson editing is not available in this story.
        </p>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <ol className="space-y-2">
        {modules.map((module) => (
          <li key={module.id} className="rounded border p-3">
            {editingId === module.id ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1"
                  value={editingTitle}
                  onChange={(event) => {
                    setEditingTitle(event.target.value);
                  }}
                  disabled={busyId === module.id}
                />
                <button
                  type="button"
                  onClick={() => {
                    void saveModule(module.id);
                  }}
                  disabled={busyId === module.id}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {module.position}. {module.title}
                  </div>
                  <div className="text-xs opacity-70">{module.lessonCount} lesson(s)</div>
                </div>
                {editable ? (
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(module.id);
                        setEditingTitle(module.title);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteModule(module.id);
                      }}
                      disabled={busyId === module.id}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ol>

      {editable ? (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="New module title"
            value={newTitle}
            onChange={(event) => {
              setNewTitle(event.target.value);
            }}
            disabled={busyId === "create"}
          />
          <button
            type="button"
            onClick={() => {
              void createModule();
            }}
            disabled={busyId === "create" || !newTitle.trim()}
          >
            Add module
          </button>
        </div>
      ) : null}
    </section>
  );
}
