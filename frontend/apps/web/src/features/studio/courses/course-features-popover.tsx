"use client";

import { useId, useRef, useState } from "react";
import { Check, Info, X } from "lucide-react";
import type { z } from "zod";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { deriveCourseFeatureFlags } from "./course-feature-flags";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type CourseFeaturesPopoverProps = {
  course: CourseRow;
};

const HIDE_DELAY_MS = 120;

export function CourseFeaturesPopover({ course }: CourseFeaturesPopoverProps) {
  const popoverId = useId();
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const features = deriveCourseFeatureFlags(course);

  function clearHideTimer() {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  function showPopover() {
    clearHideTimer();
    setOpen(true);
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setOpen(false);
    }, HIDE_DELAY_MS);
  }

  return (
    <div
      className="relative"
      onMouseEnter={showPopover}
      onMouseLeave={scheduleHide}
      onFocus={showPopover}
      onBlur={scheduleHide}
    >
      <button
        type="button"
        aria-label={`Course features for ${course.title}`}
        aria-expanded={open}
        aria-controls={popoverId}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors duration-150 hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40"
      >
        <Info className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-30 min-w-[15.5rem] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-xl motion-safe:animate-[admin-dropdown-in_0.16s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-bottom"
        >
          <ul className="space-y-2.5">
            {features.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2.5 text-sm text-[var(--admin-on-surface-variant)]"
              >
                {item.enabled ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-[var(--admin-success)]"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                ) : (
                  <X
                    className="h-4 w-4 shrink-0 text-[var(--admin-danger)]"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
                <span className={item.enabled ? "text-[var(--admin-on-surface)]" : ""}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <span
            aria-hidden
            className="absolute -bottom-1.5 right-3 h-3 w-3 rotate-45 border-b border-r border-[var(--admin-border)] bg-[var(--admin-surface)]"
          />
        </div>
      ) : null}
    </div>
  );
}
