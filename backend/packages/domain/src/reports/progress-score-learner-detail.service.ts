import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  extendProgressLearnerBodySchema,
  extendProgressLearnerResponseSchema,
  progressLearnerDetailResponseSchema,
  resetProgressLearnerBodySchema,
  resetProgressLearnerResponseSchema,
  type ProgressProductType,
} from "./progress-score-roster.dto";
import {
  progressScoreEnrollmentNotFound,
  progressScoreResetFailed,
} from "./progress-score-roster.errors";
import { progressScoreLearnerDetailRepository } from "./progress-score-learner-detail.repository";
import type {
  LearnerDetailActivityDayRow,
  LearnerDetailLessonRow,
} from "./progress-score-learner-detail.repository";

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function mapPaymentStatus(
  enrolledType: string,
): "paid" | "comped" | "trial" | "unknown" {
  const key = enrolledType.trim().toLowerCase();
  if (key === "paid" || key === "purchase" || key === "direct_purchase") return "paid";
  if (key === "comped" || key === "comp" || key === "complimentary" || key === "free" || key === "gift")
    return "comped";
  if (key === "trial") return "trial";
  return "unknown";
}

function mapAccessStatus(
  status: string,
  expiresAt: Date | null,
): "active" | "expired" | "revoked" | "pending" {
  const key = status.trim().toLowerCase();
  if (key === "revoked" || key === "cancelled" || key === "canceled") return "revoked";
  if (key === "pending" || key === "invited") return "pending";
  if (expiresAt && expiresAt.getTime() < Date.now()) return "expired";
  if (key === "active") return "active";
  if (key === "expired") return "expired";
  return "active";
}

