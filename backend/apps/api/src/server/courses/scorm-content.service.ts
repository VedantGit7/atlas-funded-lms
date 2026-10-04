import { can } from "@atlas/authorization";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import { loadModuleLessonsResourceRef } from "./load-course-resource-ref";
import { requireEnrolledScormModule } from "./module-scorm-learner.service";
import { findModuleScormProgress } from "./module-scorm-progress.repository";
import type { ScormContentCapability } from "./scorm-content-capability";
import {
  readableScormValues,
  scormEntryFor,
  SCORM_TOTAL_SECONDS_KEY,
  type ScormRuntimeConfig,
} from "./scorm-runtime";

/** One answer for every refusal, so a capability holder learns nothing about why. */
export function scormContentNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "SCORM content file was not found.",
  });
}

/**
 * Re-authorizes a capability on every package request.
 *
 * The capability only names who and what; this decides whether that still
 * holds: the membership is active, it still has `course.read` on the course,
 * the module is still a published SCORM module in a published course, the
 * enrollment is still active, and the stored package is still the version the
 * launch was minted for. Any change takes effect on the next file.
 */
export async function authorizeScormContentRequest(
  tx: TenantTx,
  capability: ScormContentCapability,
  requestId: string,
): Promise<void> {
  const ctx = {
    tenantId: capability.tenantId,
    actorMembershipId: capability.membershipId,
    requestId,
  };
  const membership = await tx.$queryRaw<Array<{ status: string }>>`
    select status::text
    from memberships
    where id = ${capability.membershipId}::uuid
      and tenant_id = ${capability.tenantId}::uuid
    limit 1
  `;
  if (membership[0]?.status !== "ACTIVE") throw scormContentNotFound();

  try {
    const resource = await loadModuleLessonsResourceRef({
      tx,
      ctx,
      moduleId: capability.moduleId,
      requirePublished: true,
    });
    const decision = await can({
      tx,
      actor: { tenantId: capability.tenantId, membershipId: capability.membershipId },
      permission: "course.read",
      resource,
      ctx: { tenantId: capability.tenantId, requestId },
    });
    if (!decision.allowed) throw scormContentNotFound();

    const module = await requireEnrolledScormModule(tx, ctx, capability.moduleId);
    if ((module.scormContentVersion ?? null) !== capability.contentVersion)
      throw scormContentNotFound();
  } catch (error) {
    // Never let a 403 vs 404 vs validation difference leak through.
    if (error instanceof AtlasHttpError) throw scormContentNotFound();
    throw error;
  }
}

/** What a package document's runtime starts from: saved data plus the learner's identity. */
export async function loadScormRuntimeConfig(
  tx: TenantTx,
  capability: ScormContentCapability,
): Promise<ScormRuntimeConfig> {
  // Sequential: one transaction is one connection.
  const progress = await findModuleScormProgress({
    tx,
    moduleId: capability.moduleId,
    membershipId: capability.membershipId,
  });
  const profile = await tx.$queryRaw<Array<{ display_name: string | null }>>`
    select display_name
    from member_profiles
    where membership_id = ${capability.membershipId}::uuid
      and tenant_id = ${capability.tenantId}::uuid
    limit 1
  `;
  const cmi = progress?.cmiJson ?? null;
  const totalSeconds = Number(cmi?.[SCORM_TOTAL_SECONDS_KEY] ?? 0);
  return {
    launchId: capability.launchId,
    version: capability.scormVersion,
    values: readableScormValues(cmi ?? {}),
    // An opaque per-tenant id: content commonly echoes this, and it must not be an email.
    learnerId: capability.membershipId,
    learnerName: profile[0]?.display_name?.trim() ?? "",
    entry: scormEntryFor(cmi),
    totalSeconds: Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0,
  };
}
