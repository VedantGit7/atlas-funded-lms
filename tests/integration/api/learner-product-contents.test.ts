import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  duplicateBundle,
  enrollBundle,
  getBundle,
  getMockTest,
  listBundleEnrollments,
  replaceBundleContents,
  replaceMockTestContents,
} from "../../../backend/packages/domain/src/learner-products/learner-products.service";
import {
  createTenantIsolationFixture,
  tenantCtx,
  type IsolationTenantFixture,
} from "../../tenant-isolation/tenant-isolation-fixture";

/**
 * Contents editing and duplication against a real Postgres.
 *
 * Both features turn on behaviour the database owns: item order comes from the
 * array index rather than a client-supplied position, references are checked to
 * exist before they are stored (which `create` never did), and a duplicate must
 * find a slug that is actually free.
 */

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

async function insertBundle(
  tenant: IsolationTenantFixture,
  status: "DRAFT" | "PUBLISHED" = "PUBLISHED",
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `trader-bundle-${id.slice(0, 8)}`;
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into bundles (id, tenant_id, slug, title, description, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${slug}, 'Complete trader bundle',
              'A comprehensive path.', ${status}::"PublishStatus", now(), now())
    `;
  });
  return { id, slug };
}

async function insertCourse(tenant: IsolationTenantFixture, title: string): Promise<string> {
  const id = randomUUID();
  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, created_at, updated_at)
      values (${id}::uuid, ${tenant.tenantId}::uuid, ${`course-${id.slice(0, 8)}`}, ${title},
              'DRAFT'::"PublishStatus", now(), now())
    `;
  });
  return id;
}

describeWithDb("learner product contents editing (database)", () => {
  it("writes the array order as position, ignoring any prior ordering", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const first = await insertCourse(tenantA, "Market Fundamentals");
    const second = await insertCourse(tenantA, "Technical Analysis");
    const third = await insertCourse(tenantA, "Trading Psychology");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        items: [
          { itemKind: "course", refId: first },
          { itemKind: "course", refId: second },
        ],
      }),
    );

    // Reorder and extend in one save.
    const result = await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        items: [
          { itemKind: "course", refId: third },
          { itemKind: "course", refId: first },
          { itemKind: "course", refId: second },
        ],
      }),
    );

    expect(result.data.items.map((item) => [item.position, item.title])).toEqual([
      [0, "Trading Psychology"],
      [1, "Market Fundamentals"],
      [2, "Technical Analysis"],
    ]);
  });

  it("refuses a reference that does not exist, leaving the contents untouched", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const live = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        items: [{ itemKind: "course", refId: live }],
      }),
    );

    const ghost = randomUUID();
    await expect(
      withTenantTx(ctx, async (tx) =>
        replaceBundleContents(tx, ctx, bundle.id, {
          items: [
            { itemKind: "course", refId: live },
            { itemKind: "course", refId: ghost },
          ],
        }),
      ),
    ).rejects.toThrow(/do not exist in this school/);

    // The rejected save must not have deleted the row it was replacing.
    const after = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundle.id));
    expect(after.data.items).toHaveLength(1);
    expect(after.data.items[0]?.refId).toBe(live);
  });

  it("refuses a reference belonging to another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const foreign = await insertCourse(tenantB, "Another school's course");
    const ctx = tenantCtx(tenantA);

    // RLS hides it from the existence check, so it reads as "does not exist" —
    // which is the correct answer and leaks nothing about the other tenant.
    await expect(
      withTenantTx(ctx, async (tx) =>
        replaceBundleContents(tx, ctx, bundle.id, {
          items: [{ itemKind: "course", refId: foreign }],
        }),
      ),
    ).rejects.toThrow(/do not exist in this school/);
  });

  it("writes one audit entry naming the before and after contents", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    const audits = await withTenantTx(
      ctx,
      async (tx) =>
        tx.$queryRaw<Array<{ before_json: unknown; after_json: unknown }>>`
        select before_json, after_json from audit_entries
        where tenant_id = ${tenantA.tenantId}::uuid
          and action = 'learner_product.bundle.contents_updated'
          and target_id = ${bundle.id}
      `,
    );

    expect(audits).toHaveLength(1);
    expect(audits[0]?.before_json).toEqual({ items: [] });
    expect(audits[0]?.after_json).toEqual({ items: [`course:${course}`] });
  });
});

