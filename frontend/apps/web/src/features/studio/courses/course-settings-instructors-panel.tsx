"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { memberInitials } from "./admin-form-dropdown-shared";
import { builderHelperClassName } from "./course-builder-shared";
import { CourseInstructorEmptyIllustrationGraphic } from "./course-instructor-empty-illustration";
import { courseInstructorIdsFromDetail } from "./course-instructor-settings";
import {
  formatCourseInstructorError,
  removeCourseInstructor,
  resolveInstructorMembersByIds,
} from "./course-instructors-client";
import type { InstructorMember } from "./create-course-add-member-dialog";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsInstructorsPanelProps = {
  course: CourseDetail;
  disabled: boolean;
  refreshToken?: number;
  onAddInstructors: () => void;
  onCourseChange: (course: CourseDetail) => void;
};

function InstructorListAvatar({ member }: { member: InstructorMember }) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-xs font-bold text-[var(--admin-on-primary-container)]">
      {memberInitials(member.displayName, member.email)}
    </span>
  );
}

export function CourseSettingsInstructorsPanel({
  course,
  disabled,
  refreshToken = 0,
  onAddInstructors,
  onCourseChange,
}: CourseSettingsInstructorsPanelProps) {
  const instructorIds = useMemo(
    () => courseInstructorIdsFromDetail(course),
    [course, refreshToken],
  );
  const [instructors, setInstructors] = useState<InstructorMember[]>([]);
  const [unresolvedIds, setUnresolvedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveInstructorMembersByIds(instructorIds);
        if (!cancelled) {
          setInstructors(resolved.instructors);
          setUnresolvedIds(resolved.unresolvedIds);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(formatCourseInstructorError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [instructorIds, refreshToken]);

  const hasInstructors = instructorIds.length > 0;

  async function handleRemove(membershipId: string) {
    if (disabled || removingId) return;
    setRemovingId(membershipId);
    setError(null);
    try {
      const member = instructors.find((item) => item.membershipId === membershipId);
      const updated = await removeCourseInstructor(
        course,
        membershipId,
        instructorIds,
        member?.displayName,
      );
      onCourseChange(updated);
    } catch (removeError) {
      setError(formatCourseInstructorError(removeError));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end gap-4">
        <button
          type="button"
          className={inlineLessonSecondaryButtonClassName}
          disabled={disabled || loading}
          onClick={onAddInstructors}
        >
          Add Instructors
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading instructors…</p>
      ) : null}

      {!loading && !hasInstructors ? (
        <section className="flex min-h-[min(22rem,calc(100vh-20rem))] flex-col items-center justify-center px-6 py-12 text-center">
          <CourseInstructorEmptyIllustrationGraphic />
          <h3 className="mt-8 text-lg font-bold text-[var(--admin-on-surface)]">Add Instructors</h3>
          <p className={`${builderHelperClassName} mt-2 max-w-sm`}>
            Add instructors associated with the course.
          </p>
          <button
            type="button"
            className={`${inlineLessonPrimaryDarkButtonClassName} mt-8 gap-2`}
            disabled={disabled}
            onClick={onAddInstructors}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Add instructors
          </button>
        </section>
      ) : null}

      {!loading && hasInstructors ? (
        <>
          <ul className="space-y-3">
            {instructors.map((member) => (
              <li
                key={member.membershipId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <InstructorListAvatar member={member} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {member.displayName}
                    </p>
                    {member.email ? (
                      <p className={`${builderHelperClassName} truncate`}>{member.email}</p>
                    ) : null}
                    {member.status === "INVITED" ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--admin-primary-strong)]">
                        Invite pending
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                  disabled={disabled || removingId === member.membershipId}
                  aria-label={`Remove ${member.displayName}`}
                  onClick={() => {
                    void handleRemove(member.membershipId);
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}

            {unresolvedIds.map((membershipId) => (
              <li
                key={membershipId}
                className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Unknown instructor
                  </p>
                  <p className={`${builderHelperClassName} truncate font-mono text-xs`}>
                    {membershipId}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                  disabled={disabled || removingId === membershipId}
                  aria-label="Remove unknown instructor"
                  onClick={() => {
                    void handleRemove(membershipId);
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              className={`${inlineLessonPrimaryDarkButtonClassName} gap-2`}
              disabled={disabled}
              onClick={onAddInstructors}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Add instructors
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
