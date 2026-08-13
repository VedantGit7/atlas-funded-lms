import { z } from "zod";
import type { TenantTx } from "@atlas/db";
import {
  endOfUtcDay,
  resolveTenantSubjectId,
  startOfUtcDay,
} from "@atlas/domain/analytics/analytics-definition-registry";
import { registerAnalyticsSourceAdapter } from "@atlas/domain/analytics/analytics-source-registry";
import type { AnalyticsProjectionMutation } from "@atlas/domain/analytics/analytics.types";
import { lessonCompletedPayloadSchema } from "../gamification/gamification-event.schemas";
import { gamificationAssessmentSubmittedPayloadSchema } from "../gamification/gamification-event.schemas";
import { gamificationPracticeSessionCompletedPayloadSchema } from "../gamification/gamification-event.schemas";
import { pathStepCompletedPayloadSchema } from "../gamification/gamification-event.schemas";
import { communityPostCreatedPayloadSchema } from "../community/community.events";
import { certificateIssuedOutboxPayloadSchema } from "../certificates/certificate.dto";
import { moderationReportedPayloadSchema } from "../moderation/moderation.events";
import { attemptsRepository } from "../attempts/attempts.repository";
import { assessmentsRepository } from "../assessments/assessments.repository";

function dayBucket(date = new Date()): { periodStart: Date; periodEnd: Date; day: Date } {
  const periodStart = startOfUtcDay(date);
  return {
    periodStart,
    periodEnd: endOfUtcDay(date),
    day: periodStart,
  };
}

function tenantSubject(tenantId: string) {
  return {
    subjectType: "tenant" as const,
    subjectId: resolveTenantSubjectId(tenantId),
  };
}

function courseSubject(courseId: string) {
  return {
    subjectType: "course" as const,
    subjectId: courseId,
  };
}

function rollupMutation(args: {
  rollupKey: string;
  subject: { subjectType: "tenant" | "course"; subjectId: string };
  bucket: ReturnType<typeof dayBucket>;
}): AnalyticsProjectionMutation {
  return {
    kind: "rollup",
    rollupKey: args.rollupKey,
    subject: args.subject,
    periodStart: args.bucket.periodStart,
    periodEnd: args.bucket.periodEnd,
    metricDelta: { count: 1 },
  };
}

function funnelMutation(
  stageKey: string,
  bucket: ReturnType<typeof dayBucket>,
): AnalyticsProjectionMutation {
  return {
    kind: "funnel",
    funnelKey: "learning.engagement",
    stageKey,
    day: bucket.day,
    countDelta: 1,
  };
}

async function buildAssessmentItemMutations(
  tx: TenantTx,
  attemptId: string,
): Promise<AnalyticsProjectionMutation[]> {
  const answers = await attemptsRepository.listAnswersForAttempt(tx, attemptId);
  if (answers.length === 0) {
    return [];
  }

  const assessmentItemIds = [...new Set(answers.map((answer) => answer.assessment_item_id))];
  const itemIdByAssessmentItem = new Map<string, string>();

  for (const assessmentItemId of assessmentItemIds) {
    const rows = await tx.$queryRaw<Array<{ item_id: string }>>`
      select item_id::text
      from assessment_items
      where id = ${assessmentItemId}::uuid
      limit 1
    `;
    const itemId = rows[0]?.item_id;
    if (itemId) {
      itemIdByAssessmentItem.set(assessmentItemId, itemId);
    }
  }

  const mutations: AnalyticsProjectionMutation[] = [];

  for (const answer of answers) {
    const itemId = itemIdByAssessmentItem.get(answer.assessment_item_id);
    if (!itemId) {
      continue;
    }

    const answerJson =
      answer.answer_json && typeof answer.answer_json === "object"
        ? (answer.answer_json as Record<string, unknown>)
        : {};
    const rawLatency = answerJson["latencyMs"];
    const latencyMs =
      typeof rawLatency === "number" && Number.isFinite(rawLatency) && rawLatency >= 0
        ? Math.floor(rawLatency)
        : null;

    // Live projections write all_time only; rolling_* are computed on read.
    mutations.push({
      kind: "item_statistic",
      itemId,
      windowKey: "all_time",
      attemptsDelta: 1,
      correctDelta: answer.is_correct === true ? 1 : 0,
      latencyMs,
    });
  }

  return mutations;
}

