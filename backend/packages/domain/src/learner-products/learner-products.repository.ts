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

export type ProductTable = "mock_tests" | "test_series" | "bundles" | "learner_subscription_plans";

export type EnrollmentTable =
  | "mock_test_enrollments"
  | "test_series_enrollments"
  | "bundle_enrollments"
  | "learner_subscription_enrollments";

export type EnrollmentFilter = {
  page: number;
  limit: number;
  q?: string;
  status?: string;
  enrolledType?: string;
  enrolledFrom?: string;
  enrolledTo?: string;
};

export type ProductEnrollmentListRow = {
  id: string;
  membership_id: string;
  display_name: string | null;
  email: string | null;
  status: string;
  enrolled_type: string;
  enrolled_at: Date;
  expires_at: Date | null;
  completed_at: Date | null;
};

/** The three columns a publish-state transition reads and reports. */
export type ProductStatusRow = { id: string; slug: string; status: string };

function mapStatusRows(rows: unknown): ProductStatusRow[] {
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row["id"]),
    slug: String(row["slug"]),
    status: String(row["status"]),
  }));
}

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
  async slugExists(tx: TenantTx, table: ProductTable, slug: string): Promise<boolean> {
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

  /**
   * Publish-state read and write for a set of products, shared by all four
   * catalogue tables.
   *
   * The table name cannot be interpolated into a tagged template without
   * dropping the parameterisation that keeps this injection-safe, so the union
   * is branched the same way `slugExists` branches it.
   *
   * Neither query filters on `tenant_id`: the `FOR ALL` RLS policy on these
   * tables fences both the rows read and the post-image written, so an id from
   * another tenant simply matches nothing and is reported back as missing.
   */
  async listProductStatuses(
    tx: TenantTx,
    table: ProductTable,
    productIds: string[],
  ): Promise<ProductStatusRow[]> {
    if (productIds.length === 0) return [];
    if (table === "mock_tests") {
      return mapStatusRows(
        await tx.$queryRaw`
        select id, slug, status from mock_tests
        where id = any(${productIds}::uuid[]) and deleted_at is null
      `,
      );
    }
    if (table === "test_series") {
      return mapStatusRows(
        await tx.$queryRaw`
        select id, slug, status from test_series
        where id = any(${productIds}::uuid[]) and deleted_at is null
      `,
      );
    }
    if (table === "bundles") {
      return mapStatusRows(
        await tx.$queryRaw`
        select id, slug, status from bundles
        where id = any(${productIds}::uuid[]) and deleted_at is null
      `,
      );
    }
    return mapStatusRows(
      await tx.$queryRaw`
      select id, slug, status from learner_subscription_plans
      where id = any(${productIds}::uuid[]) and deleted_at is null
    `,
    );
  },

  /**
   * `updated_at` moves with the status because the catalogue list is ordered by
   * it. `returning` reports what actually changed rather than what was asked
   * for, which is what lets the caller name the ids it could not touch.
   */
  async updateProductStatuses(
    tx: TenantTx,
    table: ProductTable,
    productIds: string[],
    status: string,
  ): Promise<ProductStatusRow[]> {
    if (productIds.length === 0) return [];
    if (table === "mock_tests") {
      return mapStatusRows(
        await tx.$queryRaw`
        update mock_tests
        set status = ${status}::"PublishStatus", updated_at = now()
        where id = any(${productIds}::uuid[]) and deleted_at is null
        returning id, slug, status
      `,
      );
    }
    if (table === "test_series") {
      return mapStatusRows(
        await tx.$queryRaw`
        update test_series
        set status = ${status}::"PublishStatus", updated_at = now()
        where id = any(${productIds}::uuid[]) and deleted_at is null
        returning id, slug, status
      `,
      );
    }
    if (table === "bundles") {
      return mapStatusRows(
        await tx.$queryRaw`
        update bundles
        set status = ${status}::"PublishStatus", updated_at = now()
        where id = any(${productIds}::uuid[]) and deleted_at is null
        returning id, slug, status
      `,
      );
    }
    return mapStatusRows(
      await tx.$queryRaw`
      update learner_subscription_plans
      set status = ${status}::"PublishStatus", updated_at = now()
      where id = any(${productIds}::uuid[]) and deleted_at is null
      returning id, slug, status
    `,
    );
  },

  /**
   * Resolve display titles for a set of `(kind, refId)` item pointers.
   *
   * Batched by kind -- at most four statements however many items are passed --
   * because the obvious per-item lookup would turn a bundle page into an N+1.
   * Ids the tenant cannot see (RLS) or that have been deleted simply do not
   * come back, and the caller renders them as unresolved rather than guessing.
   */
  async resolveItemTitles(
    tx: TenantTx,
    refs: Array<{ kind: string; refId: string }>,
  ): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    if (refs.length === 0) return titles;

    const byKind = new Map<string, string[]>();
    for (const ref of refs) {
      const existing = byKind.get(ref.kind);
      if (existing) existing.push(ref.refId);
      else byKind.set(ref.kind, [ref.refId]);
    }

    for (const [kind, ids] of byKind) {
      const unique = [...new Set(ids)];
      let rows: Array<{ id: string; title: string }> = [];

      if (kind === "course") {
        rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
          select id::text as id, title from courses
          where id = any(${unique}::uuid[]) and deleted_at is null
        `;
      } else if (kind === "mock_test") {
        rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
          select id::text as id, title from mock_tests
          where id = any(${unique}::uuid[]) and deleted_at is null
        `;
      } else if (kind === "test_series") {
        rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
          select id::text as id, title from test_series
          where id = any(${unique}::uuid[]) and deleted_at is null
        `;
      } else if (kind === "bundle") {
        rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
          select id::text as id, title from bundles
          where id = any(${unique}::uuid[]) and deleted_at is null
        `;
      }

      for (const row of rows) {
        titles.set(`${kind}:${row.id}`, row.title);
      }
    }

    return titles;
  },

  /**
   * Roster filters, shared by the count and the page query.
   *
   * Written once as a SQL fragment because a count that filters differently
   * from the list is a pagination bug that only shows up on the last page.
   */
  async countProductEnrollments(
    tx: TenantTx,
    table: EnrollmentTable,
    productId: string,
    filter: Omit<EnrollmentFilter, "page" | "limit">,
  ): Promise<number> {
    const q = filter.q ? `%${filter.q}%` : null;
    const status = filter.status ?? null;
    const enrolledType = filter.enrolledType ?? null;
    const from = filter.enrolledFrom ?? null;
    const to = filter.enrolledTo ?? null;

    const rows =
      table === "mock_test_enrollments"
        ? await tx.$queryRaw<Array<{ count: bigint | number }>>`
            select count(*)::bigint as count
            from mock_test_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.mock_test_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})`
        : table === "test_series_enrollments"
          ? await tx.$queryRaw<Array<{ count: bigint | number }>>`
            select count(*)::bigint as count
            from test_series_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.test_series_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})`
          : table === "bundle_enrollments"
            ? await tx.$queryRaw<Array<{ count: bigint | number }>>`
            select count(*)::bigint as count
            from bundle_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.bundle_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})`
            : await tx.$queryRaw<Array<{ count: bigint | number }>>`
            select count(*)::bigint as count
            from learner_subscription_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.plan_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})`;
    return Number(rows[0]?.count ?? 0);
  },

  /**
   * Who is enrolled in one product.
   *
   * Joined to the profile and account email here rather than looked up per row
   * by the caller: the console needs a name to show, and a second round trip
   * per enrolment to get one is how a page of twenty-five becomes fifty
   * queries.
   */
  async listProductEnrollments(
    tx: TenantTx,
    table: EnrollmentTable,
    productId: string,
    filter: EnrollmentFilter,
  ): Promise<{ items: ProductEnrollmentListRow[]; totalCount: number }> {
    const offset = (filter.page - 1) * filter.limit;
    const totalCount = await this.countProductEnrollments(tx, table, productId, filter);
    const q = filter.q ? `%${filter.q}%` : null;
    const status = filter.status ?? null;
    const enrolledType = filter.enrolledType ?? null;
    const from = filter.enrolledFrom ?? null;
    const to = filter.enrolledTo ?? null;

    const rows =
      table === "mock_test_enrollments"
        ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            select e.*, p.display_name, a.email
            from mock_test_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.mock_test_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})
            order by e.enrolled_at desc
            limit ${filter.limit} offset ${offset}`
        : table === "test_series_enrollments"
          ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            select e.*, p.display_name, a.email
            from test_series_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.test_series_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})
            order by e.enrolled_at desc
            limit ${filter.limit} offset ${offset}`
          : table === "bundle_enrollments"
            ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            select e.*, p.display_name, a.email
            from bundle_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.bundle_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})
            order by e.enrolled_at desc
            limit ${filter.limit} offset ${offset}`
            : await tx.$queryRaw<Array<Record<string, unknown>>>`
            select e.*, p.display_name, a.email
            from learner_subscription_enrollments e
            left join memberships m on m.id = e.membership_id
            left join member_profiles p
              on p.membership_id = e.membership_id and p.deleted_at is null
            left join auth_principals a on a.id = m.auth_principal_id
            where e.plan_id = ${productId}::uuid
              and (${status}::text is null or e.status = ${status})
              and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
              and (${from}::timestamptz is null or e.enrolled_at >= ${from}::timestamptz)
              and (${to}::timestamptz is null or e.enrolled_at <= ${to}::timestamptz)
              and (${q}::text is null or p.display_name ilike ${q} or a.email ilike ${q})
            order by e.enrolled_at desc
            limit ${filter.limit} offset ${offset}`;

    return {
      items: rows.map((row) => ({
        id: String(row["id"]),
        membership_id: String(row["membership_id"]),
        display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        status: String(row["status"]),
        enrolled_type: String(row["enrolled_type"]),
        enrolled_at: row["enrolled_at"] as Date,
        expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
        completed_at: row["completed_at"] instanceof Date ? row["completed_at"] : null,
      })),
      totalCount,
    };
  },

  /**
   * Which of these assessment ids exist and are visible to this tenant.
   *
   * Existence checking is why contents editing can reject a bad reference where
   * create could not: `insertBundle` stores whatever `refId` it is handed, which
   * is how a bundle ends up pointing at a deleted course.
   */
  async findExistingAssessmentIds(tx: TenantTx, assessmentIds: string[]): Promise<Set<string>> {
    if (assessmentIds.length === 0) return new Set();
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id from assessments
      where id = any(${[...new Set(assessmentIds)]}::uuid[]) and deleted_at is null
    `;
    return new Set(rows.map((row) => row.id));
  },

  /**
   * A slug that is free in this table, derived from a base.
   *
   * Duplicating "trader-bundle" twice must not fail on the second attempt, so
   * the suffix walks until it finds a gap. Bounded: a tenant with 50 copies of
   * one product has a different problem, and an unbounded loop here would be a
   * denial of service against our own transaction.
   */
  async nextAvailableSlug(tx: TenantTx, table: ProductTable, baseSlug: string): Promise<string> {
    const trimmed = baseSlug.slice(0, 110);
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = attempt === 1 ? `${trimmed}-copy` : `${trimmed}-copy-${String(attempt)}`;
      if (!(await this.slugExists(tx, table, candidate))) return candidate;
    }
    throw new Error("LEARNER_PRODUCT_SLUG_EXHAUSTED");
  },

  /**
   * Replace a bundle's items wholesale.
   *
   * Delete-then-insert inside the caller's transaction rather than a diff: the
   * item rows carry no state of their own (no progress, no enrolment), so
   * rewriting them is lossless, and a diff would be more code for the same
   * result. Position comes from array order.
   */
  async replaceBundleItems(
    tx: TenantTx,
    bundleId: string,
    items: Array<{ itemKind: string; refId: string }>,
  ): Promise<BundleItemRow[]> {
    await tx.$executeRaw`delete from bundle_items where bundle_id = ${bundleId}::uuid`;

    const rows: BundleItemRow[] = [];
    for (const [index, item] of items.entries()) {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into bundle_items (id, tenant_id, bundle_id, item_kind, ref_id, position, created_at)
        values (
          ${id}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${bundleId}::uuid,
          ${item.itemKind},
          ${item.refId}::uuid,
          ${index},
          now()
        )
      `;
      rows.push({
        id,
        bundle_id: bundleId,
        item_kind: item.itemKind,
        ref_id: item.refId,
        position: index,
      });
    }

    await tx.$executeRaw`
      update bundles set updated_at = now() where id = ${bundleId}::uuid
    `;
    return rows;
  },

  async replaceSubscriptionPlanItems(
    tx: TenantTx,
    planId: string,
    items: Array<{ itemKind: string; refId: string }>,
  ): Promise<LearnerSubscriptionPlanItemRow[]> {
    await tx.$executeRaw`
      delete from learner_subscription_plan_items where plan_id = ${planId}::uuid
    `;

    const rows: LearnerSubscriptionPlanItemRow[] = [];
    for (const [index, item] of items.entries()) {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into learner_subscription_plan_items (
          id, tenant_id, plan_id, item_kind, ref_id, position, created_at
        )
        values (
          ${id}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${planId}::uuid,
          ${item.itemKind},
          ${item.refId}::uuid,
          ${index},
          now()
        )
      `;
      rows.push({
        id,
        plan_id: planId,
        item_kind: item.itemKind,
        ref_id: item.refId,
        position: index,
      });
    }

    await tx.$executeRaw`
      update learner_subscription_plans set updated_at = now() where id = ${planId}::uuid
    `;
    return rows;
  },

  async replaceTestSeriesItems(
    tx: TenantTx,
    testSeriesId: string,
    items: Array<{ title?: string; mockTestId?: string; assessmentId?: string }>,
  ): Promise<TestSeriesItemRow[]> {
    await tx.$executeRaw`
      delete from test_series_items where test_series_id = ${testSeriesId}::uuid
    `;

    const rows: TestSeriesItemRow[] = [];
    for (const [index, item] of items.entries()) {
      const id = randomUUID();
      await tx.$executeRaw`
        insert into test_series_items (
          id, tenant_id, test_series_id, position, title, mock_test_id, assessment_id, created_at
        )
        values (
          ${id}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${testSeriesId}::uuid,
          ${index},
          ${item.title ?? null},
          ${item.mockTestId ?? null}::uuid,
          ${item.assessmentId ?? null}::uuid,
          now()
        )
      `;
      rows.push({
        id,
        test_series_id: testSeriesId,
        position: index,
        title: item.title ?? null,
        mock_test_id: item.mockTestId ?? null,
        assessment_id: item.assessmentId ?? null,
      });
    }

    await tx.$executeRaw`
      update test_series set updated_at = now() where id = ${testSeriesId}::uuid
    `;
    return rows;
  },

  async updateMockTestAssessment(
    tx: TenantTx,
    mockTestId: string,
    assessmentId: string,
  ): Promise<boolean> {
    const updated = await tx.$executeRaw`
      update mock_tests
      set assessment_id = ${assessmentId}::uuid, updated_at = now()
      where id = ${mockTestId}::uuid and deleted_at is null
    `;
    return updated > 0;
  },

  /**
   * The product currently holding a slug, if any.
   *
   * `slugExists` answers yes/no; the create form needs to name the clash so the
   * operator can open it rather than go hunting.
   */
  async findProductBySlug(
    tx: TenantTx,
    table: ProductTable,
    slug: string,
  ): Promise<{ id: string; title: string } | null> {
    let rows: Array<{ id: string; title: string }>;
    if (table === "mock_tests") {
      rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
        select id::text as id, title from mock_tests
        where slug = ${slug} and deleted_at is null limit 1
      `;
    } else if (table === "test_series") {
      rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
        select id::text as id, title from test_series
        where slug = ${slug} and deleted_at is null limit 1
      `;
    } else if (table === "bundles") {
      rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
        select id::text as id, title from bundles
        where slug = ${slug} and deleted_at is null limit 1
      `;
    } else {
      rows = await tx.$queryRaw<Array<{ id: string; title: string }>>`
        select id::text as id, title from learner_subscription_plans
        where slug = ${slug} and deleted_at is null limit 1
      `;
    }
    return rows[0] ?? null;
  },

  /**
   * Apply one change to a set of this product's enrolments.
   *
   * Scoped to the product id as well as the enrolment ids, so a caller cannot
   * reach another product's roster by guessing enrolment ids — RLS already
   * fences the tenant, this fences the product within it.
   */
  async updateProductEnrollments(
    tx: TenantTx,
    table: EnrollmentTable,
    productId: string,
    enrollmentIds: string[],
    change: { status?: string; expiresAt?: Date | null },
  ): Promise<string[]> {
    if (enrollmentIds.length === 0) return [];

    const status = change.status ?? null;
    const setExpiry = change.expiresAt !== undefined;
    const expiresAt = change.expiresAt ?? null;

    const rows =
      table === "mock_test_enrollments"
        ? await tx.$queryRaw<Array<{ id: string }>>`
            update mock_test_enrollments
            set status = coalesce(${status}::text, status),
                expires_at = case when ${setExpiry}::boolean then ${expiresAt}::timestamptz
                                  else expires_at end
            where mock_test_id = ${productId}::uuid and id = any(${enrollmentIds}::uuid[])
            returning id::text as id`
        : table === "test_series_enrollments"
          ? await tx.$queryRaw<Array<{ id: string }>>`
            update test_series_enrollments
            set status = coalesce(${status}::text, status),
                expires_at = case when ${setExpiry}::boolean then ${expiresAt}::timestamptz
                                  else expires_at end
            where test_series_id = ${productId}::uuid and id = any(${enrollmentIds}::uuid[])
            returning id::text as id`
          : table === "bundle_enrollments"
            ? await tx.$queryRaw<Array<{ id: string }>>`
            update bundle_enrollments
            set status = coalesce(${status}::text, status),
                expires_at = case when ${setExpiry}::boolean then ${expiresAt}::timestamptz
                                  else expires_at end
            where bundle_id = ${productId}::uuid and id = any(${enrollmentIds}::uuid[])
            returning id::text as id`
            : await tx.$queryRaw<Array<{ id: string }>>`
            update learner_subscription_enrollments
            set status = coalesce(${status}::text, status),
                expires_at = case when ${setExpiry}::boolean then ${expiresAt}::timestamptz
                                  else expires_at end
            where plan_id = ${productId}::uuid and id = any(${enrollmentIds}::uuid[])
            returning id::text as id`;

    return rows.map((row) => row.id);
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
        mock_test_id: typeof itemRow["mock_test_id"] === "string" ? itemRow["mock_test_id"] : null,
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
  ): Promise<{
    items: Array<{ series: TestSeriesRow; items: TestSeriesItemRow[] }>;
    totalCount: number;
  }> {
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

    const items: Array<{
      plan: LearnerSubscriptionPlanRow;
      items: LearnerSubscriptionPlanItemRow[];
    }> = [];
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
