import { clientApi } from "../../../lib/client-api";

/**
 * Admin client for the learner-product catalogue.
 *
 * Mock tests, test series, bundles and subscription plans shipped with full
 * backend support — list, create and enrol — and no UI at all, so a tenant could
 * not see what was in its own catalogue, let alone put a learner into one.
 * Enrolment here is the admin-side `enrollment.manage` action (placing someone
 * into a product), not learner self-service purchase.
 */

export const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export type PublishStatus = string;

export type ProductListPageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type BaseProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
};

export type MockTest = BaseProduct & { assessmentId: string };
export type TestSeries = BaseProduct & { items: Array<{ id: string; position: number }> };
export type Bundle = BaseProduct & { items: Array<{ id: string; position: number }> };
export type SubscriptionPlan = BaseProduct & {
  billingInterval: string;
  items: Array<{ id: string; position: number }>;
};

export type ProductEnrollment = {
  id: string;
  membershipId: string;
  status: string;
  enrolledType: string;
  enrolledAt: string;
  expiresAt: string | null;
};

type ListResponse<T> = { data: { items: T[]; pageInfo: ProductListPageInfo } };

export const PRODUCT_PAGE_SIZE = 25;

function listQuery(filters: { q?: string; status?: string; page?: number }): string {
  const params = new URLSearchParams({
    limit: String(PRODUCT_PAGE_SIZE),
    page: String(filters.page ?? 1),
  });
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

export async function fetchMockTests(filters: { q?: string; status?: string; page?: number } = {}) {
  return clientApi.get<ListResponse<MockTest>>(`/api/v1/mock-tests?${listQuery(filters)}`);
}

export async function fetchTestSeries(
  filters: { q?: string; status?: string; page?: number } = {},
) {
  return clientApi.get<ListResponse<TestSeries>>(`/api/v1/test-series?${listQuery(filters)}`);
}

export async function fetchBundles(filters: { q?: string; status?: string; page?: number } = {}) {
  return clientApi.get<ListResponse<Bundle>>(`/api/v1/bundles?${listQuery(filters)}`);
}

export async function fetchSubscriptionPlans(
  filters: { q?: string; status?: string; page?: number } = {},
) {
  return clientApi.get<ListResponse<SubscriptionPlan>>(
    `/api/v1/learner-subscription-plans?${listQuery(filters)}`,
  );
}

export const LEARNER_PRODUCT_KINDS = [
  "mock_test",
  "test_series",
  "bundle",
  "subscription_plan",
] as const;

export type LearnerProductKind = (typeof LEARNER_PRODUCT_KINDS)[number];

export type LearnerProductStatusResult = {
  data: {
    updated: Array<{ id: string; slug: string; previousStatus: string; status: string }>;
    /** Ids the tenant can no longer see — deleted or archived while the page sat open. */
    missingIds: string[];
  };
};

/**
 * Publish-state transitions for the current selection.
 *
 * One request for the whole selection, so a bulk publish is one transaction
 * that either happens or does not; a single-row menu action is a set of one.
 * `silent` because the page reports the batch result itself, in terms of how
 * many rows moved, which a per-request toast cannot say.
 *
 * The idempotency key is deliberately fresh per call rather than derived from
 * the selection: a stable key would make a later, intentional re-publish of the
 * same rows replay the first response without touching the database, leaving
 * the screen claiming a transition that never happened. Double-submit is
 * prevented at the button instead.
 */
export async function updateLearnerProductStatuses(
  productKind: LearnerProductKind,
  productIds: string[],
  status: string,
) {
  return clientApi.post<LearnerProductStatusResult>(
    "/api/v1/learner-products/status",
    { productKind, productIds, status },
    `learner-product-status-${productKind}`,
    { silent: true },
  );
}

export type ProductItem = {
  id: string;
  position: number;
  itemKind?: string;
  /** Present on bundle and plan items; test series items point via mockTestId. */
  refId?: string;
  /** Resolved server-side; null means the referenced product no longer exists. */
  title?: string | null;
  mockTestId?: string | null;
  assessmentId?: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  assessmentId?: string;
  billingInterval?: string;
  items?: ProductItem[];
};

export type ProductEnrollmentListItem = {
  id: string;
  membershipId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  enrolledType: string;
  enrolledAt: string;
  expiresAt: string | null;
  completedAt: string | null;
};

/**
 * Per-kind endpoint builders.
 *
 * The collection name is written out in each template rather than interpolated
 * from a lookup table. `ci:frontend-api-closure --strict` proves every backend
 * route has a caller by scanning source for path literals, and a path whose
 * first segment is an interpolation carries no evidence of which route it hits —
 * table-driven URLs read to the gate as four unwired routes.
 */
const PRODUCT_ENDPOINTS = {
  "mock-tests": {
    detail: (id: string) => `/api/v1/mock-tests/${id}`,
    enrollments: (id: string) => `/api/v1/mock-tests/${id}/enrollments`,
  },
  "test-series": {
    detail: (id: string) => `/api/v1/test-series/${id}`,
    enrollments: (id: string) => `/api/v1/test-series/${id}/enrollments`,
  },
  bundles: {
    detail: (id: string) => `/api/v1/bundles/${id}`,
    enrollments: (id: string) => `/api/v1/bundles/${id}/enrollments`,
  },
  "subscription-plans": {
    detail: (id: string) => `/api/v1/learner-subscription-plans/${id}`,
    enrollments: (id: string) => `/api/v1/learner-subscription-plans/${id}/enrollments`,
  },
} as const;

export type ProductTypeSlug = keyof typeof PRODUCT_ENDPOINTS;

export function isProductTypeSlug(value: string): value is ProductTypeSlug {
  return Object.hasOwn(PRODUCT_ENDPOINTS, value);
}

export async function fetchProductDetail(type: ProductTypeSlug, productId: string) {
  return clientApi.get<{ data: ProductDetail }>(
    PRODUCT_ENDPOINTS[type].detail(encodeURIComponent(productId)),
  );
}

export async function fetchProductEnrollments(type: ProductTypeSlug, productId: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: String(PRODUCT_PAGE_SIZE) });
  return clientApi.get<{
    data: { items: ProductEnrollmentListItem[]; pageInfo: ProductListPageInfo };
  }>(`${PRODUCT_ENDPOINTS[type].enrollments(encodeURIComponent(productId))}?${params.toString()}`);
}

