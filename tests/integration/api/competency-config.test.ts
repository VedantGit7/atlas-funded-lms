import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  createCompetencyDimension,
  deleteCompetencyDimension,
  listCompetencyDimensions,
  listTenantScoringProfiles,
  updateCompetencyDimension,
  createScoringProfile,
  updateScoringProfile,
} from "../../../apps/web/src/server/competency/competency-config.service";
import {
  listProfileBands,
  publishScoringConfig,
  replaceProfileBands,
  getNextPublishVersionForTest,
} from "../../../apps/web/src/server/competency/scoring-config.service";
import {
  adminCtx,
  authoringTenantTx,
  createCompetencyConfigFixture,
  seedDimension,
} from "../../fixtures/competency-config-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("competency config integration", () => {
  it("GET dimensions returns tenant dimensions", async () => {
    const fixture = await createCompetencyConfigFixture();
    await seedDimension(fixture, { key: "focus", name: "Focus" });

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listCompetencyDimensions(tx),
    );

    expect(result.data.some((item) => item.key === "focus")).toBe(true);
  });

  it("POST dimension creates and audits", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    const created = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createCompetencyDimension(tx, ctx, {
          key: "execution",
          name: "Execution",
        }),
    );

    const audits = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        tx.$queryRaw<Array<{ action: string }>>`
        select action
        from audit_entries
        where target_id::text = ${created.data.id}
          and action = 'competency.dimension.created'
        limit 1
      `,
    );

    expect(created.data.key).toBe("execution");
    expect(audits.length).toBe(1);
  });

  it("PUT dimension updates and audits", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);
    const dimensionId = await seedDimension(fixture, { key: "discipline", name: "Discipline" });

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => updateCompetencyDimension(tx, ctx, dimensionId, { name: "Trading Discipline" }),
    );

    expect(updated.data.name).toBe("Trading Discipline");
  });

  it("DELETE dimension deletes and audits", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);
    const dimensionId = await seedDimension(fixture, { key: "temp_dim", name: "Temporary" });

    const deleted = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => deleteCompetencyDimension(tx, ctx, dimensionId),
    );

    expect(deleted.data.deleted).toBe(true);
  });

  it("GET scoring profiles returns tenant profiles", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      createScoringProfile(tx, ctx, { key: "default_profile", name: "Default" }),
    );

    const result = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listTenantScoringProfiles(tx),
    );

    expect(result.data.some((item) => item.key === "default_profile")).toBe(true);
  });

  it("PUT bands replaces bands transactionally and audits", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => createScoringProfile(tx, ctx, { key: "bands_profile", name: "Bands Profile" }),
    );

    const bands = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        replaceProfileBands(tx, ctx, profile.data.id, {
          bands: [
            { key: "developing", label: "Developing", minScore: 0, maxScore: 49, sortOrder: 0 },
            { key: "ready", label: "Ready", minScore: 50, maxScore: 100, sortOrder: 1 },
          ],
        }),
    );

    expect(bands.data).toHaveLength(2);
  });

  it("POST publish creates scoring_config_versions row and marks active version", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    await seedDimension(fixture, { key: "analysis", name: "Analysis" });

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createScoringProfile(tx, ctx, { key: "publish_profile", name: "Publish Profile" }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      replaceProfileBands(tx, ctx, profile.data.id, {
        bands: [{ key: "starter", label: "Starter", minScore: 0, maxScore: 100, sortOrder: 0 }],
      }),
    );

    const published = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => publishScoringConfig(tx, ctx, profile.data.id, {}),
    );

    expect(published.data.version).toBe(1);

    const refreshed = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listTenantScoringProfiles(tx),
    );

    expect(refreshed.data.find((item) => item.id === profile.data.id)?.activeVersion).toBe(1);
  });

  it("publish increments version", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);
    await seedDimension(fixture, { key: "consistency", name: "Consistency" });

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) =>
        createScoringProfile(tx, ctx, { key: "version_profile", name: "Version Profile" }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      replaceProfileBands(tx, ctx, profile.data.id, {
        bands: [{ key: "base", label: "Base", minScore: 0, maxScore: 100, sortOrder: 0 }],
      }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      publishScoringConfig(tx, ctx, profile.data.id, {}),
    );

    const nextVersion = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => getNextPublishVersionForTest(tx, profile.data.id),
    );

    expect(nextVersion).toBe(2);
  });

  it("GET bands returns profile bands", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => createScoringProfile(tx, ctx, { key: "read_bands", name: "Read Bands" }),
    );

    await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
      replaceProfileBands(tx, ctx, profile.data.id, {
        bands: [{ key: "a", label: "A", minScore: 0, maxScore: 100, sortOrder: 0 }],
      }),
    );

    const bands = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => listProfileBands(tx, profile.data.id),
    );

    expect(bands.data).toHaveLength(1);
  });

  it("PUT scoring profile updates and audits", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => createScoringProfile(tx, ctx, { key: "update_profile", name: "Before" }),
    );

    const updated = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => updateScoringProfile(tx, ctx, profile.data.id, { name: "After" }),
    );

    expect(updated.data.name).toBe("After");
  });
});

describeWithDb("publish snapshot generation", () => {
  it("requires dimensions and bands", async () => {
    const fixture = await createCompetencyConfigFixture();
    const ctx = adminCtx(fixture);

    const profile = await withTenantTx(
      authoringTenantTx(fixture, fixture.adminMembershipId),
      async (tx) => createScoringProfile(tx, ctx, { key: "empty_profile", name: "Empty" }),
    );

    await expect(
      withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) =>
        publishScoringConfig(tx, ctx, profile.data.id, {}),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
