"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, KeyRound, Loader2, UserCheck, UserX } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { fieldClassName, labelClassName } from "./member-detail-shared";

type CourseOption = { id: string; title: string; status: string };

type CourseListResponse = {
  data: { items: Array<{ id: string; title: string; status: string }> };
};

const buttonClassName =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] disabled:opacity-50";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ClientApiError ? error.message : fallback;
}

type Pending = "enroll" | "reset" | "suspend" | "reactivate" | null;

/**
 * What an admin can do for a learner from their page (QA review 2 H22):
 * enrol them, send a password reset, suspend or reactivate them.
 */
export function MemberActions({
  membershipId,
  displayName,
  email,
  status,
  isOwner,
  enrolledCourseIds = [],
}: {
  membershipId: string;
  displayName: string;
  email: string | null;
  status: string;
  isOwner: boolean;
  /** Courses they are already in; left out of the enrol list. */
  enrolledCourseIds?: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirming, setConfirming] = useState<Exclude<Pending, "enroll" | null> | null>(null);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState("");

  useEffect(() => {
    if (!enrolOpen || courses) return;
    let cancelled = false;
    void clientApi
      .get<CourseListResponse>("/api/v1/courses?view=studio&limit=100")
      .then((response) => {
        if (cancelled) return;
        const already = new Set(enrolledCourseIds);
        const published = response.data.items.filter(
          (course) => course.status === "PUBLISHED" && !already.has(course.id),
        );
        setCourses(published);
        setCourseId(published[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled) setCourseError(errorMessage(error, "Couldn't load courses."));
      });
    return () => {
      cancelled = true;
    };
    // The list is loaded once per page view; enrolledCourseIds comes from the same render.
  }, [enrolOpen, courses, enrolledCourseIds]);

  async function enrol() {
    if (!courseId) return;
    setPending("enroll");
    try {
      await clientApi.post(
        `/api/v1/courses/${courseId}/enrollments`,
        { membershipId },
        `member-enroll-${membershipId}-${courseId}`,
        { successMessage: `${displayName} enrolled` },
      );
      setEnrolOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't enroll this member."));
    } finally {
      setPending(null);
    }
  }

  async function run(action: Exclude<Pending, "enroll" | null>) {
    setPending(action);
    setConfirming(null);
    try {
      if (action === "reset") {
        await clientApi.post(
          `/api/v1/members/${membershipId}/password-reset`,
          null,
          `member-password-reset-${membershipId}`,
          { successMessage: `Password reset email sent to ${email ?? "the member"}` },
        );
      } else if (action === "suspend") {
        await clientApi.post(`/api/v1/members/${membershipId}/suspend`, null, "member-suspend", {
          successMessage: `${displayName} suspended`,
        });
      } else {
        await clientApi.post(
          `/api/v1/members/${membershipId}/reactivate`,
          null,
          `member-reactivate-${membershipId}`,
          { successMessage: `${displayName} reactivated` },
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "That didn't work. Try again."));
    } finally {
      setPending(null);
    }
  }

  const confirmText: Record<
    Exclude<Pending, "enroll" | null>,
    { title: string; body: string; cta: string }
  > = {
    reset: {
      title: "Send a password reset?",
      body: `${email ?? "The member"} will get an email with a link to choose a new password. Their current password keeps working until they do.`,
      cta: "Send email",
    },
    suspend: {
      title: `Suspend ${displayName}?`,
      body: "They can't open the academy or study until you reactivate them. Their progress is kept.",
      cta: "Suspend",
    },
    reactivate: {
      title: `Reactivate ${displayName}?`,
      body: "They can sign in and pick up where they left off.",
      cta: "Reactivate",
    },
  };

  const suspended = status === "SUSPENDED";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Member actions">
      {!suspended ? (
        <button
          type="button"
          className={buttonClassName}
          disabled={pending !== null}
          onClick={() => {
            setEnrolOpen(true);
          }}
        >
          <BookPlus className="h-4 w-4" aria-hidden="true" />
          Enrol in a course
        </button>
      ) : null}
      {status === "ACTIVE" && email ? (
        <button
          type="button"
          className={buttonClassName}
          disabled={pending !== null}
          onClick={() => {
            setConfirming("reset");
          }}
        >
          {pending === "reset" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          )}
          Send password reset
        </button>
      ) : null}
      {!isOwner && suspended ? (
        <button
          type="button"
          className={buttonClassName}
          disabled={pending !== null}
          onClick={() => {
            setConfirming("reactivate");
          }}
        >
          <UserCheck className="h-4 w-4" aria-hidden="true" />
          Reactivate
        </button>
      ) : null}
      {!isOwner && !suspended && status !== "REMOVED" ? (
        <button
          type="button"
          className={`${buttonClassName} text-[var(--admin-danger)]`}
          disabled={pending !== null}
          onClick={() => {
            setConfirming("suspend");
          }}
        >
          <UserX className="h-4 w-4" aria-hidden="true" />
          Suspend
        </button>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-action-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
          >
            <h2
              id="member-action-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              {confirmText[confirming].title}
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {confirmText[confirming].body}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={buttonClassName}
                onClick={() => {
                  setConfirming(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirming === "suspend"
                    ? "rounded-lg bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-danger)]"
                    : "rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)]"
                }
                onClick={() => {
                  void run(confirming);
                }}
              >
                {confirmText[confirming].cta}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {enrolOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--admin-scrim)] p-4">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-enroll-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onSubmit={(event) => {
              event.preventDefault();
              void enrol();
            }}
          >
            <h2
              id="member-enrol-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Enrol {displayName} in a course
            </h2>
            {courseError ? (
              <p role="alert" className="text-sm text-[var(--admin-danger)]">
                {courseError}
              </p>
            ) : courses === null ? (
              <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading courses…
              </p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                They are already in every published course.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="member-enrol-course" className={labelClassName}>
                  Course
                </label>
                <select
                  id="member-enrol-course"
                  className={fieldClassName}
                  value={courseId}
                  onChange={(event) => {
                    setCourseId(event.target.value);
                  }}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  They get access straight away, without paying.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={buttonClassName}
                disabled={pending === "enroll"}
                onClick={() => {
                  setEnrolOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending === "enroll" || !courseId}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
              >
                {pending === "enroll" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Enrol
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
