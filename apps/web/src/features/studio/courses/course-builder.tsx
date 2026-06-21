"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type {
  studioCourseDetailSchema,
  studioModuleOutlineItemSchema,
} from "../../../server/courses/course-authoring-schemas";
import { BuilderValidationPanel } from "./builder-validation-panel";
import { CourseModuleTree } from "./course-module-tree";
import { CourseSettingsForm } from "./course-settings-form";
import { CourseStatusBadge } from "./course-status-badge";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type CourseBuilderProps = {
  initialCourse: CourseDetail;
  initialModules: ModuleItem[];
  canPublish: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function CourseBuilder({ initialCourse, initialModules, canPublish }: CourseBuilderProps) {
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [modules, setModules] = useState(initialModules);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const editable = course.status === "DRAFT";

  async function handlePublish() {
    if (!canPublish || course.status !== "DRAFT") return;
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await clientApi.post<{ data: { status: CourseDetail["status"] } }>(
        `/api/v1/courses/${course.id}/publish`,
        {},
        "course-publish",
      );
      setCourse((current) => ({ ...current, status: response.data.status }));
      router.refresh();
    } catch (error) {
      setPublishError(formatError(error));
    } finally {
      setPublishing(false);
    }
  }

  async function handleArchive() {
    if (!editable || !window.confirm("Archive this course?")) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      await clientApi.delete(`/api/v1/courses/${course.id}`, "course-archive");
      router.push("/studio/courses");
      router.refresh();
    } catch (error) {
      setArchiveError(formatError(error));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p>
            <Link href="/studio/courses">Courses</Link> / {course.title}
          </p>
          <div className="flex items-center gap-3">
            <h1>{course.title}</h1>
            <CourseStatusBadge status={course.status} />
          </div>
          {course.status === "PUBLISHED" ? (
            <p className="text-sm">
              <Link href={`/studio/courses/${course.id}/learners`}>View learner roster</Link>
            </p>
          ) : null}
        </div>
        {editable ? (
          <button
            type="button"
            onClick={() => {
              void handleArchive();
            }}
            disabled={archiving}
          >
            {archiving ? "Archiving..." : "Archive course"}
          </button>
        ) : null}
      </header>

      {archiveError ? <p role="alert">{archiveError}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(240px,300px)]">
        <CourseModuleTree
          courseId={course.id}
          modules={modules}
          editable={editable}
          onChanged={setModules}
        />
        <CourseSettingsForm course={course} editable={editable} onSaved={setCourse} />
        <BuilderValidationPanel
          course={course}
          moduleCount={modules.length}
          canPublish={canPublish}
          onPublish={() => {
            void handlePublish();
          }}
          publishing={publishing}
          publishError={publishError}
        />
      </div>
    </div>
  );
}
