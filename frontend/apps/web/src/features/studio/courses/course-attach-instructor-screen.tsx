"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName, memberInitials } from "./admin-form-dropdown-shared";
import { builderHelperClassName } from "./course-builder-shared";
import {
  AddNewMemberDialog,
  loadInstructorMembers,
  type InstructorMember,
} from "./create-course-add-member-dialog";
import { courseInstructorIdsFromDetail } from "./course-instructor-settings";
import {
  attachCourseInstructor,
  formatCourseInstructorError,
} from "./course-instructors-client";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseAttachInstructorScreenProps = {
  course: CourseDetail;
  disabled: boolean;
  onBack: () => void;
  onAttached: (course: CourseDetail) => void;
};

function InstructorAvatar({
  member,
  size = "md",
}: {
  member: InstructorMember;
  size?: "md" | "sm";
}) {
  const dimension = size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";

  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt=""
        className={`${dimension} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-full bg-[var(--admin-primary-container)] font-bold text-[var(--admin-on-primary-container)]`}
    >
      {memberInitials(member.displayName, member.email)}
    </span>
  );
}

export function CourseAttachInstructorScreen({
  course,
  disabled,
  onBack,
  onAttached,
}: CourseAttachInstructorScreenProps) {
  const searchId = useId();
  const attachedIds = courseInstructorIdsFromDetail(course);
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<InstructorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadInstructorMembers();
      setMembers(loaded);
    } catch (loadError) {
      setError(formatCourseInstructorError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const availableMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((member) => !attachedIds.includes(member.membershipId))
      .filter((member) => {
        if (!query) return true;
        return (
          member.displayName.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        );
      });
  }, [attachedIds, members, search]);

  async function handleAttach(membershipId: string) {
    if (disabled || attachingId) return;
    setAttachingId(membershipId);
    setError(null);
    try {
      const member = members.find((item) => item.membershipId === membershipId);
      const updated = await attachCourseInstructor(
        course,
        attachedIds,
        membershipId,
        member?.displayName,
      );
      onAttached(updated);
    } catch (attachError) {
      setError(formatCourseInstructorError(attachError));
    } finally {
      setAttachingId(null);
    }
  }

  async function handleMemberInvited(member: InstructorMember) {
    setMembers((current) => {
      if (current.some((item) => item.membershipId === member.membershipId)) {
        return current;
      }
      return [member, ...current];
    });
    setAddMemberOpen(false);
    await handleAttach(member.membershipId);
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
            disabled={Boolean(attachingId)}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <p className="text-sm font-semibold text-[var(--admin-primary-strong)]">Add Instructors</p>
          <header className="mb-6 mt-1">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">
              Add Instructors
            </h1>
            <p className={`${builderHelperClassName} mt-2`}>
              Choose team members to associate with this course.
            </p>
          </header>

          {error ? (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <div className="mb-4">
            <label htmlFor={searchId} className="sr-only">
              Search instructors
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                id={searchId}
                className={`${lessonInputClassName} pl-10`}
                placeholder="Search by name or email"
                value={search}
                disabled={disabled || loading}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]">
                Loading instructors…
              </p>
            ) : null}

            {!loading && availableMembers.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  {members.length === attachedIds.length
                    ? "All available members are already instructors on this course."
                    : "No members match your search."}
                </p>
                <p className={`${builderHelperClassName} mt-2`}>
                  Invite a new course creator if you cannot find who you need.
                </p>
                <button
                  type="button"
                  className={`${inlineLessonPrimaryDarkButtonClassName} mt-6 gap-2`}
                  disabled={disabled}
                  onClick={() => {
                    setAddMemberOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                  Invite instructor
                </button>
              </div>
            ) : null}

            {!loading && availableMembers.length > 0 ? (
              <ul className="divide-y divide-[var(--admin-border)]">
                {availableMembers.map((member) => (
                  <li key={member.membershipId}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled || attachingId === member.membershipId}
                      onClick={() => {
                        void handleAttach(member.membershipId);
                      }}
                    >
                      <InstructorAvatar member={member} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                          {member.displayName}
                        </span>
                        {member.email ? (
                          <span className={`${builderHelperClassName} block truncate`}>
                            {member.email}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-[var(--admin-primary-strong)]">
                        {attachingId === member.membershipId ? "Adding…" : "Add"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={disabled || loading}
              onClick={() => {
                setAddMemberOpen(true);
              }}
            >
              Invite new instructor
            </button>
          </div>
        </div>
      </div>

      <AddNewMemberDialog
        open={addMemberOpen}
        onClose={() => {
          setAddMemberOpen(false);
        }}
        defaultRoleKey="instructor"
        onMemberInvited={handleMemberInvited}
      />
    </div>
  );
}
