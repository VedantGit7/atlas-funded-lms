"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import type {
  studioCourseDetailResponseSchema,
  studioCourseListItemSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import {
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;
type CourseDetail = z.infer<typeof studioCourseDetailResponseSchema>["data"];

type CoursesListResponse = {
  data: { items: CourseRow[] };
};

type PendingToggle = {
  course: CourseRow;
  encrypted: boolean;
};

const STUDIO_FEATURES_KEY = "studioFeatures";

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

function isEncrypted(tags: Record<string, unknown> | undefined): boolean {
  const features = tags?.[STUDIO_FEATURES_KEY];
  if (!features || typeof features !== "object" || Array.isArray(features)) return false;
  return (features as Record<string, unknown>)["encrypted"] === true;
}

function mergeEncryptedTags(
  existingTags: Record<string, unknown> | undefined,
  encrypted: boolean,
): Record<string, unknown> {
  const tags = { ...(existingTags ?? {}) };
  const existingFeatures = tags[STUDIO_FEATURES_KEY];
  const features =
    existingFeatures && typeof existingFeatures === "object" && !Array.isArray(existingFeatures)
      ? { ...(existingFeatures as Record<string, unknown>) }
      : {};
  features["encrypted"] = encrypted;
  tags[STUDIO_FEATURES_KEY] = features;
  return tags;
}

export function ManageCourseEncryptionPanel() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<PendingToggle | null>(null);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<CoursesListResponse>("/api/v1/courses?view=studio&limit=100");
      setCourses(response.data.items);
    } catch (caught) {
      setError(formatError(caught));
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function applyEncryptionToggle(toggle: PendingToggle) {
    setBusyId(toggle.course.id);
    setError(null);
    try {
      const detail = await clientApi.get<{ data: CourseDetail }>(
        `/api/v1/courses/${toggle.course.id}?view=studio`,
      );
      await clientApi.put(
        `/api/v1/courses/${toggle.course.id}`,
        {
          tags: mergeEncryptedTags(detail.data.tags, toggle.encrypted),
        },
        `course-encryption-${toggle.course.id}`,
      );
      setPendingToggle(null);
      setCourses((previous) =>
        previous.map((course) =>
          course.id === toggle.course.id
            ? { ...course, tags: mergeEncryptedTags(course.tags, toggle.encrypted) }
            : course,
        ),
      );
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--admin-on-surface-variant)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Loading courses…
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No courses found</p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Studio courses will appear here for encryption management.
          </p>
        </div>
      ) : (
        <div className={manageTableCardClassName}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {courses.length} {courses.length === 1 ? "course" : "courses"}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void loadCourses();
              }}
              className={manageSecondaryButtonClassName}
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className={manageTableHeadClassName}>
                  <th className={manageTableThClassName}>Course</th>
                  <th className={manageTableThClassName}>Status</th>
                  <th className={manageTableThClassName}>Encrypted</th>
                  <th className={`${manageTableThClassName} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => {
                  const encrypted = isEncrypted(course.tags);
                  return (
                    <tr key={course.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                      <td className={`${manageTableTdClassName} font-semibold`}>{course.title}</td>
                      <td className={manageTableTdClassName}>
                        <span className={manageStatusChipClassName("neutral")}>{course.status}</span>
                      </td>
                      <td className={manageTableTdClassName}>
                        <span className={manageStatusChipClassName(encrypted ? "success" : "neutral")}>
                          {encrypted ? "Encrypted" : "Not encrypted"}
                        </span>
                      </td>
                      <td className={manageTableTdClassName}>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={busyId === course.id}
                            onClick={() => {
                              setPendingToggle({ course, encrypted: !encrypted });
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {encrypted ? "Decrypt" : "Encrypt"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingToggle !== null}
        title={pendingToggle?.encrypted ? "Encrypt course?" : "Decrypt course?"}
        description={
          pendingToggle
            ? pendingToggle.encrypted
              ? `${pendingToggle.course.title} content will be protected with encryption.`
              : `${pendingToggle.course.title} encryption will be removed. Content may become accessible offline.`
            : ""
        }
        confirmLabel={pendingToggle?.encrypted ? "Encrypt" : "Decrypt"}
        busy={busyId !== null}
        onConfirm={() => {
          if (pendingToggle) void applyEncryptionToggle(pendingToggle);
        }}
        onCancel={() => {
          setPendingToggle(null);
        }}
      />
    </div>
  );
}
