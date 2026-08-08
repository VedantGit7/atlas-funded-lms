import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { LearnerProductListQuery } from "./learner-products.dto";

export type MockTestRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  assessment_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type TestSeriesItemRow = {
  id: string;
  test_series_id: string;
  position: number;
  title: string | null;
  mock_test_id: string | null;
  assessment_id: string | null;
};

export type TestSeriesRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type BundleItemRow = {
  id: string;
  bundle_id: string;
  item_kind: string;
  ref_id: string;
  position: number;
};

export type BundleRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type LearnerSubscriptionPlanItemRow = {
  id: string;
  plan_id: string;
  item_kind: string;
  ref_id: string;
  position: number;
};

export type LearnerSubscriptionPlanRow = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  billing_interval: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export type ProductEnrollmentRow = {
  id: string;
  membership_id: string;
  status: string;
  enrolled_type: string;
  enrolled_at: Date;
  expires_at: Date | null;
};

type ListFilter = Pick<LearnerProductListQuery, "q" | "status" | "page" | "limit">;

function mapMockTestRow(row: Record<string, unknown>): MockTestRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    slug: String(row["slug"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    assessment_id: String(row["assessment_id"]),
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapTestSeriesRow(row: Record<string, unknown>): TestSeriesRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    slug: String(row["slug"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapBundleRow(row: Record<string, unknown>): BundleRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    slug: String(row["slug"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapPlanRow(row: Record<string, unknown>): LearnerSubscriptionPlanRow {
  return {
    id: String(row["id"]),
    tenant_id: String(row["tenant_id"]),
    slug: String(row["slug"]),
    title: String(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    billing_interval: String(row["billing_interval"]),
    status: String(row["status"]),
    created_at: row["created_at"] as Date,
    updated_at: row["updated_at"] as Date,
  };
}

function mapEnrollmentRow(row: Record<string, unknown>): ProductEnrollmentRow {
  return {
    id: String(row["id"]),
    membership_id: String(row["membership_id"]),
    status: String(row["status"]),
    enrolled_type: String(row["enrolled_type"]),
    enrolled_at: row["enrolled_at"] as Date,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
  };
}

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
  };
}

export const learnerProductsRepository = {
  async slugExists(
    tx: TenantTx,
    table:
      | "mock_tests"
      | "test_series"
      | "bundles"
      | "learner_subscription_plans",
    slug: string,
  ): Promise<boolean> {
    if (table === "mock_tests") {
      const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
        select exists(
          select 1 from mock_tests
          where slug = ${slug}
            and deleted_at is null
        ) as exists
      `;
      return rows[0]?.exists ?? false;
    }
    if (table === "test_series") {
      const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
        select exists(
          select 1 from test_series
          where slug = ${slug}
            and deleted_at is null
        ) as exists
      `;
      return rows[0]?.exists ?? false;
    }
    if (table === "bundles") {
      const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
        select exists(
          select 1 from bundles
          where slug = ${slug}
            and deleted_at is null
        ) as exists
      `;
      return rows[0]?.exists ?? false;
    }
    const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
      select exists(
        select 1 from learner_subscription_plans
        where slug = ${slug}
          and deleted_at is null
      ) as exists
    `;
    return rows[0]?.exists ?? false;
  },

  async insertMockTest(
    tx: TenantTx,
    args: {
      slug: string;
      title: string;
      description?: string;
      assessmentId: string;
      status: string;
      createdByMembershipId?: string;
    },
  ): Promise<MockTestRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into mock_tests (
        id,
        tenant_id,
        slug,
        title,
        description,
        assessment_id,
        status,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.slug},
        ${args.title},
        ${args.description ?? null},
        ${args.assessmentId}::uuid,
        ${args.status}::"PublishStatus",
        ${args.createdByMembershipId ?? null}::uuid,
        now(),
        now()
      )
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("MOCK_TEST_INSERT_FAILED");
    return mapMockTestRow(row);
  },

  async findMockTestById(tx: TenantTx, mockTestId: string): Promise<MockTestRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from mock_tests
      where id = ${mockTestId}::uuid
        and deleted_at is null
      limit 1
    `;
    return rows[0] ? mapMockTestRow(rows[0]) : null;
  },

  async countMockTests(tx: TenantTx, filter: ListFilter): Promise<number> {
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const rows = await tx.$queryRaw<Array<{ count: bigint | number }>>`
      select count(*)::bigint as count
      from mock_tests
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listMockTests(
    tx: TenantTx,
    filter: ListFilter,
  ): Promise<{ items: MockTestRow[]; totalCount: number }> {
    const offset = (filter.page - 1) * filter.limit;
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const totalCount = await this.countMockTests(tx, filter);
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from mock_tests
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
      order by updated_at desc
      limit ${filter.limit}
      offset ${offset}
    `;
    return { items: rows.map(mapMockTestRow), totalCount };
  },

  async insertTestSeries(
    tx: TenantTx,
    args: {
      slug: string;
      title: string;
      description?: string;
      status: string;
      createdByMembershipId?: string;
      items: Array<{
        position: number;
        title?: string;
        mockTestId?: string;
        assessmentId?: string;
      }>;
    },
  ): Promise<{ series: TestSeriesRow; items: TestSeriesItemRow[] }> {
    const seriesId = randomUUID();
    const seriesRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into test_series (
        id,
        tenant_id,
        slug,
        title,
        description,
        status,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${seriesId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.slug},
        ${args.title},
        ${args.description ?? null},
        ${args.status}::"PublishStatus",
        ${args.createdByMembershipId ?? null}::uuid,
        now(),
        now()
      )
      returning *
    `;
    const seriesRow = seriesRows[0];
    if (!seriesRow) throw new Error("TEST_SERIES_INSERT_FAILED");

    const items: TestSeriesItemRow[] = [];
    for (const item of args.items) {
      const itemId = randomUUID();
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        insert into test_series_items (
          id,
          tenant_id,
          test_series_id,
          position,
          title,
          mock_test_id,
          assessment_id,
          created_at,
          updated_at
        )
        values (
          ${itemId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${seriesId}::uuid,
          ${item.position},
          ${item.title ?? null},
          ${item.mockTestId ?? null}::uuid,
          ${item.assessmentId ?? null}::uuid,
          now(),
          now()
        )
        returning *
      `;
      const itemRow = itemRows[0];
      if (!itemRow) throw new Error("TEST_SERIES_ITEM_INSERT_FAILED");
      items.push({
        id: String(itemRow["id"]),
        test_series_id: String(itemRow["test_series_id"]),
        position: Number(itemRow["position"]),
        title: typeof itemRow["title"] === "string" ? itemRow["title"] : null,
        mock_test_id:
          typeof itemRow["mock_test_id"] === "string" ? itemRow["mock_test_id"] : null,
        assessment_id:
          typeof itemRow["assessment_id"] === "string" ? itemRow["assessment_id"] : null,
      });
    }

    return { series: mapTestSeriesRow(seriesRow), items };
  },

  async findTestSeriesById(
    tx: TenantTx,
    testSeriesId: string,
  ): Promise<{ series: TestSeriesRow; items: TestSeriesItemRow[] } | null> {
    const seriesRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from test_series
      where id = ${testSeriesId}::uuid
        and deleted_at is null
      limit 1
    `;
    const seriesRow = seriesRows[0];
    if (!seriesRow) return null;

    const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from test_series_items
      where test_series_id = ${testSeriesId}::uuid
      order by position asc
    `;

    return {
      series: mapTestSeriesRow(seriesRow),
      items: itemRows.map((row) => ({
        id: String(row["id"]),
        test_series_id: String(row["test_series_id"]),
        position: Number(row["position"]),
        title: typeof row["title"] === "string" ? row["title"] : null,
        mock_test_id: typeof row["mock_test_id"] === "string" ? row["mock_test_id"] : null,
        assessment_id: typeof row["assessment_id"] === "string" ? row["assessment_id"] : null,
      })),
    };
  },

  async countTestSeries(tx: TenantTx, filter: ListFilter): Promise<number> {
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const rows = await tx.$queryRaw<Array<{ count: bigint | number }>>`
      select count(*)::bigint as count
      from test_series
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listTestSeries(
    tx: TenantTx,
    filter: ListFilter,
  ): Promise<{ items: Array<{ series: TestSeriesRow; items: TestSeriesItemRow[] }>; totalCount: number }> {
    const offset = (filter.page - 1) * filter.limit;
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const totalCount = await this.countTestSeries(tx, filter);
    const seriesRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from test_series
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
      order by updated_at desc
      limit ${filter.limit}
      offset ${offset}
    `;

    const items: Array<{ series: TestSeriesRow; items: TestSeriesItemRow[] }> = [];
    for (const seriesRow of seriesRows) {
      const series = mapTestSeriesRow(seriesRow);
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from test_series_items
        where test_series_id = ${series.id}::uuid
        order by position asc
      `;
      items.push({
        series,
        items: itemRows.map((row) => ({
          id: String(row["id"]),
          test_series_id: String(row["test_series_id"]),
          position: Number(row["position"]),
          title: typeof row["title"] === "string" ? row["title"] : null,
          mock_test_id: typeof row["mock_test_id"] === "string" ? row["mock_test_id"] : null,
          assessment_id: typeof row["assessment_id"] === "string" ? row["assessment_id"] : null,
        })),
      });
    }

    return { items, totalCount };
  },

  async insertBundle(
    tx: TenantTx,
    args: {
      slug: string;
      title: string;
      description?: string;
      status: string;
      createdByMembershipId?: string;
      items: Array<{ itemKind: string; refId: string; position: number }>;
    },
  ): Promise<{ bundle: BundleRow; items: BundleItemRow[] }> {
    const bundleId = randomUUID();
    const bundleRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into bundles (
        id,
        tenant_id,
        slug,
        title,
        description,
        status,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${bundleId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.slug},
        ${args.title},
        ${args.description ?? null},
        ${args.status}::"PublishStatus",
        ${args.createdByMembershipId ?? null}::uuid,
        now(),
        now()
      )
      returning *
    `;
    const bundleRow = bundleRows[0];
    if (!bundleRow) throw new Error("BUNDLE_INSERT_FAILED");

    const items: BundleItemRow[] = [];
    for (const item of args.items) {
      const itemId = randomUUID();
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        insert into bundle_items (
          id,
          tenant_id,
          bundle_id,
          item_kind,
          ref_id,
          position,
          created_at
        )
        values (
          ${itemId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${bundleId}::uuid,
          ${item.itemKind},
          ${item.refId}::uuid,
          ${item.position},
          now()
        )
        returning *
      `;
      const itemRow = itemRows[0];
      if (!itemRow) throw new Error("BUNDLE_ITEM_INSERT_FAILED");
      items.push({
        id: String(itemRow["id"]),
        bundle_id: String(itemRow["bundle_id"]),
        item_kind: String(itemRow["item_kind"]),
        ref_id: String(itemRow["ref_id"]),
        position: Number(itemRow["position"]),
      });
    }

    return { bundle: mapBundleRow(bundleRow), items };
  },

  async findBundleById(
    tx: TenantTx,
    bundleId: string,
  ): Promise<{ bundle: BundleRow; items: BundleItemRow[] } | null> {
    const bundleRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from bundles
      where id = ${bundleId}::uuid
        and deleted_at is null
      limit 1
    `;
    const bundleRow = bundleRows[0];
    if (!bundleRow) return null;

    const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from bundle_items
      where bundle_id = ${bundleId}::uuid
      order by position asc
    `;

    return {
      bundle: mapBundleRow(bundleRow),
      items: itemRows.map((row) => ({
        id: String(row["id"]),
        bundle_id: String(row["bundle_id"]),
        item_kind: String(row["item_kind"]),
        ref_id: String(row["ref_id"]),
        position: Number(row["position"]),
      })),
    };
  },

  async countBundles(tx: TenantTx, filter: ListFilter): Promise<number> {
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const rows = await tx.$queryRaw<Array<{ count: bigint | number }>>`
      select count(*)::bigint as count
      from bundles
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listBundles(
    tx: TenantTx,
    filter: ListFilter,
  ): Promise<{ items: Array<{ bundle: BundleRow; items: BundleItemRow[] }>; totalCount: number }> {
    const offset = (filter.page - 1) * filter.limit;
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const totalCount = await this.countBundles(tx, filter);
    const bundleRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from bundles
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
      order by updated_at desc
      limit ${filter.limit}
      offset ${offset}
    `;

    const items: Array<{ bundle: BundleRow; items: BundleItemRow[] }> = [];
    for (const bundleRow of bundleRows) {
      const bundle = mapBundleRow(bundleRow);
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from bundle_items
        where bundle_id = ${bundle.id}::uuid
        order by position asc
      `;
      items.push({
        bundle,
        items: itemRows.map((row) => ({
          id: String(row["id"]),
          bundle_id: String(row["bundle_id"]),
          item_kind: String(row["item_kind"]),
          ref_id: String(row["ref_id"]),
          position: Number(row["position"]),
        })),
      });
    }

    return { items, totalCount };
  },

  async insertLearnerSubscriptionPlan(
    tx: TenantTx,
    args: {
      slug: string;
      title: string;
      description?: string;
      billingInterval: string;
      status: string;
      createdByMembershipId?: string;
      items: Array<{ itemKind: string; refId: string; position: number }>;
    },
  ): Promise<{ plan: LearnerSubscriptionPlanRow; items: LearnerSubscriptionPlanItemRow[] }> {
    const planId = randomUUID();
    const planRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into learner_subscription_plans (
        id,
        tenant_id,
        slug,
        title,
        description,
        billing_interval,
        status,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${planId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.slug},
        ${args.title},
        ${args.description ?? null},
        ${args.billingInterval},
        ${args.status}::"PublishStatus",
        ${args.createdByMembershipId ?? null}::uuid,
        now(),
        now()
      )
      returning *
    `;
    const planRow = planRows[0];
    if (!planRow) throw new Error("LEARNER_SUBSCRIPTION_PLAN_INSERT_FAILED");

    const items: LearnerSubscriptionPlanItemRow[] = [];
    for (const item of args.items) {
      const itemId = randomUUID();
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        insert into learner_subscription_plan_items (
          id,
          tenant_id,
          plan_id,
          item_kind,
          ref_id,
          position,
          created_at
        )
        values (
          ${itemId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${planId}::uuid,
          ${item.itemKind},
          ${item.refId}::uuid,
          ${item.position},
          now()
        )
        returning *
      `;
      const itemRow = itemRows[0];
      if (!itemRow) throw new Error("LEARNER_SUBSCRIPTION_PLAN_ITEM_INSERT_FAILED");
      items.push({
        id: String(itemRow["id"]),
        plan_id: String(itemRow["plan_id"]),
        item_kind: String(itemRow["item_kind"]),
        ref_id: String(itemRow["ref_id"]),
        position: Number(itemRow["position"]),
      });
    }

    return { plan: mapPlanRow(planRow), items };
  },

  async findLearnerSubscriptionPlanById(
    tx: TenantTx,
    planId: string,
  ): Promise<{ plan: LearnerSubscriptionPlanRow; items: LearnerSubscriptionPlanItemRow[] } | null> {
    const planRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from learner_subscription_plans
      where id = ${planId}::uuid
        and deleted_at is null
      limit 1
    `;
    const planRow = planRows[0];
    if (!planRow) return null;

    const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from learner_subscription_plan_items
      where plan_id = ${planId}::uuid
      order by position asc
    `;

    return {
      plan: mapPlanRow(planRow),
      items: itemRows.map((row) => ({
        id: String(row["id"]),
        plan_id: String(row["plan_id"]),
        item_kind: String(row["item_kind"]),
        ref_id: String(row["ref_id"]),
        position: Number(row["position"]),
      })),
    };
  },

  async countLearnerSubscriptionPlans(tx: TenantTx, filter: ListFilter): Promise<number> {
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const rows = await tx.$queryRaw<Array<{ count: bigint | number }>>`
      select count(*)::bigint as count
      from learner_subscription_plans
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLearnerSubscriptionPlans(
    tx: TenantTx,
    filter: ListFilter,
  ): Promise<{
    items: Array<{ plan: LearnerSubscriptionPlanRow; items: LearnerSubscriptionPlanItemRow[] }>;
    totalCount: number;
  }> {
    const offset = (filter.page - 1) * filter.limit;
    const qPattern = filter.q ? `%${filter.q}%` : null;
    const totalCount = await this.countLearnerSubscriptionPlans(tx, filter);
    const planRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select *
      from learner_subscription_plans
      where deleted_at is null
        and (${filter.status ?? null}::text is null or status = ${filter.status ?? null}::"PublishStatus")
        and (${qPattern}::text is null or title ilike ${qPattern} or slug ilike ${qPattern})
      order by updated_at desc
      limit ${filter.limit}
      offset ${offset}
    `;

    const items: Array<{ plan: LearnerSubscriptionPlanRow; items: LearnerSubscriptionPlanItemRow[] }> =
      [];
    for (const planRow of planRows) {
      const plan = mapPlanRow(planRow);
      const itemRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select *
        from learner_subscription_plan_items
        where plan_id = ${plan.id}::uuid
        order by position asc
      `;
      items.push({
        plan,
        items: itemRows.map((row) => ({
          id: String(row["id"]),
          plan_id: String(row["plan_id"]),
          item_kind: String(row["item_kind"]),
          ref_id: String(row["ref_id"]),
          position: Number(row["position"]),
        })),
      });
    }

    return { items, totalCount };
  },

  async upsertCourseEnrollment(
    tx: TenantTx,
    args: { courseId: string; membershipId: string; enrolledType: string; expiresAt: Date | null },
  ): Promise<void> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into enrollments (
        id,
        tenant_id,
        course_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at,
        expires_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.courseId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        ${args.enrolledType},
        now(),
        ${args.expiresAt}::timestamptz
      )
      on conflict (tenant_id, course_id, membership_id) do nothing
    `;
  },

  async enrollMockTest(
    tx: TenantTx,
    args: {
      mockTestId: string;
      membershipId: string;
      enrolledType: string;
      expiresAt: Date | null;
    },
  ): Promise<ProductEnrollmentRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into mock_test_enrollments (
        id,
        tenant_id,
        mock_test_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at,
        expires_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.mockTestId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        ${args.enrolledType},
        now(),
        ${args.expiresAt}::timestamptz
      )
      on conflict (tenant_id, mock_test_id, membership_id)
      do update set
        status = excluded.status,
        enrolled_type = excluded.enrolled_type,
        expires_at = coalesce(excluded.expires_at, mock_test_enrollments.expires_at)
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("MOCK_TEST_ENROLL_FAILED");
    return mapEnrollmentRow(row);
  },

  async enrollTestSeries(
    tx: TenantTx,
    args: {
      testSeriesId: string;
      membershipId: string;
      enrolledType: string;
      expiresAt: Date | null;
    },
  ): Promise<ProductEnrollmentRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into test_series_enrollments (
        id,
        tenant_id,
        test_series_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at,
        expires_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.testSeriesId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        ${args.enrolledType},
        now(),
        ${args.expiresAt}::timestamptz
      )
      on conflict (tenant_id, test_series_id, membership_id)
      do update set
        status = excluded.status,
        enrolled_type = excluded.enrolled_type,
        expires_at = coalesce(excluded.expires_at, test_series_enrollments.expires_at)
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("TEST_SERIES_ENROLL_FAILED");
    return mapEnrollmentRow(row);
  },

  async enrollBundle(
    tx: TenantTx,
    args: {
      bundleId: string;
      membershipId: string;
      enrolledType: string;
      expiresAt: Date | null;
    },
  ): Promise<ProductEnrollmentRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into bundle_enrollments (
        id,
        tenant_id,
        bundle_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at,
        expires_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.bundleId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        ${args.enrolledType},
        now(),
        ${args.expiresAt}::timestamptz
      )
      on conflict (tenant_id, bundle_id, membership_id)
      do update set
        status = excluded.status,
        enrolled_type = excluded.enrolled_type,
        expires_at = coalesce(excluded.expires_at, bundle_enrollments.expires_at)
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("BUNDLE_ENROLL_FAILED");
    return mapEnrollmentRow(row);
  },

  async enrollLearnerSubscriptionPlan(
    tx: TenantTx,
    args: {
      planId: string;
      membershipId: string;
      enrolledType: string;
      expiresAt: Date | null;
    },
  ): Promise<ProductEnrollmentRow> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into learner_subscription_enrollments (
        id,
        tenant_id,
        plan_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at,
        current_period_start,
        current_period_end,
        expires_at
      )
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.planId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        ${args.enrolledType},
        now(),
        now(),
        ${args.expiresAt}::timestamptz,
        ${args.expiresAt}::timestamptz
      )
      on conflict (tenant_id, plan_id, membership_id)
      do update set
        status = excluded.status,
        enrolled_type = excluded.enrolled_type,
        expires_at = coalesce(excluded.expires_at, learner_subscription_enrollments.expires_at),
        current_period_end = coalesce(excluded.current_period_end, learner_subscription_enrollments.current_period_end)
      returning *
    `;
    const row = rows[0];
    if (!row) throw new Error("LEARNER_SUBSCRIPTION_ENROLL_FAILED");
    return mapEnrollmentRow(row);
  },
};

export { pageInfo as learnerProductPageInfo };
