import type { z } from "zod";
import { Check, ChevronDown } from "lucide-react";
import type { courseDetailSchema } from "@atlas/contracts/courses/schemas";
import { ArticleMarkdown } from "../lessons/article-markdown";
import type { LearnerCourseOutline } from "../lessons/course-outline-model";
import { CourseActionCard } from "./course-action-card";
import { CourseOutline } from "./course-outline";
import { courseSizeLabel, instructorsLabel, learnerCountLabel } from "./course-page-model";
import { CourseReviews } from "./course-reviews";

type CourseDetailData = z.infer<typeof courseDetailSchema>;

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
  /** Every chapter and lesson; with the learner's progress once enrolled. */
  outline?: LearnerCourseOutline | null;
  tagId?: string;
};

const LEVEL_LABELS: Record<NonNullable<CourseDetailData["level"]>, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The learner's course page (QA review 1 M38, M50, m40; review 2 "course page
 * thin"): what the course is and who teaches it, one card to enrol or carry
 * on, what learners will learn, every chapter and lesson (before enrolling
 * too), the full description, the FAQs and the reviews.
 */
export function CourseDetail({ course, modules, outline = null, tagId }: CourseDetailProps) {
  const enrolled = course.enrollmentStatus === "enrolled";
  const eyebrow = [course.category, course.level ? LEVEL_LABELS[course.level] : null]
    .filter(Boolean)
    .join(" · ");
  const taughtBy = instructorsLabel(course.instructors.map((person) => person.name));
  const facts = [courseSizeLabel(outline), learnerCountLabel(course.studentCount)].filter(
    (fact): fact is string => Boolean(fact),
  );
  const description = course.description?.trim() ?? "";

  return (
    <main className="pb-12">
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <header className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <div className="space-y-3">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {course.title}
            </h1>
            {course.shortDescription ? (
              <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {course.shortDescription}
              </p>
            ) : null}
          </div>

          {taughtBy || facts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              {taughtBy ? (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex shrink-0 -space-x-2" aria-hidden="true">
                    {course.instructors.slice(0, 3).map((person) =>
                      person.avatarUrl ? (
                        <img
                          key={person.name}
                          src={person.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full border-2 border-background bg-muted object-cover"
                        />
                      ) : (
                        <span
                          key={person.name}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/15 text-[11px] font-semibold text-primary"
                        >
                          {initials(person.name)}
                        </span>
                      ),
                    )}
                  </span>
                  <span className="min-w-0 font-medium text-foreground">{taughtBy}</span>
                </div>
              ) : null}
              {facts.length > 0 ? (
                <p className="text-muted-foreground">{facts.join(" · ")}</p>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CourseActionCard course={course} outline={outline} />
        </div>

        <div className="min-w-0 space-y-12 lg:col-start-1 lg:row-start-2">
          {course.outcomes.length > 0 ? (
            <section aria-labelledby="course-outcomes" className="space-y-4">
              <h2 id="course-outcomes" className="text-xl font-semibold text-foreground">
                What you&apos;ll learn
              </h2>
              <ul className="grid gap-x-8 gap-y-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
                {course.outcomes.map((outcome, index) => (
                  <li
                    key={`${String(index)}-${outcome}`}
                    className="flex gap-3 text-sm leading-relaxed"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="text-foreground">{outcome}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="course-content" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="course-content" className="text-xl font-semibold text-foreground">
                Course content
              </h2>
              {!enrolled && outline && outline.totalLessons > 0 ? (
                <p className="text-sm text-muted-foreground">Enroll to open the lessons.</p>
              ) : null}
            </div>
            {tagId ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-foreground">
                Showing lessons with this tag.{" "}
                <a href={`/courses/${course.id}`} className="font-semibold underline">
                  Clear filter
                </a>
              </div>
            ) : null}
            <CourseOutline
              courseId={course.id}
              modules={modules}
              enrolled={enrolled}
              outline={outline}
              {...(tagId ? { tagId } : {})}
            />
          </section>

          {description ? (
            <section aria-labelledby="course-about" className="space-y-4">
              <h2 id="course-about" className="text-xl font-semibold text-foreground">
                About this course
              </h2>
              <div className="max-w-3xl text-foreground">
                <ArticleMarkdown text={description} />
              </div>
            </section>
          ) : null}

          {course.faqs.length > 0 ? (
            <section aria-labelledby="course-faqs" className="space-y-4">
              <h2 id="course-faqs" className="text-xl font-semibold text-foreground">
                Frequently asked questions
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {course.faqs.map((faq, index) => (
                  <details key={`${String(index)}-${faq.question}`} className="group/faq">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">{faq.question}</span>
                      <ChevronDown
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/faq:rotate-180 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </summary>
                    {faq.answer ? (
                      <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </p>
                    ) : null}
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <CourseReviews courseId={course.id} canReview={enrolled} />
        </div>
      </div>
    </main>
  );
}
