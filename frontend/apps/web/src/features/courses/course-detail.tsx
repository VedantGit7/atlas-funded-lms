import { EnrollCourseDialog } from "./enroll-course-dialog";
import { EnrollmentStatusBadge } from "./enrollment-status-badge";
import { CourseOutline } from "./course-outline";
import { CourseReviews } from "./course-reviews";
import { CoverArt } from "./course-card";
import { type CourseAccessTier } from "./course-pricing";
import { CoursePrice } from "./CoursePrice";

type CourseDetailData = {
  id: string;
  title: string;
  description: string | null;
  accessTier: CourseAccessTier;
  priceCents: number | null;
  currency: string | null;
  locked: boolean;
  enrollmentStatus: "enrolled" | "not_enrolled";
  enrolledAt: string | null;
  coverKey?: string | null | undefined;
};

type CourseModuleOutlineItem = {
  id: string;
  title: string;
  position: number;
  lessonCount: number;
  contentKind: "standard" | "scorm";
  scormLaunchReady: boolean;
};

type CourseDetailProps = {
  course: CourseDetailData;
  modules: CourseModuleOutlineItem[];
  tagId?: string;
};

export function CourseDetail({ course, modules, tagId }: CourseDetailProps) {
  const isEnrolled = course.enrollmentStatus === "enrolled";
  const isPaid = course.accessTier === "PAID";

  return (
    <main className="space-y-8">
      <CoverArt
        coverKey={course.coverKey}
        category={null}
        title={course.title}
        className="group aspect-[16/5] w-full rounded-2xl border border-border"
        iconClassName="h-14 w-14"
      />
      <header className="space-y-4 border-b pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            {course.description ? (
              <p className="max-w-3xl text-base opacity-80">{course.description}</p>
            ) : null}
          </div>
          <EnrollmentStatusBadge status={course.enrollmentStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
              isPaid
                ? "border-warning/40 bg-warning/10 text-warning-text"
                : "border-success/40 bg-success/10 text-success-text"
            }`}
          >
            <CoursePrice course={course} />
          </span>
          {isEnrolled ? (
            <p className="text-sm opacity-80">
              You are enrolled
              {course.enrolledAt ? ` since ${new Date(course.enrolledAt).toLocaleString()}` : ""}.
            </p>
          ) : (
            <EnrollCourseDialog
              courseId={course.id}
              courseTitle={course.title}
              isPaid={isPaid}
              priceCents={course.priceCents}
              currency={course.currency}
            />
          )}
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Module outline</h2>
        {tagId ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-foreground">
            Filtering lessons by tag.{" "}
            <a href={`/courses/${course.id}`} className="font-semibold underline">
              Clear filter
            </a>
          </div>
        ) : null}
        <CourseOutline
          courseId={course.id}
          modules={modules}
          enrolled={isEnrolled}
          {...(tagId ? { tagId } : {})}
        />
      </section>

      <CourseReviews courseId={course.id} canReview={isEnrolled} />
    </main>
  );
}
