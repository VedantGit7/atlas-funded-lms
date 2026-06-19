import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  deleteCompetencyDimension,
  listCompetencyDimensions,
  updateCompetencyDimension,
} from "../../apps/web/src/server/competency/competency-config.service";
import {
  listProfileBands,
  publishScoringConfig,
  replaceProfileBands,
} from "../../apps/web/src/server/competency/scoring-config.service";
import {
  adminCtx,
  authoringTenantTx,
  createCompetencyConfigFixture,
} from "../fixtures/competency-config-fixture";
import { createTenantIsolationFixture, tenantCtx } from "./tenant-isolation-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("competency config tenant isolation", () => {
  it("Tenant A cannot read Tenant B dimensions by update", async () => {
    const fixture = await createCompetencyConfigFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = adminCtx(fixture);

    const dimensionId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into competency_dimensions (
          id, tenant_id, key, name, description, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_dim',
          'Tenant B Dimension',
          null,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        updateCompetencyDimension(tx, ctx, dimensionId, { name: "Hijacked" }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot delete Tenant B dimension", async () => {
    const fixture = await createCompetencyConfigFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = adminCtx(fixture);

    const dimensionId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into competency_dimensions (
          id, tenant_id, key, name, description, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_delete',
          'Tenant B Delete',
          null,
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        deleteCompetencyDimension(tx, ctx, dimensionId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A list excludes Tenant B dimensions", async () => {
    const fixture = await createCompetencyConfigFixture();

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listCompetencyDimensions(tx),
    );

    expect(result.data.every((item) => item.key !== "tenant_b_dim")).toBe(true);
  });

  it("Tenant A cannot update bands for Tenant B profile", async () => {
    const fixture = await createCompetencyConfigFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = adminCtx(fixture);

    const profileId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into scoring_profiles (
          id, tenant_id, key, name, status, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_profile',
          'Tenant B Profile',
          'ACTIVE',
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        replaceProfileBands(tx, ctx, profileId, {
          bands: [{ key: "x", label: "X", minScore: 0, maxScore: 100, sortOrder: 0 }],
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot publish Tenant B scoring config", async () => {
    const fixture = await createCompetencyConfigFixture();
    const tenantB = await createTenantIsolationFixture();
    const ctx = adminCtx(fixture);

    const profileId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into scoring_profiles (
          id, tenant_id, key, name, status, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_publish',
          'Tenant B Publish',
          'ACTIVE',
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        publishScoringConfig(tx, ctx, profileId, {}),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("Tenant A cannot read Tenant B profile bands", async () => {
    const fixture = await createCompetencyConfigFixture();
    const tenantB = await createTenantIsolationFixture();

    const profileId = await withTenantTx(tenantCtx(tenantB.tenantA), async (tx) => {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into scoring_profiles (
          id, tenant_id, key, name, status, created_at, updated_at
        )
        values (
          ${id}::uuid,
          ${tenantB.tenantA.tenantId}::uuid,
          'tenant_b_bands',
          'Tenant B Bands',
          'ACTIVE',
          now(),
          now()
        )
      `;
      return id;
    });

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        listProfileBands(tx, profileId),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
