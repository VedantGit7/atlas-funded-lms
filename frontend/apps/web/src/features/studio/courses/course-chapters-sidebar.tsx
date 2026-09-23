"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import type { z } from "zod";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioModuleOutlineItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { AddChapterDialog } from "./add-chapter-dialog";
import { builderHelperClassName } from "./course-builder-shared";
import { courseDetailMutedTextClassName } from "./course-detail-shared";
import { DeleteModuleDialog } from "./delete-module-dialog";
import { DeleteLessonDialog } from "../lessons/delete-lesson-dialog";
import {
  formatSectionSummary,
  resolveLessonBadges,
  resolveLessonDisplayType,
  resolveLessonTypeOption,
  studioLessonUrl,
} from "./lesson-outline-meta";
import { MoveLessonSectionDialog } from "./move-lesson-section-dialog";

type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;
type LessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;

type CourseChaptersSidebarProps = {
  courseId: string;
  modules: ModuleItem[];
  editable: boolean;
  selectedLessonId?: string | null;
  addingLessonModuleId?: string | null;
  lessonsRefreshModuleId?: string | null;
  onChanged: (modules: ModuleItem[]) => void;
  onStartAddLesson: (moduleId: string, moduleTitle: string) => void;
  onSelectLesson: (moduleId: string, lessonId: string) => void;
  onLessonDeleted?: (moduleId: string, lessonId: string) => void;
  onLessonsRefreshed?: () => void;
};

type MoveLessonState = {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
} | null;

type DeleteModuleState = {
  moduleId: string;
  moduleTitle: string;
} | null;

type DeleteLessonState = {
  lessonId: string;
  moduleId: string;
  lessonTitle: string;
} | null;

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Chapter action failed.";
}

function LessonTypeIcon({ lesson }: { lesson: LessonOutlineItem }) {
  const displayType = resolveLessonDisplayType(lesson);
  const option = resolveLessonTypeOption(displayType);
  const Icon = option?.icon ?? BookOpen;
  const accentToken = option?.accentToken ?? "--admin-primary";

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{
        backgroundColor: `color-mix(in srgb, var(${accentToken}) 14%, var(--admin-surface))`,
        color: `var(${accentToken})`,
      }}
    >
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

