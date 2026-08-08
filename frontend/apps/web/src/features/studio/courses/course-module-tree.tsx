"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioModuleOutlineItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { builderHelperClassName } from "./course-builder-shared";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { DeleteModuleDialog } from "./delete-module-dialog";

type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;
type LessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;

type CourseModuleTreeProps = {
  courseId: string;
  modules: ModuleItem[];
  editable: boolean;
  selectedModuleId: string | null;
  onSelectModule: (moduleId: string) => void;
  onChanged: (modules: ModuleItem[]) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Module action failed.";
}

function initialExpandedIds(
  modules: ModuleItem[],
  selectedModuleId: string | null,
): Set<string> {
  const ids = new Set<string>();
  const selected = selectedModuleId ?? modules[0]?.id;
  if (selected) ids.add(selected);
  return ids;
}

export function CourseModuleTree({
  courseId,
  modules,
  editable,
  selectedModuleId,
  onSelectModule,
  onChanged,
}: CourseModuleTreeProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [addingLessonModuleId, setAddingLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(() =>
    initialExpandedIds(modules, selectedModuleId),
  );
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, LessonOutlineItem[]>>({});
  const [lessonsLoadingIds, setLessonsLoadingIds] = useState<Set<string>>(new Set());
  const lessonsByModuleRef = useRef(lessonsByModule);
  lessonsByModuleRef.current = lessonsByModule;

  const loadModuleLessons = useCallback(async (moduleId: string, force = false) => {
    if (!force && lessonsByModuleRef.current[moduleId] !== undefined) return;

    setLessonsLoadingIds((current) => new Set([...current, moduleId]));
    try {
      const response = await clientApi.get<{ data: { items: LessonOutlineItem[] } }>(
        `/api/v1/modules/${moduleId}/lessons?view=studio`,
      );
      setLessonsByModule((current) => ({ ...current, [moduleId]: response.data.items }));
    } catch {
      setLessonsByModule((current) => ({ ...current, [moduleId]: [] }));
    } finally {
      setLessonsLoadingIds((current) => {
        const next = new Set(current);
        next.delete(moduleId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!selectedModuleId) return;
    setExpandedModuleIds((current) => new Set([...current, selectedModuleId]));
  }, [selectedModuleId]);

  useEffect(() => {
    for (const moduleId of expandedModuleIds) {
      void loadModuleLessons(moduleId);
    }
  }, [expandedModuleIds, loadModuleLessons]);

  async function refreshModules() {
    const response = await clientApi.get<{ data: { items: ModuleItem[] } }>(
      `/api/v1/courses/${courseId}/modules?view=studio`,
    );
    setLessonsByModule({});
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

  function handleModuleDeleted(moduleId: string) {
    if (selectedModuleId === moduleId) {
      onSelectModule(modules.find((m) => m.id !== moduleId)?.id ?? "");
    }
    setExpandedModuleIds((current) => {
      const next = new Set(current);
      next.delete(moduleId);
      return next;
    });
    setLessonsByModule((current) => {
      const next = { ...current };
      delete next[moduleId];
      return next;
    });
    void refreshModules();
  }

  async function createLessonForModule(moduleId: string) {
    if (!editable || !newLessonTitle.trim()) return;
    setBusyId(moduleId);
    setError(null);
    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        `/api/v1/modules/${moduleId}/lessons`,
        { title: newLessonTitle.trim() },
        "lesson-create",
      );
      setAddingLessonModuleId(null);
      setNewLessonTitle("");
      await loadModuleLessons(moduleId, true);
      router.push(`/studio/courses/${courseId}/lessons/${response.data.id}`);
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setBusyId(null);
    }
  }

  function cancelAddLesson() {
    setAddingLessonModuleId(null);
    setNewLessonTitle("");
  }

  function selectModule(moduleId: string) {
    onSelectModule(moduleId);
    setExpandedModuleIds((current) => new Set([...current, moduleId]));
  }

  function toggleModuleExpanded(moduleId: string) {
    setExpandedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Course Modules
          </span>
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-surface-high)] px-1.5 text-[10px] font-bold text-[var(--admin-on-surface-variant)]">
            {modules.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error ? (
          <p role="alert" className="mb-3 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}

        <ol className="space-y-2">
          {modules.map((module) => {
            const active = module.id === selectedModuleId;
            const isDragging = draggingId === module.id;
            const isExpanded = expandedModuleIds.has(module.id);
            const moduleLessons = lessonsByModule[module.id];
            const isLoadingLessons = lessonsLoadingIds.has(module.id);

            return (
              <li
                key={module.id}
                className={[
                  "group rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 transition-[opacity,box-shadow,border-color] duration-150",
                  active ? "border-l-4 border-l-[var(--admin-primary)] shadow-sm" : "",
                  isDragging ? "opacity-50" : "",
                ].join(" ")}
              >
                {editingId === module.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                      value={editingTitle}
                      onChange={(event) => {
                        setEditingTitle(event.target.value);
                      }}
                      disabled={busyId === module.id}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)]"
                        onClick={() => {
                          void saveModule(module.id);
                        }}
                        disabled={busyId === module.id}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                        onClick={() => {
                          setEditingId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-label={`Reorder ${module.title}`}
                      disabled={!editable}
                      className="drag-handle mt-0.5 shrink-0 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-outline)] disabled:opacity-40"
                      onMouseDown={() => {
                        setDraggingId(module.id);
                      }}
                      onMouseUp={() => {
                        setDraggingId(null);
                      }}
                      onMouseLeave={() => {
                        setDraggingId(null);
                      }}
                    >
                      <GripVertical className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      aria-label={isExpanded ? `Collapse ${module.title}` : `Expand ${module.title}`}
                      aria-expanded={isExpanded}
                      className="mt-0.5 shrink-0 rounded p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        toggleModuleExpanded(module.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            selectModule(module.id);
                          }}
                        >
                          <span
                            className={[
                              "block text-sm text-[var(--admin-on-surface)]",
                              active ? "font-semibold" : "font-medium",
                            ].join(" ")}
                          >
                            {module.title}
                          </span>
                          {!isExpanded ? (
                            <span className={builderHelperClassName}>
                              {module.lessonCount}{" "}
                              {module.lessonCount === 1 ? "lesson" : "lessons"}
                            </span>
                          ) : null}
                        </button>
                        {editable ? (
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label={`Edit ${module.title}`}
                              className="rounded p-1 text-[var(--admin-outline)] transition-colors hover:text-[var(--admin-primary)]"
                              onClick={() => {
                                setEditingId(module.id);
                                setEditingTitle(module.title);
                              }}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${module.title}`}
                              className="rounded p-1 text-[var(--admin-outline)] transition-colors hover:text-[var(--admin-danger)]"
                              onClick={() => {
                                setDeleteTarget({ id: module.id, title: module.title });
                              }}
                              disabled={busyId === module.id}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <div className="mt-2 border-l border-[var(--admin-border)] pl-3">
                          {isLoadingLessons && moduleLessons === undefined ? (
                            <p className={builderHelperClassName}>Loading lessons…</p>
                          ) : (moduleLessons?.length ?? 0) === 0 ? (
                            <p className={builderHelperClassName}>No lessons yet</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {moduleLessons?.map((lesson) => (
                                <li key={lesson.id}>
                                  <Link
                                    href={`/studio/courses/${courseId}/lessons/${lesson.id}`}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
                                  >
                                    <FileText
                                      className="h-3.5 w-3.5 shrink-0 text-[var(--admin-outline)]"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate text-[var(--admin-on-surface)]">
                                      {lesson.title}
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {editable && editingId !== module.id ? (
                  addingLessonModuleId === module.id ? (
                    <div
                      className={`mt-2 space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 ${inlineExpandClassName}`}
                    >
                      <label htmlFor={`lesson-title-${module.id}`} className="sr-only">
                        Lesson title
                      </label>
                      <input
                        id={`lesson-title-${module.id}`}
                        className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                        placeholder="Lesson title"
                        value={newLessonTitle}
                        onChange={(event) => {
                          setNewLessonTitle(event.target.value);
                        }}
                        disabled={busyId === module.id}
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createLessonForModule(module.id);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelAddLesson();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-50"
                          onClick={() => {
                            void createLessonForModule(module.id);
                          }}
                          disabled={busyId === module.id || !newLessonTitle.trim()}
                        >
                          {busyId === module.id ? "Adding…" : "Add lesson"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]"
                          onClick={cancelAddLesson}
                          disabled={busyId === module.id}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg border border-dashed border-[var(--admin-border)] py-1.5 text-xs font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                      onClick={() => {
                        setAddingLessonModuleId(module.id);
                        setNewLessonTitle("");
                        setExpandedModuleIds((current) => new Set([...current, module.id]));
                      }}
                      disabled={busyId === module.id}
                    >
                      + Add lesson
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
        </ol>

        {editable ? (
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              placeholder="New module title"
              value={newTitle}
              onChange={(event) => {
                setNewTitle(event.target.value);
              }}
              disabled={busyId === "create"}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createModule();
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                void createModule();
              }}
              disabled={busyId === "create" || !newTitle.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--admin-border)] py-2.5 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-all hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add module
            </button>
          </div>
        ) : null}
      </div>

      <DeleteModuleDialog
        open={deleteTarget != null}
        moduleId={deleteTarget?.id ?? null}
        moduleTitle={deleteTarget?.title ?? ""}
        onClose={() => {
          setDeleteTarget(null);
        }}
        onDeleted={() => {
          if (deleteTarget) {
            handleModuleDeleted(deleteTarget.id);
          }
        }}
      />
    </>
  );
}
