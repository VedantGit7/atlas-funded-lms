import type { TenantTx } from "@atlas/db";
import { isHttpUrl } from "@atlas/core/text/safe-text";
import { readInstructorIds } from "./course-instructors";

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

/**
 * The course's instructors from Settings › Instructors, in that order, or the
 * person who created it when none are set. Each is named by their profile
 * name, else their account name; never by email (QA review 1 m18).
 */
export async function listCourseInstructors(args: {
  tx: TenantTx;
  tags: Tags;
  createdByMembershipId: string | null;
}): Promise<CourseInstructor[]> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const configured = readInstructorIds(args.tags).filter((id) => uuid.test(id));
  const ids = [
    ...new Set(
      configured.length > 0
        ? configured
        : args.createdByMembershipId
          ? [args.createdByMembershipId]
          : [],
    ),
  ].slice(0, 10);
  if (ids.length === 0) return [];

  const rows = await args.tx.$queryRaw<
    Array<{ membership_id: string; name: string | null; avatar_key: string | null }>
  >`
    select
      m.id::text as membership_id,
      coalesce(nullif(btrim(mp.display_name), ''), nullif(btrim(ap.name), '')) as name,
      mp.avatar_key
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
  `;
  const byId = new Map(rows.map((row) => [row.membership_id, row]));
  const instructors: CourseInstructor[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row?.name) continue;
    const avatar = row.avatar_key?.trim() ?? "";
    instructors.push({
      name: row.name,
      avatarUrl: /^(https?:\/\/|\/)\S+$/i.test(avatar) ? avatar : null,
    });
  }
  return instructors;
}

export async function countCourseLearners(tx: TenantTx, courseId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from enrollments
    where course_id = ${courseId}::uuid
      and status = 'active'
  `;
  return Number(rows[0]?.count ?? 0);
}