function LessonStatusBadges({ lesson }: { lesson: LessonOutlineItem }) {
  const badges = resolveLessonBadges(lesson);
  if (badges.length === 0) return null;

  return (
    <div className="hidden shrink-0 items-center gap-1 sm:flex">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export function CourseChaptersSidebar({
  courseId,
  modules,
  editable,
  selectedLessonId = null,
  addingLessonModuleId = null,
  lessonsRefreshModuleId = null,
  onChanged,
  onStartAddLesson,
  onSelectLesson,
  onLessonDeleted,
  onLessonsRefreshed,
}: CourseChaptersSidebarProps) {
  const [error, setError] = useState<string | null>(null);
  const [addChapterOpen, setAddChapterOpen] = useState(false);
  const [deleteModuleState, setDeleteModuleState] = useState<DeleteModuleState>(null);
  const [deleteLessonState, setDeleteLessonState] = useState<DeleteLessonState>(null);
  const [moveLessonState, setMoveLessonState] = useState<MoveLessonState>(null);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
    () => new Set(modules[0]?.id ? [modules[0].id] : []),
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
    for (const moduleId of expandedModuleIds) {
      const module = modules.find((item) => item.id === moduleId);
      if (module?.contentKind === "scorm") continue;
      void loadModuleLessons(moduleId);
    }
  }, [expandedModuleIds, loadModuleLessons, modules]);

  useEffect(() => {
    if (!lessonsRefreshModuleId) return;
    void loadModuleLessons(lessonsRefreshModuleId, true).finally(() => {
      onLessonsRefreshed?.();
    });
  }, [lessonsRefreshModuleId, loadModuleLessons, onLessonsRefreshed]);

  async function refreshModules() {
    const response = await clientApi.get<{ data: { items: ModuleItem[] } }>(
      `/api/v1/courses/${courseId}/modules?view=studio`,
    );
    setLessonsByModule({});
    onChanged(response.data.items);
  }

  function handleChapterCreated(created: ModuleItem) {
    void refreshModules().then(() => {
      setExpandedModuleIds((current) => new Set([...current, created.id]));
    });
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

  async function copyLessonUrl(lessonId: string) {
    try {
      await navigator.clipboard.writeText(studioLessonUrl(courseId, lessonId));
    } catch {
      setError("Couldn't copy URL to clipboard.");
    }
  }

  async function moveLessonToBottom(moduleId: string, lesson: LessonOutlineItem) {
    const moduleLessons = lessonsByModule[moduleId] ?? [];
    const bottomPosition = moduleLessons.length;
    if (lesson.position === bottomPosition) return;

    setBusyLessonId(lesson.id);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/lessons/${lesson.id}`,
        { position: bottomPosition },
        "lesson-move-bottom",
      );
      await loadModuleLessons(moduleId, true);
      await refreshModules();
    } catch (moveError) {
      setError(formatError(moveError));
    } finally {
      setBusyLessonId(null);
    }
  }

  async function handleLessonDeletedFromSidebar(moduleId: string, lessonId: string) {
    await loadModuleLessons(moduleId, true);
    await refreshModules();
    onLessonDeleted?.(moduleId, lessonId);
  }

  function lessonMenuItems(
    module: ModuleItem,
    lesson: LessonOutlineItem,
    moduleLessons: LessonOutlineItem[],
  ): DropdownMenuItem[] {
    const disabled = busyLessonId === lesson.id || !editable;
    const bottomPosition = moduleLessons.length;

    return [
      {
        key: "move-section",
        label: "Move To Another Section",
        icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
        disabled: disabled || modules.length < 2,
        onSelect: () => {
          setMoveLessonState({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            moduleId: module.id,
          });
        },
      },
      {
        key: "copy-url",
        label: "Copy URL",
        icon: <Copy className="h-4 w-4" aria-hidden="true" />,
        disabled,
        onSelect: () => {
          void copyLessonUrl(lesson.id);
        },
      },
      {
        key: "add-next",
        label: "Add Next Lesson",
        icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        disabled,
        onSelect: () => {
          onStartAddLesson(module.id, module.title);
        },
      },
      {
        key: "move-bottom",
        label: "Move To Bottom",
        icon: <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />,
        disabled: disabled || lesson.position === bottomPosition,
        onSelect: () => {
          void moveLessonToBottom(module.id, lesson);
        },
      },
      {
        key: "trash",
        label: "Move To Trash",
        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
        destructive: true,
        disabled,
        onSelect: () => {
          setDeleteLessonState({
            lessonId: lesson.id,
            moduleId: module.id,
            lessonTitle: lesson.title,
          });
        },
      },
    ];
  }

  function sectionMenuItems(module: ModuleItem): DropdownMenuItem[] {
    return [
      {
        key: "add-lesson",
        label: "Add lesson",
        icon: <Plus className="h-4 w-4" aria-hidden="true" />,
        disabled: !editable || module.contentKind === "scorm",
        onSelect: () => {
          onStartAddLesson(module.id, module.title);
        },
      },
      {
        key: "delete-section",
        label: "Delete section",
        icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
        destructive: true,
        disabled: !editable,
        onSelect: () => {
          setDeleteModuleState({ moduleId: module.id, moduleTitle: module.title });
        },
      },
    ];
  }

  const hasChapters = modules.length > 0;

  return (
    <>
      <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Chapters</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {error ? (
          <p role="alert" className="px-4 py-3 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}

        {!hasChapters ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
              <BookOpen className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[var(--admin-on-surface)]">No chapters yet</p>
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  setAddChapterOpen(true);
                }}
                className="mt-4 inline-flex w-full max-w-xs items-center justify-center gap-1.5 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-4 py-2.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Section
              </button>
            ) : (
              <p className={`${courseDetailMutedTextClassName} mt-2`}>
                Chapters will appear here when added.
              </p>
            )}
          </div>
        ) : (
          <ol className="divide-y divide-[var(--admin-border)]">
            {modules.map((module, moduleIndex) => {
              const isScorm = module.contentKind === "scorm";
              const isExpanded = expandedModuleIds.has(module.id);
              const moduleLessons = lessonsByModule[module.id];
              const isLoadingLessons = lessonsLoadingIds.has(module.id);
              const sectionSummary =
                moduleLessons && moduleLessons.length > 0
                  ? formatSectionSummary(moduleLessons)
                  : `${String(module.lessonCount)} ${module.lessonCount === 1 ? "Lesson" : "Lessons"} • 0 Quizzes`;

              return (
                <li key={module.id}>
                  <div className="flex items-center gap-1 px-2 py-3">
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Collapse section" : "Expand section"}
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
                      <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                        {moduleIndex + 1}. {module.title}
                      </p>
                      {!isScorm ? (
                        <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                          {sectionSummary}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                          SCORM module
                        </p>
                      )}
                    </div>

                    {isScorm ? (
                      <Package
                        className="mr-1 h-4 w-4 shrink-0 text-[var(--admin-outline)]"
                        aria-hidden="true"
                      />
                    ) : editable ? (
                      <DropdownMenu
                        label={`Actions for ${module.title}`}
                        align="end"
                        trigger={<MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
                        triggerClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                        items={sectionMenuItems(module)}
                      />
                    ) : null}
                  </div>

                  {isExpanded ? (
                    <div className="pb-2">
                      {isScorm ? (
                        <p className={`${builderHelperClassName} px-4 pb-2`}>
                          {module.scormPackageReady
                            ? "SCORM package attached"
                            : "SCORM package awaiting upload or processing. Refresh to check readiness."}
                        </p>
                      ) : isLoadingLessons && moduleLessons === undefined ? (
                        <p className={`${builderHelperClassName} px-4 pb-2`}>Loading lessons…</p>
                      ) : (moduleLessons?.length ?? 0) === 0 && module.lessonCount > 0 ? (
                        <p className={`${builderHelperClassName} px-4 pb-2`} role="alert">
                          Couldn&apos;t load lessons. Refresh the page or check the server logs.
                        </p>
                      ) : (moduleLessons?.length ?? 0) === 0 ? (
                        <p className={`${builderHelperClassName} px-4 pb-2`}>No lessons yet</p>
                      ) : (
                        <ul className="divide-y divide-[var(--admin-border)] border-y border-[var(--admin-border)]">
                          {moduleLessons?.map((lesson, lessonIndex) => {
                            const isSelected = selectedLessonId === lesson.id;
                            return (
                              <li key={lesson.id}>
                                <div
                                  className={[
                                    "group flex items-center gap-2 px-3 py-2.5 transition-colors",
                                    isSelected
                                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                                      : "hover:bg-[var(--admin-surface-high)]",
                                  ].join(" ")}
                                >
                                  <span className="w-5 shrink-0 text-center text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                    {lessonIndex + 1}
                                  </span>

                                  <LessonTypeIcon lesson={lesson} />

                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--admin-on-surface)]"
                                    aria-current={isSelected ? "true" : undefined}
                                    onClick={() => {
                                      onSelectLesson(module.id, lesson.id);
                                    }}
                                  >
                                    {lesson.title}
                                  </button>

                                  <LessonStatusBadges lesson={lesson} />

                                  {editable ? (
                                    <DropdownMenu
                                      label={`Actions for ${lesson.title}`}
                                      align="end"
                                      trigger={
                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                      }
                                      triggerClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface)] hover:text-[var(--admin-on-surface)]"
                                      items={lessonMenuItems(module, lesson, moduleLessons)}
                                    />
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {editable && !isScorm ? (
                        <div className="px-3 pt-2">
                          <button
                            type="button"
                            className={[
                              "flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                              addingLessonModuleId === module.id
                                ? "border-[color-mix(in_srgb,var(--admin-lesson-video)_40%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-video)_12%,var(--admin-surface))] text-[var(--admin-lesson-video)]"
                                : "border-[color-mix(in_srgb,var(--admin-lesson-video)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-lesson-video)_8%,var(--admin-surface))] text-[var(--admin-lesson-video)] hover:bg-[color-mix(in_srgb,var(--admin-lesson-video)_14%,var(--admin-surface))]",
                            ].join(" ")}
                            onClick={() => {
                              onStartAddLesson(module.id, module.title);
                            }}
                            aria-current={addingLessonModuleId === module.id ? "true" : undefined}
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add lesson
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {editable && hasChapters ? (
          <div className="border-t border-[var(--admin-border)] p-3">
            <button
              type="button"
              onClick={() => {
                setAddChapterOpen(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-4 py-2.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Section
            </button>
          </div>
        ) : null}
      </div>

      <AddChapterDialog
        open={addChapterOpen}
        courseId={courseId}
        onClose={() => {
          setAddChapterOpen(false);
        }}
        onCreated={handleChapterCreated}
      />

      <DeleteModuleDialog
        open={deleteModuleState !== null}
        moduleId={deleteModuleState?.moduleId ?? null}
        moduleTitle={deleteModuleState?.moduleTitle ?? ""}
        onClose={() => {
          setDeleteModuleState(null);
        }}
        onDeleted={() => {
          if (deleteModuleState?.moduleId) {
            setExpandedModuleIds((current) => {
              const next = new Set(current);
              next.delete(deleteModuleState.moduleId);
              return next;
            });
            setLessonsByModule((current) => {
              const { [deleteModuleState.moduleId]: _removed, ...rest } = current;
              void _removed;
              return rest;
            });
          }
          void refreshModules();
        }}
      />

      <MoveLessonSectionDialog
        open={moveLessonState !== null}
        lessonId={moveLessonState?.lessonId ?? null}
        lessonTitle={moveLessonState?.lessonTitle ?? ""}
        currentModuleId={moveLessonState?.moduleId ?? ""}
        sections={modules.map((module) => ({ id: module.id, title: module.title }))}
        onClose={() => {
          setMoveLessonState(null);
        }}
        onMoved={(targetModuleId) => {
          const sourceModuleId = moveLessonState?.moduleId;
          if (sourceModuleId) {
            void loadModuleLessons(sourceModuleId, true);
          }
          void loadModuleLessons(targetModuleId, true);
          void refreshModules();
          setExpandedModuleIds((current) => new Set([...current, targetModuleId]));
        }}
      />

      <DeleteLessonDialog
        open={deleteLessonState !== null}
        lessonId={deleteLessonState?.lessonId ?? ""}
        courseId={courseId}
        inline
        onClose={() => {
          setDeleteLessonState(null);
        }}
        onDeleted={() => {
          if (!deleteLessonState) return;
          void handleLessonDeletedFromSidebar(
            deleteLessonState.moduleId,
            deleteLessonState.lessonId,
          );
          setDeleteLessonState(null);
        }}
      />
    </>
  );
}