describeWithDb("learner product duplication (database)", () => {
  it("copies the product and its items into a fresh DRAFT", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const source = await insertBundle(tenantA, "PUBLISHED");
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, source.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    const copy = await withTenantTx(ctx, async (tx) => duplicateBundle(tx, ctx, source.id, {}));

    expect(copy.data.id).not.toBe(source.id);
    expect(copy.data.title).toBe("Complete trader bundle (copy)");
    expect(copy.data.slug).toBe(`${source.slug}-copy`);
    // A duplicate of a published product must not itself be published.
    expect(copy.data.status).toBe("DRAFT");
    expect(copy.data.items).toHaveLength(1);
    expect(copy.data.items[0]).toMatchObject({ refId: course, title: "Market Fundamentals" });

    // The source is untouched.
    const original = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, source.id));
    expect(original.data.status).toBe("PUBLISHED");
  });

  it("walks the slug suffix so the same product can be duplicated twice", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const source = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, source.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    const first = await withTenantTx(ctx, async (tx) => duplicateBundle(tx, ctx, source.id, {}));
    const second = await withTenantTx(ctx, async (tx) => duplicateBundle(tx, ctx, source.id, {}));

    expect(first.data.slug).toBe(`${source.slug}-copy`);
    expect(second.data.slug).toBe(`${source.slug}-copy-2`);
  });

  it("does not copy enrolments", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const source = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, source.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );
    await withTenantTx(ctx, async (tx) =>
      enrollBundle(tx, ctx, source.id, {
        membershipId: tenantA.membershipId,
        enrolledType: "comp",
      }),
    );

    const copy = await withTenantTx(ctx, async (tx) => duplicateBundle(tx, ctx, source.id, {}));

    const sourceRoster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, source.id, {}),
    );
    const copyRoster = await withTenantTx(ctx, async (tx) =>
      listBundleEnrollments(tx, ctx, copy.data.id, {}),
    );

    // An enrolment belongs to the product the learner was placed into; cloning
    // it would grant access to something nobody agreed to.
    expect(sourceRoster.data.pageInfo.totalCount).toBe(1);
    expect(copyRoster.data.pageInfo.totalCount).toBe(0);
  });

  it("accepts an explicit slug and title for the copy", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const source = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, source.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    const copy = await withTenantTx(ctx, async (tx) =>
      duplicateBundle(tx, ctx, source.id, { slug: "spring-intake-bundle", title: "Spring intake" }),
    );

    expect(copy.data.slug).toBe("spring-intake-bundle");
    expect(copy.data.title).toBe("Spring intake");
  });

  it("404s duplicating a product from another tenant", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const foreign = await insertBundle(tenantB);
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) => duplicateBundle(tx, ctx, foreign.id, {})),
    ).rejects.toThrow(/Bundle not found/);
  });
});

describeWithDb("contents save concurrency (database)", () => {
  it("saves when the expected version matches", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    const loaded = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundle.id));

    const result = await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        expectedUpdatedAt: loaded.data.updatedAt,
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    expect(result.data.items).toHaveLength(1);
  });

  it("refuses a save built against a stale version, keeping the winner's work", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const mine = await insertCourse(tenantA, "My course");
    const theirs = await insertCourse(tenantA, "Their course");
    const ctx = tenantCtx(tenantA);

    // Both operators open the page and see the same version.
    const opened = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundle.id));

    // A colleague saves first.
    await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        expectedUpdatedAt: opened.data.updatedAt,
        items: [{ itemKind: "course", refId: theirs }],
      }),
    );

    // The second save still holds the version from before their write.
    await expect(
      withTenantTx(ctx, async (tx) =>
        replaceBundleContents(tx, ctx, bundle.id, {
          expectedUpdatedAt: opened.data.updatedAt,
          items: [{ itemKind: "course", refId: mine }],
        }),
      ),
    ).rejects.toThrow(/changed since you opened them/);

    // The colleague's contents survived rather than being silently replaced.
    const after = await withTenantTx(ctx, async (tx) => getBundle(tx, ctx, bundle.id));
    expect(after.data.items).toHaveLength(1);
    expect(after.data.items[0]?.refId).toBe(theirs);
  });

  it("still saves when no expected version is supplied", async () => {
    // Omitting the field is an explicit opt-out for scripted callers, not an
    // accident the server should punish.
    const { tenantA } = await createTenantIsolationFixture();
    const bundle = await insertBundle(tenantA);
    const course = await insertCourse(tenantA, "Market Fundamentals");
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      replaceBundleContents(tx, ctx, bundle.id, {
        items: [{ itemKind: "course", refId: course }],
      }),
    );

    expect(result.data.items).toHaveLength(1);
  });
});

