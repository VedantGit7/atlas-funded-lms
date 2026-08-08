import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createCompetencyConfigFixture,
  seedDimension,
  seedScoringProfile,
} from "./competency-config-fixture";
import {
  publishScoringConfig,
  replaceProfileBands,
} from "../../backend/apps/api/src/server/competency/scoring-config.service";
import { updateReadinessPolicy } from "../../backend/apps/api/src/server/readiness/readiness-policy.service";

export { adminCtx, authoringTenantTx } from "./competency-config-fixture";

export type ReadinessFixture = Awaited<ReturnType<typeof createReadinessFixture>>;

export async function createReadinessFixture() {
  const fixture = await createCompetencyConfigFixture();
  const ctx = adminCtx(fixture);

  const profileId = await seedScoringProfile(fixture, {
    key: "readiness_profile",
    name: "Readiness Profile",
  });

  await seedDimension(fixture, { key: "skill_focus", name: "Skill Focus" });

  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await replaceProfileBands(tx, ctx, profileId, {
      bands: [
        {
          key: "developing",
          label: "Developing",
          minScore: 0,
          maxScore: 59.9999,
          sortOrder: 1,
        },
        {
          key: "proficient",
          label: "Proficient",
          minScore: 60,
          maxScore: 100,
          sortOrder: 2,
        },
      ],
    });
    await publishScoringConfig(tx, ctx, profileId, {});
  });

  const defaultPolicyInput = {
    scoringProfileId: profileId,
    ctaPolicy: {
      outboundTargetUrl: "https://example.com/education-handoff",
      tokenTtlSeconds: 3600,
      bandProminenceRules: [
        { bandKey: "developing", prominence: "hidden" as const },
        { bandKey: "proficient", prominence: "prominent" as const },
      ],
      ctaCopy: {
        headline: "Continue learning externally",
        body: "Explore the next educational step when you feel ready.",
        buttonLabel: "Continue externally",
      },
    },
    legalCopy: {
      disclaimer:
        "This readiness view is educational only and does not constitute investment advice.",
      bandNotes: {
        developing: "Keep building foundational skills.",
        proficient: "You may explore the external educational handoff.",
      },
      legalReviewChecklist: ["Educational framing verified."],
    },
  };

  return {
    ...fixture,
    profileId,
    defaultPolicyInput,
    requestId: `req_readiness_${randomUUID().slice(0, 8)}`,
  };
}

export async function seedReadinessPolicy(fixture: ReadinessFixture) {
  return withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
    updateReadinessPolicy(
      tx,
      {
        tenantId: fixture.tenantId,
        actorMembershipId: fixture.adminMembershipId,
        requestId: fixture.requestId,
      },
      fixture.defaultPolicyInput,
    ),
  );
}
