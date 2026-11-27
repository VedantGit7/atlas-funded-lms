import type { TenantTx } from "@atlas/db";
import { isHttpUrl } from "@atlas/core/text/safe-text";
import { readInstructorIds } from "./course-instructors";
import { pickResumeLesson } from "../lessons/lessons.repository";

/**
 * What a learner sees about a course before and after enrolling (QA review 1
 * M38, M50; review 2 "course page thin"). Studio keeps these in the course's
 * tags; only the parts meant for learners are read out here, so the rest of
 * the Studio settings never reach the learner page.
 */

export const MAX_COURSE_OUTCOMES = 12;
export const MAX_COURSE_OUTCOME_LENGTH = 200;
const MAX_COURSE_FAQS = 50;

type Tags = Record<string, unknown> | undefined;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function courseTags(metadata: Record<string, unknown> | null): Tags {
  return record(metadata?.["tags"]) ?? undefined;
}

/** "What you'll learn": Settings › Branding, one point per line. */
export function readCourseOutcomes(tags: Tags): string[] {
  const raw = record(tags?.["studioBranding"])?.["outcomes"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_COURSE_OUTCOME_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, MAX_COURSE_OUTCOMES);
}

/** Settings › FAQs, in the author's order; questions without text are skipped. */
export function readCourseFaqs(tags: Tags): Array<{ question: string; answer: string }> {
  const raw = record(tags?.["studioFaqs"])?.["items"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const item = record(entry);
      const position = typeof item?.["position"] === "number" ? item["position"] : index;
      const question = typeof item?.["question"] === "string" ? item["question"].trim() : "";
      const answer = typeof item?.["answer"] === "string" ? item["answer"].trim() : "";
      return { position, question, answer };
    })
    .filter((item) => item.question.length > 0)
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_COURSE_FAQS)
    .map(({ question, answer }) => ({ question, answer }));
}

/** The promotional video link from Settings › Branding; only an http(s) link. */
export function readCoursePromoVideoUrl(tags: Tags): string | null {
  const raw = record(tags?.["studioBranding"])?.["promoVideoUrl"];
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return url && isHttpUrl(url) ? url : null;
}

export function readCourseShortDescription(
  metadata: Record<string, unknown> | null,
): string | null {
  const raw = metadata?.["shortDescription"];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/** The category chosen in the New course dialog (kept in tags) or set on the course. */
export function readCourseCategory(metadata: Record<string, unknown> | null): string | null {
  const tags = courseTags(metadata);
  for (const raw of [metadata?.["category"], tags?.["category"], metadata?.["stage"]]) {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

export type CourseInstructor = { name: string; avatarUrl: string | null };

export type CourseDetailExtras = {
  instructors: CourseInstructor[];
  studentCount: number;
  /** The lesson "Continue" opens; null when the learner isn't enrolled. */
  resumeLessonId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Settings › Instructors in order, or the course's creator when none are set. */
export function courseInstructorIds(tags: Tags, createdByMembershipId: string | null): string[] {
  const configured = readInstructorIds(tags).filter((id) => UUID.test(id));
  const ids =
    configured.length > 0 ? configured : createdByMembershipId ? [createdByMembershipId] : [];
  return [...new Set(ids)].slice(0, 10);
}

type ExtrasRow = {
  learner_count: bigint | number;
  instructors: Array<{
    membershipId: string;
    name: string | null;
    avatarKey: string | null;
  }> | null;
  progress: Array<{ lessonId: string; status: string | null; lastSeenAt: string | null }> | null;
};

/**
 * Everything the learner course page adds to the course in one round trip:
 * the instructors, the number of learners and, for an enrolled learner, the
 * lesson to resume. The course read is on a measured hot path (audit §3.1),
 * so this replaces the resume query rather than adding to it.
 *
 * Instructors are named by their profile name, else their account name;
 * never by email (QA review 1 m18).
 */
export async function loadCourseDetailExtras(args: {
  tx: TenantTx;
  courseId: string;
  tags: Tags;
  createdByMembershipId: string | null;
  /** The enrolled learner whose resume lesson to find; null when not enrolled. */
  enrolledMembershipId: string | null;
}): Promise<CourseDetailExtras> {
  const ids = courseInstructorIds(args.tags, args.createdByMembershipId);
  const rows = await args.tx.$queryRaw<ExtrasRow[]>`
    select
      (
        select count(*)::bigint
        from enrollments en
        where en.course_id = ${args.courseId}::uuid
          and en.status = 'active'
      ) as learner_count,
      (
        select json_agg(
          json_build_object(
            'membershipId', m.id::text,
            'name', coalesce(nullif(btrim(mp.display_name), ''), nullif(btrim(ap.name), '')),
            'avatarKey', mp.avatar_key
          )
        )
        from memberships m
        left join member_profiles mp
          on mp.tenant_id = m.tenant_id
         and mp.membership_id = m.id
         and mp.deleted_at is null
        left join auth_principals ap
          on ap.id = m.auth_principal_id
        where m.tenant_id = app.current_tenant_id()
          and m.id = any(${ids}::uuid[])
          and m.status in ('ACTIVE', 'INVITED')
      ) as instructors,
      (
        select json_agg(
          json_build_object('lessonId', l.id::text, 'status', lp.status, 'lastSeenAt', lp.last_seen_at)
          order by cm.position asc, l.position asc
        )
        from lessons l
        inner join course_modules cm
          on cm.id = l.module_id
         and cm.tenant_id = l.tenant_id
        left join lesson_progress lp
          on lp.lesson_id = l.id
         and lp.membership_id = ${args.enrolledMembershipId}::uuid
        where ${args.enrolledMembershipId}::uuid is not null
          and cm.course_id = ${args.courseId}::uuid
          and cm.deleted_at is null
          and cm.status = 'PUBLISHED'
          and l.deleted_at is null
          and l.status = 'PUBLISHED'
      ) as progress
  `;
  const row = rows[0];

  const byId = new Map((row?.instructors ?? []).map((person) => [person.membershipId, person]));
  const instructors: CourseInstructor[] = [];
  for (const id of ids) {
    const person = byId.get(id);
    if (!person?.name) continue;
    const avatar = person.avatarKey?.trim() ?? "";
    instructors.push({
      name: person.name,
      avatarUrl: /^(https?:\/\/|\/)\S+$/i.test(avatar) ? avatar : null,
    });
  }

  return {
    instructors,
    studentCount: Number(row?.learner_count ?? 0),
    resumeLessonId:
      args.enrolledMembershipId === null
        ? null
        : pickResumeLesson(
            (row?.progress ?? []).map((lesson) => ({
              lesson_id: lesson.lessonId,
              status: lesson.status,
              last_seen_at: lesson.lastSeenAt ? new Date(lesson.lastSeenAt) : null,
            })),
          ),
  };
}