describeWithDb("mock test assessment (database)", () => {
  async function insertMockTest(
    tenant: IsolationTenantFixture,
    assessmentId: string,
  ): Promise<string> {
    const id = randomUUID();
    await withTenantTx(tenantCtx(tenant), async (tx) => {
      await tx.$executeRaw`
        insert into mock_tests (id, tenant_id, slug, title, assessment_id, status, created_at, updated_at)
        values (${id}::uuid, ${tenant.tenantId}::uuid, ${`mock-${id.slice(0, 8)}`},
                'Foundations final mock', ${assessmentId}::uuid, 'PUBLISHED'::"PublishStatus",
                now(), now())
      `;
    });
    return id;
  }

  async function insertAssessment(tenant: IsolationTenantFixture, title: string): Promise<string> {
    const id = randomUUID();
    await withTenantTx(tenantCtx(tenant), async (tx) => {
      await tx.$executeRaw`
        insert into assessments (
          id, tenant_id, slug, title, assessment_type, status, config_json, created_at, updated_at
        )
        values (${id}::uuid, ${tenant.tenantId}::uuid, ${`assessment-${id.slice(0, 8)}`}, ${title},
                'quiz', 'PUBLISHED'::"PublishStatus", '{}'::jsonb, now(), now())
      `;
    });
    return id;
  }

  it("repoints the mock test at a different assessment", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const original = await insertAssessment(tenantA, "Q3 assessment");
    const replacement = await insertAssessment(tenantA, "Q4 assessment");
    const mockTestId = await insertMockTest(tenantA, original);
    const ctx = tenantCtx(tenantA);

    const result = await withTenantTx(ctx, async (tx) =>
      replaceMockTestContents(tx, ctx, mockTestId, { assessmentId: replacement }),
    );

    expect(result.data.assessmentId).toBe(replacement);
  });

  it("refuses an assessment that does not exist in this school", async () => {
    const { tenantA, tenantB } = await createTenantIsolationFixture();
    const mine = await insertAssessment(tenantA, "Q3 assessment");
    const foreign = await insertAssessment(tenantB, "Their assessment");
    const mockTestId = await insertMockTest(tenantA, mine);
    const ctx = tenantCtx(tenantA);

    await expect(
      withTenantTx(ctx, async (tx) =>
        replaceMockTestContents(tx, ctx, mockTestId, { assessmentId: foreign }),
      ),
    ).rejects.toThrow(/do not exist in this school/);

    const after = await withTenantTx(ctx, async (tx) => getMockTest(tx, ctx, mockTestId));
    expect(after.data.assessmentId).toBe(mine);
  });

  it("honours the stale-version guard", async () => {
    const { tenantA } = await createTenantIsolationFixture();
    const first = await insertAssessment(tenantA, "Q3 assessment");
    const second = await insertAssessment(tenantA, "Q4 assessment");
    const third = await insertAssessment(tenantA, "Q1 assessment");
    const mockTestId = await insertMockTest(tenantA, first);
    const ctx = tenantCtx(tenantA);

    const opened = await withTenantTx(ctx, async (tx) => getMockTest(tx, ctx, mockTestId));

    await withTenantTx(ctx, async (tx) =>
      replaceMockTestContents(tx, ctx, mockTestId, {
        expectedUpdatedAt: opened.data.updatedAt,
        assessmentId: second,
      }),
    );

    await expect(
      withTenantTx(ctx, async (tx) =>
        replaceMockTestContents(tx, ctx, mockTestId, {
          expectedUpdatedAt: opened.data.updatedAt,
          assessmentId: third,
        }),
      ),
    ).rejects.toThrow(/changed since you opened them/);
  });
});