/**
 * Places a learner into a product.
 *
 * One function for all four kinds, replacing `enrollInMockTest`,
 * `enrollInTestSeries`, `enrollInBundle` and `enrollInSubscriptionPlan`, which
 * differed only in the collection name.
 */
export async function enrollInProduct(
  type: ProductTypeSlug,
  productId: string,
  body: { membershipId: string; enrolledType?: string; expiresAt?: string },
) {
  return clientApi.post<{ data: ProductEnrollment }>(
    PRODUCT_ENDPOINTS[type].enrollments(encodeURIComponent(productId)),
    body,
    `product-enroll-${type}-${productId}`,
  );
}

export type LearnerSearchResult = {
  membershipId: string;
  displayName: string | null;
  email: string | null;
};

/**
 * Learner lookup for the enrolment drawer.
 *
 * The enrolment form used to demand a raw membership UUID, which an operator
 * had to go and find in another screen. `ACTIVE` only: enrolling a removed or
 * pending membership creates a grant nobody can use.
 */
export async function searchLearners(term: string): Promise<LearnerSearchResult[]> {
  const params = new URLSearchParams({ search: term.trim(), limit: "8", status: "ACTIVE" });
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        invitedEmail?: string | null;
        accountEmail?: string | null;
        profile: { displayName: string | null } | null;
      }>;
    };
  }>(`/api/v1/members?${params.toString()}`);

  return response.data.items.map((member) => ({
    membershipId: member.id,
    displayName: member.profile?.displayName ?? null,
    email: member.accountEmail ?? member.invitedEmail ?? null,
  }));
}

export type BundleContentRef = { itemKind: string; refId: string };
export type TestSeriesContentRef = { title?: string; mockTestId?: string; assessmentId?: string };

/**
 * Replace a product's contents.
 *
 * The array order is the order learners receive; the server derives position
 * from the index, so the editor never sends one.
 */
export async function replaceProductContents(
  type: ProductTypeSlug,
  productId: string,
  body:
    | { items: BundleContentRef[]; expectedUpdatedAt?: string }
    | { items: TestSeriesContentRef[]; expectedUpdatedAt?: string }
    | { assessmentId: string; expectedUpdatedAt?: string },
) {
  const id = encodeURIComponent(productId);
  const path =
    type === "mock-tests"
      ? `/api/v1/mock-tests/${id}/contents`
      : type === "test-series"
        ? `/api/v1/test-series/${id}/contents`
        : type === "bundles"
          ? `/api/v1/bundles/${id}/contents`
          : `/api/v1/learner-subscription-plans/${id}/contents`;

  return clientApi.put<{ data: ProductDetail }>(path, body, `product-contents-${type}`, {
    successMessage: "Contents updated.",
  });
}

/** Clone a product. The copy is always a DRAFT, whatever the source's state. */
export async function duplicateProduct(type: ProductTypeSlug, productId: string) {
  const id = encodeURIComponent(productId);
  const path =
    type === "mock-tests"
      ? `/api/v1/mock-tests/${id}/duplicate`
      : type === "test-series"
        ? `/api/v1/test-series/${id}/duplicate`
        : type === "bundles"
          ? `/api/v1/bundles/${id}/duplicate`
          : `/api/v1/learner-subscription-plans/${id}/duplicate`;

  return clientApi.post<{ data: ProductDetail }>(path, {}, `product-duplicate-${type}`, {
    silent: true,
  });
}

export type PickerCandidate = { id: string; title: string; subtitle: string | null };

type PickerSourceKind = "course" | "mock_test" | "test_series" | "bundle" | "assessment";

/**
 * Search the catalogue for something to put inside a product.
 *
 * Reuses the list endpoints each kind already publishes rather than adding a
 * bespoke picker search: they are the same rows, already permission-gated and
 * already tenant-scoped.
 */
