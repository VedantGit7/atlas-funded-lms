import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { createAttributionToken } from "../../backend/apps/api/src/server/readiness/cta-attribution.service";
import {
  getReadinessPolicy,
  updateReadinessPolicy,
} from "../../backend/apps/api/src/server/readiness/readiness-policy.service";
import {
  adminCtx,
  authoringTenantTx,
  createReadinessFixture,
  seedReadinessPolicy,
} from "../fixtures/readiness-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("readiness tenant isolation", () => {
  it("Tenant A cannot read Tenant B policy through update", async () => {
    const fixture = await createReadinessFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = adminCtx(fixture);

    const policyId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into readiness_policies (
          id, tenant_id, key, scoring_profile_id, cta_policy_json, legal_copy_json, status, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'default',
          ${fixture.profileId}::uuid,
          ${JSON.stringify(fixture.defaultPolicyInput.ctaPolicy)}::jsonb,
          ${JSON.stringify(fixture.defaultPolicyInput.legalCopy)}::jsonb,
          'ACTIVE'::"EntityStatus",
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        updateReadinessPolicy(tx, ctx, {
          ...fixture.defaultPolicyInput,
          ctaPolicy: {
            ...fixture.defaultPolicyInput.ctaPolicy,
            ctaCopy: {
              ...fixture.defaultPolicyInput.ctaPolicy.ctaCopy,
              headline: "Hijacked",
            },
          },
        }),
      ),
    ).resolves.toBeTruthy();

    const tenantBPolicy = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const rows = await tx.$queryRaw<Array<{ headline: string }>>`
        select cta_policy_json->'ctaCopy'->>'headline' as headline
        from readiness_policies
        where id = ${policyId}::uuid
      `;
      return rows[0]?.headline;
    });

    expect(tenantBPolicy).not.toBe("Hijacked");
  });

  it("Tenant A cannot mint token using Tenant B policy", async () => {
    const fixture = await createReadinessFixture();
    const tenantB = await createTenantIsolationFixture();
    await seedReadinessPolicy(fixture);

    await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      await tx.$executeRaw`
        insert into readiness_policies (
          id, tenant_id, key, scoring_profile_id, cta_policy_json, legal_copy_json, status, created_at, updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'default',
          ${fixture.profileId}::uuid,
          ${JSON.stringify({
            ...fixture.defaultPolicyInput.ctaPolicy,
            outboundTargetUrl: "https://tenant-b.example/handoff",
          })}::jsonb,
          ${JSON.stringify(fixture.defaultPolicyInput.legalCopy)}::jsonb,
          'ACTIVE'::"EntityStatus",
          now(),
          now()
        )
      `;
    });

    const token = await withTenantTx(
      authoringTenantTx(fixture, fixture.learnerMembershipId),
      async (tx) =>
        createAttributionToken(
          tx,
          {
            tenantId: fixture.tenantId,
            actorMembershipId: fixture.learnerMembershipId,
            requestId: fixture.requestId,
          },
          { sourceSurface: "L12", sourcePath: "/readiness" },
        ),
    );

    expect(token.data.outboundUrl).toContain("example.com/education-handoff");
    expect(token.data.outboundUrl).not.toContain("tenant-b.example");

    const tenantBPolicy = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) =>
      getReadinessPolicy(tx),
    );
    expect(tenantBPolicy.data?.ctaPolicy.outboundTargetUrl).toBe(
      "https://tenant-b.example/handoff",
    );
  });
});