registerAnalyticsSourceAdapter({
  sourceContext: "learning",
  supportedEvents: ["lesson.completed"],
  buildMutations(_tx, ctx, event) {
    const payload = lessonCompletedPayloadSchema.parse(event.payload);
    const bucket = dayBucket(new Date(payload.completedAt));

    return Promise.resolve([
      rollupMutation({
        rollupKey: "lessons_completed",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
      rollupMutation({
        rollupKey: "lessons_completed",
        subject: courseSubject(payload.courseId),
        bucket,
      }),
      funnelMutation("lesson_completed", bucket),
    ]);
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "learning",
  supportedEvents: ["path.step_completed"],
  async buildMutations(_tx, ctx, event) {
    const payload = pathStepCompletedPayloadSchema.parse(event.payload);
    const bucket = dayBucket(new Date(payload.completedAt));

    return Promise.resolve([
      rollupMutation({
        rollupKey: "path_steps_completed",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
    ]);
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "assessment",
  supportedEvents: ["assessment.submitted"],
  async buildMutations(tx, ctx, event) {
    const payload = gamificationAssessmentSubmittedPayloadSchema.parse(event.payload);
    const bucket = dayBucket();
    const mutations: AnalyticsProjectionMutation[] = [
      rollupMutation({
        rollupKey: "assessments_submitted",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
      funnelMutation("assessment_submitted", bucket),
    ];

    const assessment = await assessmentsRepository.findById(tx, payload.assessmentId);
    const courseId =
      assessment?.config_json &&
      typeof assessment.config_json === "object" &&
      "courseId" in assessment.config_json &&
      typeof (assessment.config_json as { courseId?: unknown }).courseId === "string"
        ? (assessment.config_json as { courseId: string }).courseId
        : null;

    if (courseId) {
      mutations.push(
        rollupMutation({
          rollupKey: "assessments_submitted",
          subject: courseSubject(courseId),
          bucket,
        }),
      );
    }

    if (
      payload.status === "GRADED" ||
      (payload.scorePercent != null && payload.scorePercent >= 70)
    ) {
      mutations.push(
        rollupMutation({
          rollupKey: "assessments_passed",
          subject: tenantSubject(ctx.tenantId),
          bucket,
        }),
      );
      if (courseId) {
        mutations.push(
          rollupMutation({
            rollupKey: "assessments_passed",
            subject: courseSubject(courseId),
            bucket,
          }),
        );
      }
      mutations.push(funnelMutation("assessment_passed", bucket));
    }

    mutations.push(...(await buildAssessmentItemMutations(tx, payload.attemptId)));
    return mutations;
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "assessment",
  supportedEvents: ["practice.session_completed"],
  async buildMutations(tx, ctx, event) {
    const payload = gamificationPracticeSessionCompletedPayloadSchema.parse(event.payload);
    const bucket = dayBucket();
    const mutations: AnalyticsProjectionMutation[] = [
      rollupMutation({
        rollupKey: "practice_sessions_completed",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
      funnelMutation("practice_session_completed", bucket),
    ];

    let courseId: string | null =
      "courseId" in payload && typeof (payload as { courseId?: unknown }).courseId === "string"
        ? (payload as unknown as { courseId: string }).courseId
        : null;

    if (!courseId && payload.collectionId) {
      const rows = await tx.$queryRaw<Array<{ metadata_json: unknown }>>`
        select metadata_json
        from item_collections
        where id = ${payload.collectionId}::uuid
        limit 1
      `;
      const metadata = rows[0]?.metadata_json;
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        const raw = (metadata as Record<string, unknown>)["courseId"];
        if (typeof raw === "string" && raw.length > 0) {
          courseId = raw;
        }
      }
    }

    if (courseId) {
      mutations.push(
        rollupMutation({
          rollupKey: "practice_sessions_completed",
          subject: courseSubject(courseId),
          bucket,
        }),
      );
    }

    return mutations;
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "credentialing",
  supportedEvents: ["certificate.issued"],
  async buildMutations(_tx, ctx, event) {
    const payload = certificateIssuedOutboxPayloadSchema.parse(event.payload);
    const bucket = dayBucket(new Date(payload.issuedAt));

    return Promise.resolve([
      rollupMutation({
        rollupKey: "certificates_issued",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
      funnelMutation("certificate_issued", bucket),
    ]);
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "community",
  supportedEvents: ["community.post.created"],
  async buildMutations(_tx, ctx, event) {
    communityPostCreatedPayloadSchema.parse(event.payload);
    const bucket = dayBucket();

    return Promise.resolve([
      rollupMutation({
        rollupKey: "community_posts_created",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
      funnelMutation("community_post_created", bucket),
    ]);
  },
});

registerAnalyticsSourceAdapter({
  sourceContext: "moderation",
  supportedEvents: ["moderation.reported"],
  async buildMutations(_tx, ctx, event) {
    moderationReportedPayloadSchema.parse(event.payload);
    const bucket = dayBucket();

    return Promise.resolve([
      rollupMutation({
        rollupKey: "moderation_cases_opened",
        subject: tenantSubject(ctx.tenantId),
        bucket,
      }),
    ]);
  },
});

export const ANALYTICS_SOURCE_EVENTS = [
  "lesson.completed",
  "path.step_completed",
  "assessment.submitted",
  "practice.session_completed",
  "certificate.issued",
  "community.post.created",
  "moderation.reported",
] as const;

export const rejectedAnalyticsPayloadSchema = z
  .object({
    tenant_id: z.never().optional(),
  })
  .loose();
