"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateCourseDialog } from "../courses/create-course-dialog";
import { primaryButtonClassName } from "./studio-dashboard-shared";

export function StudioDashboardCreateCourseButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={primaryButtonClassName}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        New course
      </button>
      {open ? (
        <CreateCourseDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
