"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";

type EnrollCourseDialogProps = {
  courseId: string;
  courseTitle: string;
};

export function EnrollCourseDialog({ courseId, courseTitle }: EnrollCourseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      await clientApi.post("/api/v1/enrollments", { courseId }, "enrollment-create");
      setOpen(false);
      router.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
      } else {
        setError("Unable to enroll right now.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md border px-4 py-2 text-sm font-medium"
        onClick={() => {
          setOpen(true);
        }}
      >
        Enroll
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => {
            if (!submitting) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="enroll-course-title"
            className="w-full max-w-md rounded-lg border bg-white p-6 shadow-lg"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2 id="enroll-course-title" className="text-lg font-semibold">
              Confirm enrollment
            </h2>
            <p className="mt-2 text-sm opacity-80">
              Enroll in <strong>{courseTitle}</strong>?
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm"
                disabled={submitting}
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border px-4 py-2 text-sm font-medium"
                disabled={submitting}
                onClick={() => {
                  void handleConfirm();
                }}
              >
                {submitting ? "Enrolling..." : "Confirm enrollment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
