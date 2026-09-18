import { auditWriter } from "@atlas/audit";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  bundleListResponseSchema,
  bundleResponseSchema,
  createBundleBodySchema,
  createLearnerSubscriptionPlanBodySchema,
  createMockTestBodySchema,
  createTestSeriesBodySchema,
  learnerProductListQuerySchema,
  learnerSubscriptionPlanListResponseSchema,
  learnerSubscriptionPlanResponseSchema,
  mockTestListResponseSchema,
  mockTestResponseSchema,
  productEnrollBodySchema,
  productEnrollmentResponseSchema,
  testSeriesListResponseSchema,
  testSeriesResponseSchema,
  duplicateLearnerProductBodySchema,
  learnerProductSlugCheckQuerySchema,
  learnerProductSlugCheckResponseSchema,
  learnerProductStatusResponseSchema,
  productEnrollmentListResponseSchema,
  replaceBundleContentsBodySchema,
  replaceMockTestContentsBodySchema,
  replaceSubscriptionPlanContentsBodySchema,
  replaceTestSeriesContentsBodySchema,
  productEnrollmentActionBodySchema,
  productEnrollmentActionResponseSchema,
  productEnrollmentListQuerySchema,
  updateLearnerProductStatusBodySchema,
  type BUNDLE_ITEM_KINDS,
  type LEARNER_PRODUCT_KINDS,
  type PUBLISH_STATUSES,
  type SUBSCRIPTION_ITEM_KINDS,
} from "./learner-products.dto";
import {
  bundleNotFound,
  duplicateLearnerProductSlug,
  learnerSubscriptionPlanNotFound,
  learnerProductContentsConflict,
  mockTestNotFound,
  testSeriesNotFound,
  unknownLearnerProductReferences,
} from "./learner-products.errors";
import {
  BUNDLE_AUDIT_TARGET,
  BUNDLE_CONTENTS_UPDATED_AUDIT,
  BUNDLE_CREATED_AUDIT,
  BUNDLE_DUPLICATED_AUDIT,
  BUNDLE_ENROLLED_AUDIT,
  BUNDLE_STATUS_CHANGED_AUDIT,
  MOCK_TEST_AUDIT_TARGET,
  MOCK_TEST_CONTENTS_UPDATED_AUDIT,
  MOCK_TEST_CREATED_AUDIT,
  MOCK_TEST_DUPLICATED_AUDIT,
  MOCK_TEST_ENROLLED_AUDIT,
  MOCK_TEST_STATUS_CHANGED_AUDIT,
  SUBSCRIPTION_PLAN_AUDIT_TARGET,
  SUBSCRIPTION_PLAN_CONTENTS_UPDATED_AUDIT,
  SUBSCRIPTION_PLAN_CREATED_AUDIT,
  SUBSCRIPTION_PLAN_DUPLICATED_AUDIT,
  SUBSCRIPTION_PLAN_ENROLLED_AUDIT,
  SUBSCRIPTION_PLAN_STATUS_CHANGED_AUDIT,
  TEST_SERIES_AUDIT_TARGET,
  TEST_SERIES_CONTENTS_UPDATED_AUDIT,
  TEST_SERIES_CREATED_AUDIT,
  TEST_SERIES_DUPLICATED_AUDIT,
  TEST_SERIES_ENROLLED_AUDIT,
  TEST_SERIES_STATUS_CHANGED_AUDIT,
  ENROLLMENT_AUDIT_TARGET,
  ENROLLMENT_EXPIRY_CHANGED_AUDIT,
  ENROLLMENT_RESTORED_AUDIT,
  ENROLLMENT_REVOKED_AUDIT,
} from "./learner-products.events";
import {
  learnerProductPageInfo,
  learnerProductsRepository,
  type BundleItemRow,
  type BundleRow,
  type LearnerSubscriptionPlanItemRow,
  type LearnerSubscriptionPlanRow,
  type MockTestRow,
  type EnrollmentFilter,
  type EnrollmentTable,
  type ProductEnrollmentListRow,
  type ProductEnrollmentRow,
  type ProductTable,
  type TestSeriesItemRow,
  type TestSeriesRow,
} from "./learner-products.repository";

type PublishStatus = (typeof PUBLISH_STATUSES)[number];

function parseExpiresAt(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

/**
 * What each product kind is called in the database and in the audit log.
 *
 * One table keyed by the wire value keeps the four catalogues from drifting
 * into four near-identical status handlers.
 */
const PRODUCT_KIND_TABLES: Record<
  (typeof LEARNER_PRODUCT_KINDS)[number],
  { table: ProductTable; auditAction: string; auditTarget: string }
> = {
  mock_test: {
    table: "mock_tests",
    auditAction: MOCK_TEST_STATUS_CHANGED_AUDIT,
    auditTarget: MOCK_TEST_AUDIT_TARGET,
  },
  test_series: {
    table: "test_series",
    auditAction: TEST_SERIES_STATUS_CHANGED_AUDIT,
    auditTarget: TEST_SERIES_AUDIT_TARGET,
  },
  bundle: {
    table: "bundles",
    auditAction: BUNDLE_STATUS_CHANGED_AUDIT,
    auditTarget: BUNDLE_AUDIT_TARGET,
  },
  subscription_plan: {
    table: "learner_subscription_plans",
    auditAction: SUBSCRIPTION_PLAN_STATUS_CHANGED_AUDIT,
    auditTarget: SUBSCRIPTION_PLAN_AUDIT_TARGET,
  },
};

/** Actor envelope every audit entry in this module shares. */
function auditActor(ctx: ServiceCtx) {
  return {
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    platformPrincipalId: null,
    requestId: ctx.requestId,
  };
}

/**
 * One audit entry per catalogue state change.
 *
 * `before`/`after` carry the publish state rather than the whole product: the
 * question this log answers is "who took this live, and when", and dumping the
 * full row would bury that under fields the transition never touched.
 */
async function auditStatusChange(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    action: string;
    targetType: string;
    productId: string;
    slug: string;
    before: string;
    after: string;
  },
) {
  await auditWriter.write(tx, auditActor(ctx), {
    action: args.action,
    target: { type: args.targetType, id: args.productId },
    before: { status: args.before },
    after: { status: args.after },
    metadata: { slug: args.slug },
  });
}

