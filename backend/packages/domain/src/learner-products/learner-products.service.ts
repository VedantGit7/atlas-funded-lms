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
  type BUNDLE_ITEM_KINDS,
  type SUBSCRIPTION_ITEM_KINDS,
} from "./learner-products.dto";
import {
  bundleNotFound,
  duplicateLearnerProductSlug,
  learnerSubscriptionPlanNotFound,
  mockTestNotFound,
  testSeriesNotFound,
} from "./learner-products.errors";
import {
  learnerProductPageInfo,
  learnerProductsRepository,
  type BundleItemRow,
  type BundleRow,
  type LearnerSubscriptionPlanItemRow,
  type LearnerSubscriptionPlanRow,
  type MockTestRow,
  type ProductEnrollmentRow,
  type TestSeriesItemRow,
  type TestSeriesRow,
} from "./learner-products.repository";

function parseExpiresAt(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
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

function toBundleDto(bundle: BundleRow, items: BundleItemRow[]) {
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
    })),
    createdAt: bundle.created_at.toISOString(),
    updatedAt: bundle.updated_at.toISOString(),
  };
}

function toPlanDto(plan: LearnerSubscriptionPlanRow, items: LearnerSubscriptionPlanItemRow[]) {
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
  _ctx: ServiceCtx,
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
  _ctx: ServiceCtx,
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

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}

export async function createBundle(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createBundleBodySchema.parse(rawBody);
  if (await learnerProductsRepository.slugExists(tx, "bundles", body.slug)) {
    throw duplicateLearnerProductSlug("Bundle");
  }

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

  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items),
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

  return bundleListResponseSchema.parse({
    data: {
      items: items.map(({ bundle, items: bundleItems }) => toBundleDto(bundle, bundleItems)),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getBundle(tx: TenantTx, _ctx: ServiceCtx, bundleId: string) {
  const result = await learnerProductsRepository.findBundleById(tx, bundleId);
  if (!result) throw bundleNotFound();
  return bundleResponseSchema.parse({
    data: toBundleDto(result.bundle, result.items),
  });
}

export async function enrollBundle(
  tx: TenantTx,
  _ctx: ServiceCtx,
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

  await fanOutBundleItems(
    tx,
    product.items,
    body.membershipId,
    body.enrolledType,
    expiresAt,
  );

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

  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items),
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

  return learnerSubscriptionPlanListResponseSchema.parse({
    data: {
      items: items.map(({ plan, items: planItems }) => toPlanDto(plan, planItems)),
      pageInfo: learnerProductPageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function getLearnerSubscriptionPlan(
  tx: TenantTx,
  _ctx: ServiceCtx,
  planId: string,
) {
  const result = await learnerProductsRepository.findLearnerSubscriptionPlanById(tx, planId);
  if (!result) throw learnerSubscriptionPlanNotFound();
  return learnerSubscriptionPlanResponseSchema.parse({
    data: toPlanDto(result.plan, result.items),
  });
}

export async function enrollLearnerSubscriptionPlan(
  tx: TenantTx,
  _ctx: ServiceCtx,
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

  await fanOutSubscriptionItems(
    tx,
    product.items,
    body.membershipId,
    body.enrolledType,
    expiresAt,
  );

  return productEnrollmentResponseSchema.parse({ data: toEnrollmentDto(enrollment) });
}