export async function searchPickerCandidates(
  kind: PickerSourceKind,
  term: string,
): Promise<PickerCandidate[]> {
  const trimmed = term.trim();
  const query = new URLSearchParams({ limit: "10" });
  if (trimmed) query.set("q", trimmed);

  if (kind === "course") {
    const response = await clientApi.get<{
      data: { items: Array<{ id: string; title: string; slug: string }> };
    }>(`/api/v1/courses?${query.toString()}`);
    return response.data.items.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.slug,
    }));
  }

  if (kind === "assessment") {
    const response = await clientApi.get<{
      data: Array<{ id: string; title: string; slug: string }>;
    }>(`/api/v1/assessments?${query.toString()}`);
    return response.data.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.slug,
    }));
  }

  const listPath =
    kind === "mock_test"
      ? `/api/v1/mock-tests?${query.toString()}`
      : kind === "test_series"
        ? `/api/v1/test-series?${query.toString()}`
        : `/api/v1/bundles?${query.toString()}`;

  const response = await clientApi.get<{
    data: { items: Array<{ id: string; title: string; slug: string }> };
  }>(listPath);
  return response.data.items.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.slug,
  }));
}

export type SlugCheckResult = {
  data: { slug: string; available: boolean; conflict: { id: string; title: string } | null };
};

/**
 * Is this slug free for this product kind?
 *
 * Checked as the operator types rather than only on submit: discovering a clash
 * after filling in a whole product is the version of this that wastes an
 * afternoon. The conflicting product comes back named so the form can link to
 * it.
 */
export async function checkProductSlug(productKind: LearnerProductKind, slug: string) {
  const params = new URLSearchParams({ productKind, slug });
  return clientApi.get<SlugCheckResult>(`/api/v1/learner-products/slug-check?${params.toString()}`);
}

export type CreateProductBody = {
  slug: string;
  title: string;
  description?: string;
  status: string;
  assessmentId?: string;
  billingInterval?: string;
  items?: Array<{ itemKind?: string; refId?: string; mockTestId?: string; position: number }>;
};

/**
 * Create a product.
 *
 * The four collections take the same shape apart from the item list, and the
 * path is written out per kind so the closure gate can see which route each
 * call hits.
 */
export async function createProduct(type: ProductTypeSlug, body: CreateProductBody) {
  const path =
    type === "mock-tests"
      ? "/api/v1/mock-tests"
      : type === "test-series"
        ? "/api/v1/test-series"
        : type === "bundles"
          ? "/api/v1/bundles"
          : "/api/v1/learner-subscription-plans";

  return clientApi.post<{ data: ProductDetail }>(path, body, `product-create-${type}`, {
    silent: true,
  });
}

/**
 * Title to slug.
 *
 * Mirrors what the operator would type by hand, and stays inside the 128
 * characters the API accepts so a long title cannot produce an invalid slug.
 */
export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);
}

export type EnrollmentFilters = {
  page?: number;
  q?: string;
  status?: string;
  enrolledType?: string;
  enrolledFrom?: string;
  enrolledTo?: string;
};

/**
 * A product's enrolment roster, filtered.
 *
 * Separate from `fetchProductEnrollments` (the detail page's unfiltered
 * preview) only in the query it builds; both hit the same endpoint.
 */
export async function fetchProductEnrollmentPage(
  type: ProductTypeSlug,
  productId: string,
  filters: EnrollmentFilters,
  limit = PRODUCT_PAGE_SIZE,
) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    limit: String(limit),
  });
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.enrolledType) params.set("enrolledType", filters.enrolledType);
  if (filters.enrolledFrom) params.set("enrolledFrom", filters.enrolledFrom);
  if (filters.enrolledTo) params.set("enrolledTo", filters.enrolledTo);

  return clientApi.get<{
    data: { items: ProductEnrollmentListItem[]; pageInfo: ProductListPageInfo };
  }>(`${PRODUCT_ENDPOINTS[type].enrollments(encodeURIComponent(productId))}?${params.toString()}`);
}

export type EnrollmentAction = "set_expiry" | "revoke" | "restore";

export type EnrollmentActionResult = {
  data: { updatedIds: string[]; missingIds: string[] };
};

/**
 * Change expiry, revoke, or restore a selection of enrolments.
 *
 * `silent` because the page reports the batch outcome in terms of how many rows
 * moved, which a per-request toast cannot say.
 */
export async function updateProductEnrollments(args: {
  productKind: LearnerProductKind;
  productId: string;
  enrollmentIds: string[];
  action: EnrollmentAction;
  expiresAt?: string | null;
}) {
  return clientApi.post<EnrollmentActionResult>(
    "/api/v1/learner-products/enrollments",
    {
      productKind: args.productKind,
      productId: args.productId,
      enrollmentIds: args.enrollmentIds,
      action: args.action,
      ...(args.action === "set_expiry" ? { expiresAt: args.expiresAt ?? null } : {}),
    },
    `enrollment-action-${args.action}`,
    { silent: true },
  );
}