/**
 * One audit entry per product added to the catalogue.
 *
 * `create*` already declared `audit: "required"` in its route metadata and
 * wrote nothing, so the declaration was the only record that the entry existed.
 */
async function auditProductCreated(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    action: string;
    targetType: string;
    productId: string;
    slug: string;
    title: string;
    status: string;
  },
) {
  await auditWriter.write(tx, auditActor(ctx), {
    action: args.action,
    target: { type: args.targetType, id: args.productId },
    before: null,
    after: { slug: args.slug, title: args.title, status: args.status },
    metadata: {},
  });
}

/**
 * One audit entry per admin-side enrolment.
 *
 * This is access granted by an operator with no payment and no invoice behind
 * it, which is exactly the kind of grant a school needs to be able to trace
 * back to a person afterwards.
 */
async function auditEnrolment(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    action: string;
    targetType: string;
    productId: string;
    enrollment: ProductEnrollmentRow;
  },
) {
  await auditWriter.write(tx, auditActor(ctx), {
    action: args.action,
    target: { type: args.targetType, id: args.productId },
    before: null,
    after: {
      enrollmentId: args.enrollment.id,
      membershipId: args.enrollment.membership_id,
      enrolledType: args.enrollment.enrolled_type,
      expiresAt: args.enrollment.expires_at?.toISOString() ?? null,
    },
    metadata: {},
  });
}

function toMockTestDto(row: MockTestRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    assessmentId: row.assessment_id,
    status: row.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toTestSeriesDto(series: TestSeriesRow, items: TestSeriesItemRow[]) {
  return {
    id: series.id,
    slug: series.slug,
    title: series.title,
    description: series.description,
    status: series.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    items: items.map((item) => ({
      id: item.id,
      position: item.position,
      title: item.title,
      mockTestId: item.mock_test_id,
      assessmentId: item.assessment_id,
    })),
    createdAt: series.created_at.toISOString(),
    updatedAt: series.updated_at.toISOString(),
  };
}

/** Empty map = titles were not resolved for this call; every item reads null. */
type ItemTitles = Map<string, string>;

function itemTitle(titles: ItemTitles, kind: string, refId: string): string | null {
  return titles.get(`${kind}:${refId}`) ?? null;
}

function toBundleDto(bundle: BundleRow, items: BundleItemRow[], titles: ItemTitles) {
  return {
    id: bundle.id,
    slug: bundle.slug,
    title: bundle.title,
    description: bundle.description,
    status: bundle.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    items: items.map((item) => ({
      id: item.id,
      itemKind: item.item_kind as (typeof BUNDLE_ITEM_KINDS)[number],
      refId: item.ref_id,
      position: item.position,
      title: itemTitle(titles, item.item_kind, item.ref_id),
    })),
    createdAt: bundle.created_at.toISOString(),
    updatedAt: bundle.updated_at.toISOString(),
  };
}

function toPlanDto(
  plan: LearnerSubscriptionPlanRow,
  items: LearnerSubscriptionPlanItemRow[],
  titles: ItemTitles,
) {
  return {
    id: plan.id,
    slug: plan.slug,
    title: plan.title,
    description: plan.description,
    billingInterval: plan.billing_interval as "monthly" | "yearly" | "custom",
    status: plan.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    items: items.map((item) => ({
      id: item.id,
      itemKind: item.item_kind as (typeof SUBSCRIPTION_ITEM_KINDS)[number],
      refId: item.ref_id,
      position: item.position,
      title: itemTitle(titles, item.item_kind, item.ref_id),
    })),
    createdAt: plan.created_at.toISOString(),
    updatedAt: plan.updated_at.toISOString(),
  };
}

function toEnrollmentDto(row: ProductEnrollmentRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    status: row.status,
    enrolledType: row.enrolled_type,
    enrolledAt: row.enrolled_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
  };
}

/**
 * Resolve the titles behind a set of item pointers in one batched pass.
 *
 * Called once per request with every item on the page, so a catalogue page
 * costs four statements rather than four per row.
 */
async function resolveTitlesFor(
  tx: TenantTx,
  items: Array<{ item_kind: string; ref_id: string }>,
): Promise<ItemTitles> {
  return learnerProductsRepository.resolveItemTitles(
    tx,
    items.map((item) => ({ kind: item.item_kind, refId: item.ref_id })),
  );
}

