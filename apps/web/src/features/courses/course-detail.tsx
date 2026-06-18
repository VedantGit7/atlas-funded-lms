import { EnrollCourseDialog } from "./enroll-course-dialog";
import { EnrollmentStatusBadge } from "./enrollment-status-badge";
import { CourseOutline } from "./course-outline";

type CourseDetailData = {
  id: string;
  title: string;
  description: string | null;
  enrollmentStatus: "enrolled" | "not_enrolled";
  enrolledAt: string | null;
};

type CourseModuleOutlineItem = {
  id: string;
  title: string;
  position: number;
  lessonCount: number;
};

type CourseDetailProps = {
  course: CourseDetailData;
  modules: CourseModuleOutlineItem[];
};

export function CourseDetail({ course, modules }: CourseDetailProps) {
  const isEnrolled = course.enrollmentStatus === "enrolled";

  return (
    <main className="space-y-8">
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
          {isEnrolled ? (
            <p className="text-sm opacity-80">
              You are enrolled
              {course.enrolledAt ? ` since ${new Date(course.enrolledAt).toLocaleString()}` : ""}.
            </p>
          ) : (
            <EnrollCourseDialog courseId={course.id} courseTitle={course.title} />
          )}
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Module outline</h2>
        <CourseOutline modules={modules} />
      </section>
    </main>
  );
}
