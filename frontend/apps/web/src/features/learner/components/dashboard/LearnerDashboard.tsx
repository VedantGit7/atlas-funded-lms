import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CircleCheck,
  Flame,
  Megaphone,
  Route,
  Trophy,
  Zap,
} from "lucide-react";
import type { MyCourse } from "@atlas/contracts/enrollments/my-courses.schemas";
import { CoverArt } from "../../../courses/course-card";
import { LessonStatusTrack, lessonsDoneLabel } from "../../../lessons/lesson-track";
import { formatDate, formatNumber } from "../../../../lib/format/academy-format";
import {
  courseActionHref,
  courseActionLabel,
  homeGreeting,
  homeSubtitle,
  levelProgressLabel,
  pickContinueCourse,
  scoreBandLabel,
  scoreColor,
} from "./dashboard-model";
import { RadialProgress, Reveal } from "./dashboard-ui";
import { MyCourseRow } from "./my-course-row";
import { LearnerPromoSliderCarousel } from "./LearnerPromoSliderCarousel";
import { LearnerEventsCountdown } from "./LearnerEventsCountdown";
import type { LearnerDashboardData } from "./dashboard-data.server";

export type { LearnerDashboardData };

const cardClass = "rounded-2xl border border-border bg-card shadow-sm";
const sectionTitleClass = "text-lg font-bold tracking-tight text-foreground";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const quietLinkClass =
  "inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The learner's home (QA remediation S3.3): what to do next, their courses with
 * real progress, and the academy's latest announcement. Sections whose feature
 * is off for the academy are left out rather than shown empty.
 */