function toEnrollmentListItemDto(row: ProductEnrollmentListRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    enrolledType: row.enrolled_type,
    enrolledAt: row.enrolled_at.toISOString(),
    expiresAt: row.expires_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

/**
 * Enrolment listing, dispatched by product kind.
 *
 * The console could place a learner into a product and then had no way to show
 * who was already in it, so every detail screen had to admit it could not
 * answer the first question an administrator asks.
 */
async function listEnrollments(
  tx: TenantTx,
  table: EnrollmentTable,
  productId: string,
  rawQuery: unknown,
) {
  const query = productEnrollmentListQuerySchema.parse(rawQuery);

  // `exactOptionalPropertyTypes` is on, so an absent filter must be an absent
  // key rather than an explicit `undefined`.
  const filter: EnrollmentFilter = {
    page: query.page,
    limit: query.limit,
    ...(query.q !== undefined ? { q: query.q } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.enrolledType !== undefined ? { enrolledType: query.enrolledType } : {}),
    ...(query.enrolledFrom !== undefined ? { enrolledFrom: query.enrolledFrom } : {}),
    ...(query.enrolledTo !== undefined ? { enrolledTo: query.enrolledTo } : {}),
  };

  const { items, totalCount } = await learnerProductsRepository.listProductEnrollments(
    tx,
    table,
    productId,
    filter,
  );

  return productEnrollmentListResponseSchema.parse({
    data: {
      items: items.map(toEnrollmentListItemDto),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

async function fanOutBundleItems(
  tx: TenantTx,
  items: BundleItemRow[],
  membershipId: string,
  enrolledType: string,
  expiresAt: Date | null,
): Promise<void> {
  for (const item of items) {
    if (item.item_kind === "course") {
      await learnerProductsRepository.upsertCourseEnrollment(tx, {
        courseId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      continue;
    }
    if (item.item_kind === "mock_test") {
      await learnerProductsRepository.enrollMockTest(tx, {
        mockTestId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      continue;
    }
    if (item.item_kind === "test_series") {
      await learnerProductsRepository.enrollTestSeries(tx, {
        testSeriesId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
    }
  }
}

async function fanOutSubscriptionItems(
  tx: TenantTx,
  items: LearnerSubscriptionPlanItemRow[],
  membershipId: string,
  enrolledType: string,
  expiresAt: Date | null,
): Promise<void> {
  for (const item of items) {
    if (item.item_kind === "course") {
      await learnerProductsRepository.upsertCourseEnrollment(tx, {
        courseId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      continue;
    }
    if (item.item_kind === "mock_test") {
      await learnerProductsRepository.enrollMockTest(tx, {
        mockTestId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      continue;
    }
    if (item.item_kind === "test_series") {
      await learnerProductsRepository.enrollTestSeries(tx, {
        testSeriesId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      continue;
    }
    if (item.item_kind === "bundle") {
      await learnerProductsRepository.enrollBundle(tx, {
        bundleId: item.ref_id,
        membershipId,
        enrolledType,
        expiresAt,
      });
      const bundle = await learnerProductsRepository.findBundleById(tx, item.ref_id);
      if (bundle) {
        await fanOutBundleItems(tx, bundle.items, membershipId, enrolledType, expiresAt);
      }
    }
  }
}

export async function createMockTest(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createMockTestBodySchema.parse(rawBody);
  if (await learnerProductsRepository.slugExists(tx, "mock_tests", body.slug)) {
    throw duplicateLearnerProductSlug("Mock test");
  }

  const row = await learnerProductsRepository.insertMockTest(tx, {
    slug: body.slug,
    title: body.title,
    ...(body.description !== undefined ? { description: body.description } : {}),
    assessmentId: body.assessmentId,
    status: body.status,
    createdByMembershipId: ctx.actorMembershipId,
  });

  await auditProductCreated(tx, ctx, {
    action: MOCK_TEST_CREATED_AUDIT,
    targetType: MOCK_TEST_AUDIT_TARGET,
    productId: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
  });

  return mockTestResponseSchema.parse({ data: toMockTestDto(row) });
}

export async function listMockTests(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = learnerProductListQuerySchema.parse(rawQuery);
  const { items, totalCount } = await learnerProductsRepository.listMockTests(tx, {
    page: query.page,
    limit: query.limit,
    ...(query.q !== undefined ? { q: query.q } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  });

  return mockTestListResponseSchema.parse({
    data: {
      items: items.map(toMockTestDto),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getMockTest(tx: TenantTx, _ctx: ServiceCtx, mockTestId: string) {
  const row = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!row) throw mockTestNotFound();
  return mockTestResponseSchema.parse({ data: toMockTestDto(row) });
}

export async function enrollMockTest(
  tx: TenantTx,
  ctx: ServiceCtx,
  mockTestId: string,
  rawBody: unknown,
) {
  const body = productEnrollBodySchema.parse(rawBody);
  const product = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!product) throw mockTestNotFound();

  const enrollment = await learnerProductsRepository.enrollMockTest(tx, {
    mockTestId,
    membershipId: body.membershipId,
    enrolledType: body.enrolledType,
    expiresAt: parseExpiresAt(body.expiresAt),
  });

  await auditEnrolment(tx, ctx, {
    action: MOCK_TEST_ENROLLED_AUDIT,
    targetType: MOCK_TEST_AUDIT_TARGET,
    productId: mockTestId,
    enrollment,
  });

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}

export async function createTestSeries(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createTestSeriesBodySchema.parse(rawBody);
  if (await learnerProductsRepository.slugExists(tx, "test_series", body.slug)) {
    throw duplicateLearnerProductSlug("Test series");
  }

  const result = await learnerProductsRepository.insertTestSeries(tx, {
    slug: body.slug,
    title: body.title,
    ...(body.description !== undefined ? { description: body.description } : {}),
    status: body.status,
    createdByMembershipId: ctx.actorMembershipId,
    items: body.items.map((item) => ({
      position: item.position,
      ...(item.title !== undefined ? { title: item.title } : {}),
      ...(item.mockTestId !== undefined ? { mockTestId: item.mockTestId } : {}),
      ...(item.assessmentId !== undefined ? { assessmentId: item.assessmentId } : {}),
    })),
  });

  await auditProductCreated(tx, ctx, {
    action: TEST_SERIES_CREATED_AUDIT,
    targetType: TEST_SERIES_AUDIT_TARGET,
    productId: result.series.id,
    slug: result.series.slug,
    title: result.series.title,
    status: result.series.status,
  });

  return testSeriesResponseSchema.parse({
    data: toTestSeriesDto(result.series, result.items),
  });
}

export async function listTestSeries(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = learnerProductListQuerySchema.parse(rawQuery);
  const { items, totalCount } = await learnerProductsRepository.listTestSeries(tx, {
    page: query.page,
    limit: query.limit,
    ...(query.q !== undefined ? { q: query.q } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  });

  return testSeriesListResponseSchema.parse({
    data: {
      items: items.map(({ series, items: seriesItems }) => toTestSeriesDto(series, seriesItems)),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getTestSeries(tx: TenantTx, _ctx: ServiceCtx, testSeriesId: string) {
  const result = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!result) throw testSeriesNotFound();
  return testSeriesResponseSchema.parse({
    data: toTestSeriesDto(result.series, result.items),
  });
}

export async function enrollTestSeries(
  tx: TenantTx,
  ctx: ServiceCtx,
  testSeriesId: string,
  rawBody: unknown,
) {
  const body = productEnrollBodySchema.parse(rawBody);
  const product = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!product) throw testSeriesNotFound();

  const enrollment = await learnerProductsRepository.enrollTestSeries(tx, {
    testSeriesId,
    membershipId: body.membershipId,
    enrolledType: body.enrolledType,
    expiresAt: parseExpiresAt(body.expiresAt),
  });

  await auditEnrolment(tx, ctx, {
    action: TEST_SERIES_ENROLLED_AUDIT,
    targetType: TEST_SERIES_AUDIT_TARGET,
    productId: testSeriesId,
    enrollment,
  });

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}

export async function createBundle(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createBundleBodySchema.parse(rawBody);
  if (await learnerProductsRepository.slugExists(tx, "bundles", body.slug)) {
    throw duplicateLearnerProductSlug("Bundle");
  }

  // Same check the contents editor performs: a create that stores an unknown
  // refId is how the catalogue accumulates items pointing at nothing.
  await assertReferencesExist(
    tx,
    body.items.map((item) => ({ kind: item.itemKind, refId: item.refId })),
  );

  const result = await learnerProductsRepository.insertBundle(tx, {
    slug: body.slug,
    title: body.title,
    ...(body.description !== undefined ? { description: body.description } : {}),
    status: body.status,
    createdByMembershipId: ctx.actorMembershipId,
    items: body.items.map((item) => ({
      itemKind: item.itemKind,
      refId: item.refId,
      position: item.position,
    })),
  });

  await auditProductCreated(tx, ctx, {
    action: BUNDLE_CREATED_AUDIT,
    targetType: BUNDLE_AUDIT_TARGET,
    productId: result.bundle.id,
    slug: result.bundle.slug,
    title: result.bundle.title,
    status: result.bundle.status,
  });

  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function listBundles(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = learnerProductListQuerySchema.parse(rawQuery);
  const { items, totalCount } = await learnerProductsRepository.listBundles(tx, {
    page: query.page,
    limit: query.limit,
    ...(query.q !== undefined ? { q: query.q } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  });

  // One resolution pass for every item on the page, not one per bundle.
  const titles = await resolveTitlesFor(
    tx,
    items.flatMap((entry) => entry.items),
  );

  return bundleListResponseSchema.parse({
    data: {
      items: items.map(({ bundle, items: bundleItems }) =>
        toBundleDto(bundle, bundleItems, titles),
      ),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getBundle(tx: TenantTx, _ctx: ServiceCtx, bundleId: string) {
  const result = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!result) throw bundleNotFound();
  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function enrollBundle(
  tx: TenantTx,
  ctx: ServiceCtx,
  bundleId: string,
  rawBody: unknown,
) {
  const body = productEnrollBodySchema.parse(rawBody);
  const product = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!product) throw bundleNotFound();

  const expiresAt = parseExpiresAt(body.expiresAt);
  const enrollment = await learnerProductsRepository.enrollBundle(tx, {
    bundleId,
    membershipId: body.membershipId,
    enrolledType: body.enrolledType,
    expiresAt,
  });

  await fanOutBundleItems(tx, product.items, body.membershipId, body.enrolledType, expiresAt);

  await auditEnrolment(tx, ctx, {
    action: BUNDLE_ENROLLED_AUDIT,
    targetType: BUNDLE_AUDIT_TARGET,
    productId: bundleId,
    enrollment,
  });

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}

export async function createLearnerSubscriptionPlan(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = createLearnerSubscriptionPlanBodySchema.parse(rawBody);
  if (await learnerProductsRepository.slugExists(tx, "learner_subscription_plans", body.slug)) {
    throw duplicateLearnerProductSlug("Learner subscription plan");
  }

  await assertReferencesExist(
    tx,
    body.items.map((item) => ({ kind: item.itemKind, refId: item.refId })),
  );

  const result = await learnerProductsRepository.insertLearnerSubscriptionPlan(tx, {
    slug: body.slug,
    title: body.title,
    ...(body.description !== undefined ? { description: body.description } : {}),
    billingInterval: body.billingInterval,
    status: body.status,
    createdByMembershipId: ctx.actorMembershipId,
    items: body.items.map((item) => ({
      itemKind: item.itemKind,
      refId: item.refId,
      position: item.position,
    })),
  });

  await auditProductCreated(tx, ctx, {
    action: SUBSCRIPTION_PLAN_CREATED_AUDIT,
    targetType: SUBSCRIPTION_PLAN_AUDIT_TARGET,
    productId: result.plan.id,
    slug: result.plan.slug,
    title: result.plan.title,
    status: result.plan.status,
  });

  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function listLearnerSubscriptionPlans(
  tx: TenantTx,
  _ctx: ServiceCtx,
  rawQuery: unknown,
) {
  const query = learnerProductListQuerySchema.parse(rawQuery);
  const { items, totalCount } = await learnerProductsRepository.listLearnerSubscriptionPlans(tx, {
    page: query.page,
    limit: query.limit,
    ...(query.q !== undefined ? { q: query.q } : {}),
    ...(query.status !== undefined ? { status: query.status } : {}),
  });

  const titles = await resolveTitlesFor(
    tx,
    items.flatMap((entry) => entry.items),
  );

  return learnerSubscriptionPlanListResponseSchema.parse({
    data: {
      items: items.map(({ plan, items: planItems }) => toPlanDto(plan, planItems, titles)),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getLearnerSubscriptionPlan(tx: TenantTx, _ctx: ServiceCtx, planId: string) {
  const result = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!result) throw learnerSubscriptionPlanNotFound();
  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function enrollLearnerSubscriptionPlan(
  tx: TenantTx,
  ctx: ServiceCtx,
  planId: string,
  rawBody: unknown,
) {
  const body = productEnrollBodySchema.parse(rawBody);
  const product = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!product) throw learnerSubscriptionPlanNotFound();

  const expiresAt = parseExpiresAt(body.expiresAt);
  const enrollment = await learnerProductsRepository.enrollLearnerSubscriptionPlan(tx, {
    planId,
    membershipId: body.membershipId,
    enrolledType: body.enrolledType,
    expiresAt,
  });

  await fanOutSubscriptionItems(tx, product.items, body.membershipId, body.enrolledType, expiresAt);

  await auditEnrolment(tx, ctx, {
    action: SUBSCRIPTION_PLAN_ENROLLED_AUDIT,
    targetType: SUBSCRIPTION_PLAN_AUDIT_TARGET,
    productId: planId,
    enrollment,
  });

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}

/**
 * Publish-state transitions for a set of catalogue products.
 *
 * The catalogue admin could create a product and enrol learners into it but
 * never move it out of DRAFT, so nothing a tenant created could be published
 * without a direct database write.
 *
 * One transaction for the whole selection: publishing twenty-five rows either
 * happens or does not, and the audit entries land with it. Ids the tenant
 * cannot see come back as `missingIds` rather than aborting the batch — a row
 * archived by a colleague while this page sat open should not cost the operator
 * the other twenty-four.
 */
export async function updateLearnerProductStatuses(
  tx: TenantTx,
  ctx: ServiceCtx,
  rawBody: unknown,
) {
  const body = updateLearnerProductStatusBodySchema.parse(rawBody);
  const kind = PRODUCT_KIND_TABLES[body.productKind];

  // De-duplicated so a repeated id cannot produce two audit entries for one row.
  const requestedIds = [...new Set(body.productIds)];

  const before = await learnerProductsRepository.listProductStatuses(tx, kind.table, requestedIds);
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const missingIds = requestedIds.filter((id) => !beforeById.has(id));

  const after = await learnerProductsRepository.updateProductStatuses(
    tx,
    kind.table,
    before.map((row) => row.id),
    body.status,
  );

  const updated = after.map((row) => ({
    id: row.id,
    slug: row.slug,
    previousStatus: (beforeById.get(row.id)?.status ?? row.status) as PublishStatus,
    status: row.status as PublishStatus,
  }));

  for (const row of updated) {
    await auditStatusChange(tx, ctx, {
      action: kind.auditAction,
      targetType: kind.auditTarget,
      productId: row.id,
      slug: row.slug,
      before: row.previousStatus,
      after: row.status,
    });
  }

  return learnerProductStatusResponseSchema.parse({ data: { updated, missingIds } });
}

export async function listMockTestEnrollments(
  tx: TenantTx,
  _ctx: ServiceCtx,
  mockTestId: string,
  rawQuery: unknown,
) {
  const product = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!product) throw mockTestNotFound();
  return listEnrollments(tx, "mock_test_enrollments", mockTestId, rawQuery);
}

export async function listTestSeriesEnrollments(
  tx: TenantTx,
  _ctx: ServiceCtx,
  testSeriesId: string,
  rawQuery: unknown,
) {
  const product = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!product) throw testSeriesNotFound();
  return listEnrollments(tx, "test_series_enrollments", testSeriesId, rawQuery);
}

export async function listBundleEnrollments(
  tx: TenantTx,
  _ctx: ServiceCtx,
  bundleId: string,
  rawQuery: unknown,
) {
  const product = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!product) throw bundleNotFound();
  return listEnrollments(tx, "bundle_enrollments", bundleId, rawQuery);
}

export async function listLearnerSubscriptionPlanEnrollments(
  tx: TenantTx,
  _ctx: ServiceCtx,
  planId: string,
  rawQuery: unknown,
) {
  const product = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!product) throw learnerSubscriptionPlanNotFound();
  return listEnrollments(tx, "learner_subscription_enrollments", planId, rawQuery);
}

/**
 * Reject a contents edit that points at products this school does not have.
 *
 * `create` accepts any `refId` and stores it, which is the mechanism behind
 * every "referenced product no longer exists" row on the detail screen. Edit
 * refuses instead — checking existence costs the same batched lookup the screen
 * already performs to render titles.
 */
async function assertReferencesExist(
  tx: TenantTx,
  refs: Array<{ kind: string; refId: string }>,
): Promise<void> {
  const titles = await learnerProductsRepository.resolveItemTitles(tx, refs);
  const missing = refs
    .filter((ref) => !titles.has(`${ref.kind}:${ref.refId}`))
    .map((ref) => ref.refId);
  if (missing.length > 0) throw unknownLearnerProductReferences([...new Set(missing)]);
}

async function auditContentsChange(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    action: string;
    targetType: string;
    productId: string;
    before: unknown;
    after: unknown;
  },
) {
  await auditWriter.write(tx, auditActor(ctx), {
    action: args.action,
    target: { type: args.targetType, id: args.productId },
    before: args.before,
    after: args.after,
    metadata: {},
  });
}

/**
 * Refuse a contents save built against a stale view of the product.
 *
 * Compared as instants rather than strings: the client echoes back the
 * `updatedAt` it received, and a round trip through JSON must not make an
 * unchanged timestamp look different.
 */
function assertContentsUnchanged(expected: string | undefined, actual: Date): void {
  if (expected === undefined) return;
  if (new Date(expected).getTime() !== actual.getTime()) {
    throw learnerProductContentsConflict();
  }
}

export async function replaceBundleContents(
  tx: TenantTx,
  ctx: ServiceCtx,
  bundleId: string,
  rawBody: unknown,
) {
  const body = replaceBundleContentsBodySchema.parse(rawBody);
  const existing = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!existing) throw bundleNotFound();
  assertContentsUnchanged(body.expectedUpdatedAt, existing.bundle.updated_at);

  await assertReferencesExist(
    tx,
    body.items.map((item) => ({ kind: item.itemKind, refId: item.refId })),
  );

  const items = await learnerProductsRepository.replaceBundleItems(tx, bundleId, body.items);

  await auditContentsChange(tx, ctx, {
    action: BUNDLE_CONTENTS_UPDATED_AUDIT,
    targetType: BUNDLE_AUDIT_TARGET,
    productId: bundleId,
    before: { items: existing.items.map((item) => `${item.item_kind}:${item.ref_id}`) },
    after: { items: items.map((item) => `${item.item_kind}:${item.ref_id}`) },
  });

  const result = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!result) throw bundleNotFound();
  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function replaceSubscriptionPlanContents(
  tx: TenantTx,
  ctx: ServiceCtx,
  planId: string,
  rawBody: unknown,
) {
  const body = replaceSubscriptionPlanContentsBodySchema.parse(rawBody);
  const existing = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!existing) throw learnerSubscriptionPlanNotFound();
  assertContentsUnchanged(body.expectedUpdatedAt, existing.plan.updated_at);

  await assertReferencesExist(
    tx,
    body.items.map((item) => ({ kind: item.itemKind, refId: item.refId })),
  );

  const items = await learnerProductsRepository.replaceSubscriptionPlanItems(
    tx,
    planId,
    body.items,
  );

  await auditContentsChange(tx, ctx, {
    action: SUBSCRIPTION_PLAN_CONTENTS_UPDATED_AUDIT,
    targetType: SUBSCRIPTION_PLAN_AUDIT_TARGET,
    productId: planId,
    before: { items: existing.items.map((item) => `${item.item_kind}:${item.ref_id}`) },
    after: { items: items.map((item) => `${item.item_kind}:${item.ref_id}`) },
  });

  const result = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!result) throw learnerSubscriptionPlanNotFound();
  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function replaceTestSeriesContents(
  tx: TenantTx,
  ctx: ServiceCtx,
  testSeriesId: string,
  rawBody: unknown,
) {
  const body = replaceTestSeriesContentsBodySchema.parse(rawBody);
  const existing = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!existing) throw testSeriesNotFound();
  assertContentsUnchanged(body.expectedUpdatedAt, existing.series.updated_at);

  // A series item points at a mock test, an assessment, or both; each reference
  // is checked against the table it actually lives in.
  await assertReferencesExist(
    tx,
    body.items
      .filter((item) => item.mockTestId !== undefined)
      .map((item) => ({ kind: "mock_test", refId: item.mockTestId as string })),
  );

  const assessmentIds = body.items
    .filter((item) => item.assessmentId !== undefined)
    .map((item) => item.assessmentId as string);
  if (assessmentIds.length > 0) {
    const found = await learnerProductsRepository.findExistingAssessmentIds(tx, assessmentIds);
    const missing = assessmentIds.filter((id) => !found.has(id));
    if (missing.length > 0) throw unknownLearnerProductReferences([...new Set(missing)]);
  }

  const items = await learnerProductsRepository.replaceTestSeriesItems(
    tx,
    testSeriesId,
    body.items.map((item) => ({
      ...(item.title !== undefined ? { title: item.title } : {}),
      ...(item.mockTestId !== undefined ? { mockTestId: item.mockTestId } : {}),
      ...(item.assessmentId !== undefined ? { assessmentId: item.assessmentId } : {}),
    })),
  );

  await auditContentsChange(tx, ctx, {
    action: TEST_SERIES_CONTENTS_UPDATED_AUDIT,
    targetType: TEST_SERIES_AUDIT_TARGET,
    productId: testSeriesId,
    before: { itemCount: existing.items.length },
    after: { itemCount: items.length },
  });

  const result = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!result) throw testSeriesNotFound();
  return testSeriesResponseSchema.parse({ data: toTestSeriesDto(result.series, result.items) });
}

export async function replaceMockTestContents(
  tx: TenantTx,
  ctx: ServiceCtx,
  mockTestId: string,
  rawBody: unknown,
) {
  const body = replaceMockTestContentsBodySchema.parse(rawBody);
  const existing = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!existing) throw mockTestNotFound();
  assertContentsUnchanged(body.expectedUpdatedAt, existing.updated_at);

  const found = await learnerProductsRepository.findExistingAssessmentIds(tx, [body.assessmentId]);
  if (!found.has(body.assessmentId)) throw unknownLearnerProductReferences([body.assessmentId]);

  const updated = await learnerProductsRepository.updateMockTestAssessment(
    tx,
    mockTestId,
    body.assessmentId,
  );
  if (!updated) throw mockTestNotFound();

  await auditContentsChange(tx, ctx, {
    action: MOCK_TEST_CONTENTS_UPDATED_AUDIT,
    targetType: MOCK_TEST_AUDIT_TARGET,
    productId: mockTestId,
    before: { assessmentId: existing.assessment_id },
    after: { assessmentId: body.assessmentId },
  });

  const row = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!row) throw mockTestNotFound();
  return mockTestResponseSchema.parse({ data: toMockTestDto(row) });
}

/**
 * Duplicating a product.
 *
 * The copy lands in DRAFT whatever the source's state, on a slug derived from
 * the original, carrying the same items. Enrolments are deliberately not
 * copied: they belong to the product a learner was actually placed into, and
 * cloning them would grant access nobody asked for.
 */
async function auditDuplicate(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: { action: string; targetType: string; sourceId: string; copyId: string; slug: string },
) {
  await auditWriter.write(tx, auditActor(ctx), {
    action: args.action,
    target: { type: args.targetType, id: args.copyId },
    before: null,
    after: { slug: args.slug, status: "DRAFT", duplicatedFrom: args.sourceId },
    metadata: { sourceProductId: args.sourceId },
  });
}

function copyTitle(sourceTitle: string, requested: string | undefined): string {
  return (requested ?? `${sourceTitle} (copy)`).slice(0, 512);
}

export async function duplicateMockTest(
  tx: TenantTx,
  ctx: ServiceCtx,
  mockTestId: string,
  rawBody: unknown,
) {
  const body = duplicateLearnerProductBodySchema.parse(rawBody);
  const source = await learnerProductsRepository.findMockTestById(tx, mockTestId);
  if (!source) throw mockTestNotFound();

  const slug =
    body.slug ?? (await learnerProductsRepository.nextAvailableSlug(tx, "mock_tests", source.slug));
  if (await learnerProductsRepository.slugExists(tx, "mock_tests", slug)) {
    throw duplicateLearnerProductSlug("Mock test");
  }

  const row = await learnerProductsRepository.insertMockTest(tx, {
    slug,
    title: copyTitle(source.title, body.title),
    ...(source.description !== null ? { description: source.description } : {}),
    assessmentId: source.assessment_id,
    status: "DRAFT",
    createdByMembershipId: ctx.actorMembershipId,
  });

  await auditDuplicate(tx, ctx, {
    action: MOCK_TEST_DUPLICATED_AUDIT,
    targetType: MOCK_TEST_AUDIT_TARGET,
    sourceId: mockTestId,
    copyId: row.id,
    slug,
  });

  return mockTestResponseSchema.parse({ data: toMockTestDto(row) });
}

export async function duplicateTestSeries(
  tx: TenantTx,
  ctx: ServiceCtx,
  testSeriesId: string,
  rawBody: unknown,
) {
  const body = duplicateLearnerProductBodySchema.parse(rawBody);
  const source = await learnerProductsRepository.findTestSeriesById(tx, testSeriesId);
  if (!source) throw testSeriesNotFound();

  const slug =
    body.slug ??
    (await learnerProductsRepository.nextAvailableSlug(tx, "test_series", source.series.slug));
  if (await learnerProductsRepository.slugExists(tx, "test_series", slug)) {
    throw duplicateLearnerProductSlug("Test series");
  }

  const result = await learnerProductsRepository.insertTestSeries(tx, {
    slug,
    title: copyTitle(source.series.title, body.title),
    ...(source.series.description !== null ? { description: source.series.description } : {}),
    status: "DRAFT",
    createdByMembershipId: ctx.actorMembershipId,
    items: source.items.map((item, index) => ({
      position: index,
      ...(item.title !== null ? { title: item.title } : {}),
      ...(item.mock_test_id !== null ? { mockTestId: item.mock_test_id } : {}),
      ...(item.assessment_id !== null ? { assessmentId: item.assessment_id } : {}),
    })),
  });

  await auditDuplicate(tx, ctx, {
    action: TEST_SERIES_DUPLICATED_AUDIT,
    targetType: TEST_SERIES_AUDIT_TARGET,
    sourceId: testSeriesId,
    copyId: result.series.id,
    slug,
  });

  return testSeriesResponseSchema.parse({ data: toTestSeriesDto(result.series, result.items) });
}

export async function duplicateBundle(
  tx: TenantTx,
  ctx: ServiceCtx,
  bundleId: string,
  rawBody: unknown,
) {
  const body = duplicateLearnerProductBodySchema.parse(rawBody);
  const source = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!source) throw bundleNotFound();

  const slug =
    body.slug ??
    (await learnerProductsRepository.nextAvailableSlug(tx, "bundles", source.bundle.slug));
  if (await learnerProductsRepository.slugExists(tx, "bundles", slug)) {
    throw duplicateLearnerProductSlug("Bundle");
  }

  const result = await learnerProductsRepository.insertBundle(tx, {
    slug,
    title: copyTitle(source.bundle.title, body.title),
    ...(source.bundle.description !== null ? { description: source.bundle.description } : {}),
    status: "DRAFT",
    createdByMembershipId: ctx.actorMembershipId,
    items: source.items.map((item, index) => ({
      itemKind: item.item_kind as (typeof BUNDLE_ITEM_KINDS)[number],
      refId: item.ref_id,
      position: index,
    })),
  });

  await auditDuplicate(tx, ctx, {
    action: BUNDLE_DUPLICATED_AUDIT,
    targetType: BUNDLE_AUDIT_TARGET,
    sourceId: bundleId,
    copyId: result.bundle.id,
    slug,
  });

  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

export async function duplicateLearnerSubscriptionPlan(
  tx: TenantTx,
  ctx: ServiceCtx,
  planId: string,
  rawBody: unknown,
) {
  const body = duplicateLearnerProductBodySchema.parse(rawBody);
  const source = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!source) throw learnerSubscriptionPlanNotFound();

  const slug =
    body.slug ??
    (await learnerProductsRepository.nextAvailableSlug(
      tx,
      "learner_subscription_plans",
      source.plan.slug,
    ));
  if (await learnerProductsRepository.slugExists(tx, "learner_subscription_plans", slug)) {
    throw duplicateLearnerProductSlug("Learner subscription plan");
  }

  const result = await learnerProductsRepository.insertLearnerSubscriptionPlan(tx, {
    slug,
    title: copyTitle(source.plan.title, body.title),
    ...(source.plan.description !== null ? { description: source.plan.description } : {}),
    billingInterval: source.plan.billing_interval,
    status: "DRAFT",
    createdByMembershipId: ctx.actorMembershipId,
    items: source.items.map((item, index) => ({
      itemKind: item.item_kind as (typeof SUBSCRIPTION_ITEM_KINDS)[number],
      refId: item.ref_id,
      position: index,
    })),
  });

  await auditDuplicate(tx, ctx, {
    action: SUBSCRIPTION_PLAN_DUPLICATED_AUDIT,
    targetType: SUBSCRIPTION_PLAN_AUDIT_TARGET,
    sourceId: planId,
    copyId: result.plan.id,
    slug,
  });

  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items, await resolveTitlesFor(tx, result.items)),
  });
}

/**
 * Slug availability for the create form.
 *
 * A read, so it is checked as the operator types rather than only on submit —
 * discovering a clash after filling in a whole product is the version of this
 * that wastes their time.
 */
export async function checkLearnerProductSlug(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = learnerProductSlugCheckQuerySchema.parse(rawQuery);
  const conflict = await learnerProductsRepository.findProductBySlug(
    tx,
    PRODUCT_KIND_TABLES[query.productKind].table,
    query.slug,
  );

  return learnerProductSlugCheckResponseSchema.parse({
    data: {
      slug: query.slug,
      available: conflict === null,
      conflict,
    },
  });
}

/** Which enrolment table each product kind writes to. */
const ENROLLMENT_TABLES: Record<(typeof LEARNER_PRODUCT_KINDS)[number], EnrollmentTable> = {
  mock_test: "mock_test_enrollments",
  test_series: "test_series_enrollments",
  bundle: "bundle_enrollments",
  subscription_plan: "learner_subscription_enrollments",
};

const ENROLLMENT_ACTION_AUDIT: Record<string, string> = {
  set_expiry: ENROLLMENT_EXPIRY_CHANGED_AUDIT,
  revoke: ENROLLMENT_REVOKED_AUDIT,
  restore: ENROLLMENT_RESTORED_AUDIT,
};

/**
 * Change a set of a product's enrolments in one transaction.
 *
 * The roster screen acts on a selection, so this is batched for the same reason
 * the publish bar is: twenty-five rows move together or not at all. Ids that no
 * longer belong to this product come back as `missingIds` rather than failing
 * the batch — a row revoked by a colleague while the page sat open should not
 * cost the operator the other twenty-four.
 *
 * Revoking sets `status` instead of deleting: the row is the record that access
 * was granted, and the audit entry pointing at it would dangle without it.
 */
export async function updateProductEnrollments(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = productEnrollmentActionBodySchema.parse(rawBody);
  const table = ENROLLMENT_TABLES[body.productKind];

  // Resolving the product first gives a 404 for a product this tenant cannot
  // see, rather than an empty "nothing matched" that looks like success.
  await assertProductExists(tx, body.productKind, body.productId);

  const requestedIds = [...new Set(body.enrollmentIds)];
  const change =
    body.action === "set_expiry"
      ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
      : { status: body.action === "revoke" ? "revoked" : "active" };

  const updatedIds = await learnerProductsRepository.updateProductEnrollments(
    tx,
    table,
    body.productId,
    requestedIds,
    change,
  );

  const updated = new Set(updatedIds);
  const missingIds = requestedIds.filter((id) => !updated.has(id));

  for (const enrollmentId of updatedIds) {
    await auditWriter.write(tx, auditActor(ctx), {
      action: ENROLLMENT_ACTION_AUDIT[body.action] ?? ENROLLMENT_EXPIRY_CHANGED_AUDIT,
      target: { type: ENROLLMENT_AUDIT_TARGET, id: enrollmentId },
      before: null,
      after:
        body.action === "set_expiry"
          ? { expiresAt: body.expiresAt ?? null }
          : { status: body.action === "revoke" ? "revoked" : "active" },
      metadata: { productKind: body.productKind, productId: body.productId },
    });
  }

  return productEnrollmentActionResponseSchema.parse({ data: { updatedIds, missingIds } });
}

/** Throws the right not-found error for whichever kind was named. */
async function assertProductExists(
  tx: TenantTx,
  kind: (typeof LEARNER_PRODUCT_KINDS)[number],
  productId: string,
): Promise<void> {
  if (kind === "mock_test") {
    if (!(await learnerProductsRepository.findMockTestById(tx, productId)))
      throw mockTestNotFound();
    return;
  }
  if (kind === "test_series") {
    if (!(await learnerProductsRepository.findTestSeriesById(tx, productId))) {
      throw testSeriesNotFound();
    }
    return;
  }
  if (kind === "bundle") {
    if (!(await learnerProductsRepository.findBundleById(tx, productId))) throw bundleNotFound();
    return;
  }
  if (!(await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, productId))) {
    throw learnerSubscriptionPlanNotFound();
  }
}
