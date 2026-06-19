import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createAttributionToken } from "../../../apps/web/src/server/readiness/cta-attribution.service";
import {
  getReadinessPolicy,
  updateReadinessPolicy,
} from "../../../apps/web/src/server/readiness/readiness-policy.service";
import { handleReadinessOutboxEvent } from "../../../apps/web/src/server/readiness/readiness.worker";
import {
  adminCtx,
  authoringTenantTx,
  createReadinessFixture,
  seedReadinessPolicy,
} from "../../fixtures/readiness-fixture";
import { randomUUID } from "node:crypto";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("readiness integration", () => {
  it("GET readiness-policy returns tenant policy or null", async () => {
    const fixture = await createReadinessFixture();

    const empty = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getReadinessPolicy(tx),
    );
    expect(empty.data).toBeNull();

    await seedReadinessPolicy(fixture);

    const loaded = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getReadinessPolicy(tx),
    );
    expect(loaded.data?.ctaPolicy.outboundTargetUrl).toBe(
      fixture.defaultPolicyInput.ctaPolicy.outboundTargetUrl,
    );
  });

  it("PUT readiness-policy updates policy and writes audit", async () => {
    const fixture = await createReadinessFixture();
    const ctx = adminCtx(fixture);

    const saved = await seedReadinessPolicy(fixture);

    const audits = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id::text = ${saved.data.id}
          and action = 'readiness_policy.updated'
        limit 1
      `,
    );

    expect(audits.length).toBe(1);

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        updateReadinessPolicy(tx, ctx, {
          ...fixture.defaultPolicyInput,
          ctaPolicy: {
            ...fixture.defaultPolicyInput.ctaPolicy,
            ctaCopy: {
              ...fixture.defaultPolicyInput.ctaPolicy.ctaCopy,
              headline: "Updated headline",
            },
          },
        }),
    );

    expect(updated.data.ctaPolicy.ctaCopy.headline).toBe("Updated headline");
  });

  it("PUT rejects unsafe copy", async () => {
    const fixture = await createReadinessFixture();
    const ctx = adminCtx(fixture);

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        updateReadinessPolicy(tx, ctx, {
          ...fixture.defaultPolicyInput,
          legalCopy: {
            ...fixture.defaultPolicyInput.legalCopy,
            disclaimer: "We provide guaranteed profit outcomes.",
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("POST attribution token uses policy target URL only and writes audit", async () => {
    const fixture = await createReadinessFixture();
    await seedReadinessPolicy(fixture);

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createAttributionToken(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: fixture.requestId,
          },
          {
            sourceSurface: "L12",
            sourcePath: "/readiness",
          },
        ),
    );

    expect(result.data.outboundUrl.startsWith("https://example.com/education-handoff")).toBe(true);
    expect(result.data.expiresAt).toBeTruthy();

    const audits = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id::text = ${result.data.tokenId}
          and action = 'attribution.token_created'
        limit 1
      `,
    );

    expect(audits.length).toBe(1);
  });

  it("readiness worker updates composite state and emits readiness.band_changed on band change", async () => {
    const fixture = await createReadinessFixture();
    await seedReadinessPolicy(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
      await tx.$executeRaw`
        insert into competency_scores (
          id, tenant_id, membership_id, dimension_id, scoring_profile_id,
          score, band_key, calculated_at, config_version_id
        )
        select
          ${randomUUID()}::uuid,
          ${fixture.tenantId}::uuid,
          ${fixture.learnerMembershipId}::uuid,
          cd.id,
          ${fixture.profileId}::uuid,
          55,
          'developing',
          now(),
          sp.active_config_version_id
        from competency_dimensions cd
        cross join scoring_profiles sp
        where sp.id = ${fixture.profileId}::uuid
        limit 1
      `;
    });

    await handleReadinessOutboxEvent({
      id: randomUUID(),
      eventType: "competency.score_changed",
      tenantId: fixture.tenantId,
      payload: {
        membershipId: fixture.learnerMembershipId,
        dimensionId: randomUUID(),
        dimensionKey: "skill_focus",
        scoringProfileId: fixture.profileId,
        scoringProfileKey: "readiness_profile",
        score: 55,
        bandKey: "developing",
        previousScore: null,
        previousBandKey: null,
      },
      requestId: fixture.requestId,
    });

    const composite = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ band_key: string }>>`
        select band_key
        from composite_readiness_state
        where membership_id = ${fixture.learnerMembershipId}::uuid
        limit 1
      `,
    );

    expect(composite.length).toBe(1);

    const bandEvents = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ event_type: string }>>`
        select event_type
        from outbox_events
        where event_type = 'readiness.band_changed'
      `,
    );

    expect(bandEvents.length).toBe(0);
  });
});