function formatDurationLabel(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (mins > 0) {
    return secs > 0 && secs >= 30 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${secs}s`;
}

function formatWatchProgress(
  progressPct: number,
  durationSeconds: number | null,
): string | null {
  if (durationSeconds == null || durationSeconds <= 0) return null;
  const watched = Math.round((Math.min(100, Math.max(0, progressPct)) / 100) * durationSeconds);
  const watchedLabel = formatDurationLabel(watched);
  const totalLabel = formatDurationLabel(durationSeconds);
  if (!watchedLabel || !totalLabel) return null;
  return `${watchedLabel} / ${totalLabel}`;
}

function lessonStatus(
  row: LearnerDetailLessonRow,
): "completed" | "in_progress" | "not_started" {
  if (row.progress_status === "completed" || (row.progress_pct ?? 0) >= 100) {
    return "completed";
  }
  if ((row.progress_pct ?? 0) > 0 || row.progress_status === "in_progress") {
    return "in_progress";
  }
  return "not_started";
}

function computeOutOfOrderFlags(lessons: LearnerDetailLessonRow[]): Set<string> {
  const ordered = lessons.map((lesson, index) => ({
    lesson,
    globalIndex: index,
  }));

  const outOfOrder = new Set<string>();
  for (const item of ordered) {
    if (lessonStatus(item.lesson) !== "completed") continue;
    const earlierIncomplete = ordered.some(
      (other) =>
        other.globalIndex < item.globalIndex && lessonStatus(other.lesson) !== "completed",
    );
    if (earlierIncomplete) {
      outOfOrder.add(item.lesson.lesson_id);
    }
  }
  return outOfOrder;
}

function activityLevel(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function computeLongestGap(days: LearnerDetailActivityDayRow[]): {
  longestGapDays: number | null;
  longestGapLabel: string | null;
} {
  const activeIndexes = days
    .map((day, index) => (day.event_count > 0 ? index : -1))
    .filter((index) => index >= 0);

  if (activeIndexes.length === 0) {
    return { longestGapDays: null, longestGapLabel: null };
  }

  let longest = 0;
  let longestEndIndex = -1;

  for (let i = 1; i < activeIndexes.length; i += 1) {
    const gap = activeIndexes[i]! - activeIndexes[i - 1]! - 1;
    if (gap > longest) {
      longest = gap;
      longestEndIndex = activeIndexes[i]!;
    }
  }

  // Trailing inactivity after last activity until today
  const trailing = days.length - 1 - activeIndexes[activeIndexes.length - 1]!;
  if (trailing > longest) {
    longest = trailing;
    longestEndIndex = days.length - 1;
  }

  if (longest <= 0 || longestEndIndex < 0) {
    return { longestGapDays: null, longestGapLabel: null };
  }

  const endDay = days[longestEndIndex];
  const monthLabel = endDay
    ? endDay.activity_date.toLocaleString("en-GB", { month: "long" })
    : null;

  return {
    longestGapDays: longest,
    longestGapLabel: monthLabel
      ? `${longest} day${longest === 1 ? "" : "s"} in ${monthLabel}`
      : `${longest} day${longest === 1 ? "" : "s"}`,
  };
}

function enrolledTypeLabel(enrolledType: string): string {
  const key = enrolledType.trim().toLowerCase();
  if (key === "paid" || key === "purchase" || key === "direct_purchase") {
    return "Direct Purchase";
  }
  if (key === "free") return "Free";
  if (key === "comped" || key === "comp" || key === "gift") return "Comped";
  if (key === "trial") return "Trial";
  if (key === "batch" || key === "group") return "Batch / Group";
  return enrolledType
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getProgressLearnerDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
) {
  const header = await progressScoreLearnerDetailRepository.getEnrollmentHeader(
    tx,
    productType,
    productId,
    enrollmentId,
  );
  if (!header) {
    throw progressScoreEnrollmentNotFound();
  }

  const curriculumAvailable = productType === "course";
  const lessons = curriculumAvailable
    ? await progressScoreLearnerDetailRepository.listCourseCurriculumProgress(
        tx,
        productId,
        header.membership_id,
      )
    : [];

  const outOfOrderIds = computeOutOfOrderFlags(lessons);
  const completedLessons = lessons.filter((lesson) => lessonStatus(lesson) === "completed").length;
  const totalLessons = lessons.length;
  const completionPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const lastActiveAt = lessons.reduce<Date | null>((latest, lesson) => {
    const candidate = lesson.last_seen_at ?? lesson.completed_at;
    if (!candidate) return latest;
    if (!latest || candidate.getTime() > latest.getTime()) return candidate;
    return latest;
  }, null);

  type MappedLesson = {
    lessonId: string;
    title: string;
    lessonType: LearnerDetailLessonRow["lesson_type"];
    position: number;
    status: "completed" | "in_progress" | "not_started";
    progressPct: number;
    durationLabel: string | null;
    completedAt: string | null;
    lastSeenAt: string | null;
    outOfOrder: boolean;
    quizScorePct: number | null;
    quizAttemptId: string | null;
  };

  const modulesMap = new Map<
    string,
    {
      moduleId: string;
      title: string;
      position: number;
      lessons: MappedLesson[];
    }
  >();

  for (const lesson of lessons) {
    const status = lessonStatus(lesson);
    const progressPct = Math.min(100, Math.max(0, lesson.progress_pct ?? 0));
    const durationLabel =
      status === "in_progress"
        ? formatWatchProgress(progressPct, lesson.duration_seconds) ??
          formatDurationLabel(lesson.duration_seconds)
        : formatDurationLabel(lesson.duration_seconds);

    const mapped: MappedLesson = {
      lessonId: lesson.lesson_id,
      title: lesson.lesson_title,
      lessonType: lesson.lesson_type,
      position: lesson.lesson_position,
      status,
      progressPct,
      durationLabel,
      completedAt: toIso(lesson.completed_at),
      lastSeenAt: toIso(lesson.last_seen_at),
      outOfOrder: outOfOrderIds.has(lesson.lesson_id),
      quizScorePct:
        lesson.quiz_score_pct == null
          ? null
          : Math.round(Number(lesson.quiz_score_pct) * 10) / 10,
      quizAttemptId: lesson.quiz_attempt_id,
    };

    const existing = modulesMap.get(lesson.module_id);
    if (existing) {
      existing.lessons.push(mapped);
    } else {
      modulesMap.set(lesson.module_id, {
        moduleId: lesson.module_id,
        title: lesson.module_title,
        position: lesson.module_position,
        lessons: [mapped],
      });
    }
  }

  const modules = Array.from(modulesMap.values())
    .sort((a, b) => a.position - b.position)
    .map((module) => ({
      moduleId: module.moduleId,
      title: module.title,
      position: module.position,
      completedLessons: module.lessons.filter((lesson) => lesson.status === "completed").length,
      totalLessons: module.lessons.length,
      lessons: module.lessons,
    }));

  const [activityDays, assessments, certificate] = await Promise.all([
    curriculumAvailable
      ? progressScoreLearnerDetailRepository.listActivityDays(
          tx,
          productId,
          header.membership_id,
        )
      : Promise.resolve([] as LearnerDetailActivityDayRow[]),
    curriculumAvailable
      ? progressScoreLearnerDetailRepository.listCourseAssessmentsForLearner(
          tx,
          productId,
          header.membership_id,
        )
      : Promise.resolve([]),
    curriculumAvailable
      ? progressScoreLearnerDetailRepository.getCourseCertificate(
          tx,
          productId,
          header.membership_id,
        )
      : Promise.resolve({ issued: false, issued_at: null, credential_id: null }),
  ]);

  const maxActivity = activityDays.reduce((max, day) => Math.max(max, day.event_count), 0);
  const gap = computeLongestGap(activityDays);
  const assessmentsPassed = assessments.filter((row) => row.result_status === "pass").length;

  const paymentStatus = mapPaymentStatus(header.enrolled_type);
  const accessStatus = mapAccessStatus(header.status, header.expires_at);

  return progressLearnerDetailResponseSchema.parse({
    data: {
      product: {
        productType,
        productId: header.product_id,
        title: header.product_title,
      },
      learner: {
        enrollmentId: header.enrollment_id,
        membershipId: header.membership_id,
        displayName: header.display_name?.trim() || header.email || "Unnamed learner",
        email: header.email,
        avatarUrl: null,
        paymentStatus,
        accessStatus,
        expiresAt: toIso(header.expires_at),
      },
      summary: {
        completionPct,
        completedLessons,
        totalLessons,
        timeOnContentLabel: null,
        lastActiveAt: toIso(lastActiveAt),
        assessmentsPassed,
        assessmentsTotal: assessments.length,
      },
      modules,
      activity: {
        days: activityDays.map((day) => ({
          date: day.activity_date.toISOString().slice(0, 10),
          count: day.event_count,
          level: activityLevel(day.event_count, maxActivity),
        })),
        longestGapDays: gap.longestGapDays,
        longestGapLabel: gap.longestGapLabel,
      },
      assessments: assessments.map((row) => ({
        assessmentId: row.assessment_id,
        title: row.title,
        scorePct:
          row.score_pct == null ? null : Math.round(Number(row.score_pct) * 10) / 10,
        resultStatus: row.result_status,
        attemptNumber: row.attempt_number,
        attemptId: row.attempt_id,
        submittedAt: toIso(row.submitted_at),
      })),
      enrolment: {
        enrollmentId: header.enrollment_id,
        enrolledType: enrolledTypeLabel(header.enrolled_type),
        sourceLabel: null,
        grantedByLabel: null,
        enrolledAt: header.enrolled_at.toISOString(),
        certificateIssued: certificate.issued,
        certificateLabel: certificate.issued
          ? certificate.credential_id
            ? `Issued · ${certificate.credential_id}`
            : toIso(certificate.issued_at)
          : totalLessons > 0 && completionPct < 100
            ? "N/A (Incomplete)"
            : "N/A",
      },
      capabilities: {
        canResetProgress: curriculumAvailable,
        canExtendAccess: true,
        canMessage: true,
        curriculumAvailable,
      },
    },
  });
}

export async function resetProgressLearner(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
  rawBody: unknown,
) {
  if (productType !== "course") {
    throw progressScoreResetFailed(
      "Progress reset is only available for course enrolments with lesson progress.",
    );
  }

  const body = resetProgressLearnerBodySchema.parse(rawBody);
  const header = await progressScoreLearnerDetailRepository.getEnrollmentHeader(
    tx,
    productType,
    productId,
    enrollmentId,
  );
  if (!header) {
    throw progressScoreEnrollmentNotFound();
  }

  const result = await progressScoreLearnerDetailRepository.resetCourseProgress(
    tx,
    productId,
    header.membership_id,
    enrollmentId,
    body.clearAssessmentAttempts,
  );

  return resetProgressLearnerResponseSchema.parse({
    data: {
      enrollmentId,
      lessonsCleared: result.lessonsCleared,
      attemptsCleared: result.attemptsCleared,
    },
  });
}

export async function extendProgressLearnerAccess(
  tx: TenantTx,
  _ctx: ServiceCtx,
  productType: ProgressProductType,
  productId: string,
  enrollmentId: string,
  rawBody: unknown,
) {
  const body = extendProgressLearnerBodySchema.parse(rawBody);
  const expiresAt = new Date(body.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    throw progressScoreResetFailed("Invalid expiry date.");
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw progressScoreResetFailed("Expiry must be in the future.");
  }

  const header = await progressScoreLearnerDetailRepository.getEnrollmentHeader(
    tx,
    productType,
    productId,
    enrollmentId,
  );
  if (!header) {
    throw progressScoreEnrollmentNotFound();
  }

  const updated = await progressScoreLearnerDetailRepository.extendEnrollmentAccess(
    tx,
    productType,
    productId,
    enrollmentId,
    expiresAt,
  );

  return extendProgressLearnerResponseSchema.parse({
    data: {
      enrollmentId,
      expiresAt: toIso(updated),
    },
  });
}