export function LearnerDashboard({ data }: { data: LearnerDashboardData }) {
  const continueCourse = pickContinueCourse(data.courses);
  const otherCourses = (data.courses ?? []).filter(
    (course) => course.courseId !== continueCourse?.courseId,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 md:pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {homeGreeting(data.displayName, data.courses)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{homeSubtitle(data.courses)}</p>
        </div>
        {data.gamification ? <MomentumStrip gamification={data.gamification} /> : null}
      </header>

      {data.announcement ? (
        <Reveal>
          <AnnouncementBanner announcement={data.announcement} />
        </Reveal>
      ) : null}

      <Reveal>
        <div>
          {data.courses === null ? (
            <div role="status" className={`${cardClass} p-6 text-sm text-muted-foreground`}>
              Your courses couldn&apos;t be loaded. Reload the page to try again.
            </div>
          ) : continueCourse ? (
            <ContinueCard course={continueCourse} />
          ) : (
            <NextCourseCard finished={data.courses.length > 0} />
          )}
        </div>
      </Reveal>

      <Reveal>
        <LearnerPromoSliderCarousel />
      </Reveal>

      <Reveal>
        <LearnerEventsCountdown />
      </Reveal>

      {otherCourses.length > 0 ? (
        <Reveal>
          <section aria-labelledby="my-courses-heading">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="my-courses-heading" className={sectionTitleClass}>
                Your courses
              </h2>
              <Link href="/courses" className={quietLinkClass}>
                Browse courses
              </Link>
            </div>
            <ul className={`${cardClass} divide-y divide-border`}>
              {otherCourses.slice(0, 6).map((course) => (
                <MyCourseRow key={course.courseId} course={course} />
              ))}
            </ul>
            {otherCourses.length > 6 ? (
              <p className="mt-3">
                <Link href="/progress" className={quietLinkClass}>
                  See all {(data.courses ?? []).length} courses in Progress
                </Link>
              </p>
            ) : null}
          </section>
        </Reveal>
      ) : null}

      {data.paths.length > 0 || data.certificates.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.paths.length > 0 ? (
            <Reveal>
              <section className={`${cardClass} h-full p-5`} aria-labelledby="paths-heading">
                <h2 id="paths-heading" className={`${sectionTitleClass} mb-3`}>
                  Learning paths
                </h2>
                <ul className="space-y-2">
                  {data.paths.map((path) => (
                    <li key={path.id}>
                      <Link
                        href={`/paths/${path.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Route className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{path.title}</span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
          {data.certificates.length > 0 ? (
            <Reveal>
              <section className={`${cardClass} h-full p-5`} aria-labelledby="certificates-heading">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 id="certificates-heading" className={sectionTitleClass}>
                    Certificates
                  </h2>
                  <Link href="/certificates" className={quietLinkClass}>
                    See all
                  </Link>
                </div>
                <ul className="space-y-2">
                  {data.certificates.map((cert) => (
                    <li key={cert.id}>
                      <a
                        href={cert.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Award className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {cert.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Issued{" "}
                            {formatDate(cert.issuedAt, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
        </div>
      ) : null}

      {data.mastery.length > 0 ? (
        <Reveal>
          <section className={`${cardClass} p-6`} aria-labelledby="skills-heading">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 id="skills-heading" className={sectionTitleClass}>
                  Your skills
                </h2>
                <p className="text-sm text-muted-foreground">
                  {data.readinessNote ?? "From your lessons, quizzes and diagnostics."}
                </p>
              </div>
              {data.readiness ? (
                <p className="text-sm text-muted-foreground">
                  Overall{" "}
                  <span className="font-bold text-foreground">{data.readiness.scorePercent}%</span>{" "}
                  · {data.readiness.label}
                </p>
              ) : null}
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data.mastery.map((skill) => {
                const color = scoreColor(skill.score);
                return (
                  <li
                    key={skill.key}
                    className="flex flex-col items-center rounded-xl border border-border bg-muted/40 p-4 text-center"
                  >
                    <RadialProgress value={skill.score} color={color} size={96} stroke={8}>
                      <span className="text-lg font-extrabold text-foreground">
                        {Math.round(skill.score)}%
                      </span>
                    </RadialProgress>
                    <h3 className="mt-2 text-sm font-bold text-foreground">{skill.label}</h3>
                    <span className="text-xs text-muted-foreground">
                      {scoreBandLabel(skill.score)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      ) : null}
    </div>
  );
}

/** Streak, level and this week's XP: only while gamification is on. */
function MomentumStrip({
  gamification,
}: {
  gamification: NonNullable<LearnerDashboardData["gamification"]>;
}) {
  const { level, weeklyXp, streakDays } = gamification;
  return (
    <Link
      href="/progress"
      className={`${cardClass} block w-full p-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto lg:min-w-[22rem]`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-warning" aria-hidden="true" />
          {streakDays > 0 ? `${String(streakDays)}-day streak` : "No streak yet"}
        </span>
        {level ? (
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
            Level {level.levelNumber}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
          {formatNumber(weeklyXp)} XP this week
        </span>
      </div>
      {level ? (
        <div className="mt-2 flex items-center gap-3">
          <span
            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${String(Math.max(0, Math.min(100, level.progressPct)))}%` }}
            />
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {levelProgressLabel(level)}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

function AnnouncementBanner({
  announcement,
}: {
  announcement: NonNullable<LearnerDashboardData["announcement"]>;
}) {
  const body = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Megaphone className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-primary">From the academy</span>
        <span className="block text-sm font-semibold text-foreground">{announcement.title}</span>
        {announcement.body ? (
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
            {announcement.body}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDate(announcement.at, { day: "numeric", month: "short" })}
      </span>
    </>
  );
  return announcement.href ? (
    <Link
      href={announcement.href}
      className={`${cardClass} flex items-start gap-3 p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${cardClass} flex items-start gap-3 p-4`}>{body}</div>
  );
}

/** The one course to carry on with, its next lesson and the lesson track. */
function ContinueCard({ course }: { course: MyCourse }) {
  const started = course.status === "in_progress";
  return (
    <article
      className={`${cardClass} grid overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`}
    >
      <CoverArt
        coverKey={course.coverKey}
        category={course.category}
        title={course.title}
        className="aspect-[16/9] md:aspect-auto md:min-h-full"
      />
      <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold text-primary">
            {started ? "Continue learning" : "Start learning"}
          </p>
          <h2 className="mt-1 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
            <Link
              href={`/courses/${course.courseId}`}
              className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {course.title}
            </Link>
          </h2>
          {course.nextLesson ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {started ? "Next up: " : "First lesson: "}
              <span className="font-medium text-foreground">{course.nextLesson.title}</span>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <LessonStatusTrack
            lessons={course.lessons}
            completedLessons={course.completedLessons}
            totalLessons={course.totalLessons}
            progressPct={course.progressPct}
            currentLessonId={course.nextLesson?.id ?? null}
            label={`${course.title} progress`}
          />
          <p className="text-sm text-muted-foreground">
            {lessonsDoneLabel(course.completedLessons, course.totalLessons)} ·{" "}
            <span className="font-semibold text-foreground">{course.progressPct}%</span>
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={courseActionHref(course)} className={primaryButtonClass}>
            {courseActionLabel(course)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href={`/courses/${course.courseId}`} className={quietLinkClass}>
            Course page
          </Link>
        </div>
      </div>
    </article>
  );
}

/** No course to continue: none yet, or every course finished. */
function NextCourseCard({ finished }: { finished: boolean }) {
  return (
    <div className={`${cardClass} flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {finished ? (
          <CircleCheck className="h-6 w-6" aria-hidden="true" />
        ) : (
          <BookOpen className="h-6 w-6" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-foreground">
          {finished ? "You've finished all your courses" : "You're not enrolled in a course yet"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {finished
            ? "Pick your next course from the catalogue."
            : "Enroll in a course and it will show here with your progress."}
        </p>
      </div>
      <Link href="/courses" className={primaryButtonClass}>
        Browse courses
      </Link>
    </div>
  );
}
