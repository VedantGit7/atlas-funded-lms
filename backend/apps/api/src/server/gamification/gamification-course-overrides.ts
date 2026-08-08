import type { TenantTx } from "@atlas/db";
import type { GamificationRulesConfig } from "./gamification.types";

type CourseGamificationOverrides = Pick<GamificationRulesConfig, "xpRules">;

export async function readCourseGamificationOverrides(
  tx: TenantTx,
  courseId: string,
): Promise<CourseGamificationOverrides> {
  const rows = await tx.$queryRaw<Array<{ metadata_json: unknown }>>`
    select metadata_json
    from courses
    where id = ${courseId}::uuid
    limit 1
  `;

  const metadata = rows[0]?.metadata_json;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const tags = (metadata as Record<string, unknown>)["tags"];
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
    return {};
  }

  const studioFeatures = (tags as Record<string, unknown>)["studioFeatures"];
  if (!studioFeatures || typeof studioFeatures !== "object" || Array.isArray(studioFeatures)) {
    return {};
  }

  const gamification = (studioFeatures as Record<string, unknown>)["gamification"];
  if (!gamification || typeof gamification !== "object" || Array.isArray(gamification)) {
    return {};
  }

  const xpRules = (gamification as Record<string, unknown>)["xpRules"];
  if (!Array.isArray(xpRules)) {
    return {};
  }

  return { xpRules: xpRules as GamificationRulesConfig["xpRules"] };
}
