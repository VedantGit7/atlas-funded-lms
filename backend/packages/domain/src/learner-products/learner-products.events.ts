/**
 * Audit action names for the learner-product catalogue.
 *
 * Every mutation this module exposes is consequential and invisible after the
 * fact from the row alone: a publish changes what every learner can see, and an
 * admin enrolment grants paid access with no payment and no invoice behind it.
 * Without an entry, "who gave this person the bundle for free" has no answer —
 * and all three route families already declared `audit: "required"` while
 * writing nothing, so the declaration was the only record the entry existed.
 *
 * One action per product kind rather than a single generic string, so the audit
 * log can be filtered to "everything that happened to bundles" the same way the
 * rest of the log is filtered.
 */

export const MOCK_TEST_STATUS_CHANGED_AUDIT = "learner_product.mock_test.status_changed" as const;
export const TEST_SERIES_STATUS_CHANGED_AUDIT =
  "learner_product.test_series.status_changed" as const;
export const BUNDLE_STATUS_CHANGED_AUDIT = "learner_product.bundle.status_changed" as const;
export const SUBSCRIPTION_PLAN_STATUS_CHANGED_AUDIT =
  "learner_product.subscription_plan.status_changed" as const;

export const MOCK_TEST_CREATED_AUDIT = "learner_product.mock_test.created" as const;
export const TEST_SERIES_CREATED_AUDIT = "learner_product.test_series.created" as const;
export const BUNDLE_CREATED_AUDIT = "learner_product.bundle.created" as const;
export const SUBSCRIPTION_PLAN_CREATED_AUDIT = "learner_product.subscription_plan.created" as const;

export const MOCK_TEST_ENROLLED_AUDIT = "learner_product.mock_test.enrolled" as const;
export const TEST_SERIES_ENROLLED_AUDIT = "learner_product.test_series.enrolled" as const;
export const BUNDLE_ENROLLED_AUDIT = "learner_product.bundle.enrolled" as const;
export const SUBSCRIPTION_PLAN_ENROLLED_AUDIT =
  "learner_product.subscription_plan.enrolled" as const;

/** Audit `target.type` values, one per catalogue table. */
export const MOCK_TEST_AUDIT_TARGET = "mock_test" as const;
export const TEST_SERIES_AUDIT_TARGET = "test_series" as const;
export const BUNDLE_AUDIT_TARGET = "bundle" as const;
export const SUBSCRIPTION_PLAN_AUDIT_TARGET = "learner_subscription_plan" as const;

export const MOCK_TEST_CONTENTS_UPDATED_AUDIT =
  "learner_product.mock_test.contents_updated" as const;
export const TEST_SERIES_CONTENTS_UPDATED_AUDIT =
  "learner_product.test_series.contents_updated" as const;
export const BUNDLE_CONTENTS_UPDATED_AUDIT = "learner_product.bundle.contents_updated" as const;
export const SUBSCRIPTION_PLAN_CONTENTS_UPDATED_AUDIT =
  "learner_product.subscription_plan.contents_updated" as const;

export const MOCK_TEST_DUPLICATED_AUDIT = "learner_product.mock_test.duplicated" as const;
export const TEST_SERIES_DUPLICATED_AUDIT = "learner_product.test_series.duplicated" as const;
export const BUNDLE_DUPLICATED_AUDIT = "learner_product.bundle.duplicated" as const;
export const SUBSCRIPTION_PLAN_DUPLICATED_AUDIT =
  "learner_product.subscription_plan.duplicated" as const;

/**
 * Enrolment lifecycle after the initial grant.
 *
 * Separate from `*.enrolled` because the questions differ: that one answers
 * "who let them in", these answer "who changed the terms afterwards" and "who
 * took it away".
 */
export const ENROLLMENT_EXPIRY_CHANGED_AUDIT = "learner_product.enrollment.expiry_changed" as const;
export const ENROLLMENT_REVOKED_AUDIT = "learner_product.enrollment.revoked" as const;
export const ENROLLMENT_RESTORED_AUDIT = "learner_product.enrollment.restored" as const;
export const ENROLLMENT_AUDIT_TARGET = "product_enrollment" as const;
