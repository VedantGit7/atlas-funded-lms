import Link from "next/link";
import { EmptyState } from "@atlas/design-system/components/empty-state";

/** The API's answer when an enrolled learner opens a course taken offline to update it. */
export const COURSE_BEING_UPDATED = "COURSE_BEING_UPDATED";

/**
 * Shown to enrolled learners while their course is back in draft or in review,
 * instead of "not found" (QA S1.6). Their enrollment and progress are kept.
 */
export function CourseBeingUpdated() {
  return (
    <main className="p-6" role="status">
      <EmptyState
        title="This course is being updated"
        description="Your enrollment and progress are saved. You can carry on where you left off as soon as the course is back."
        action={
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Back to home
          </Link>
        }
      />
    </main>
  );
}
