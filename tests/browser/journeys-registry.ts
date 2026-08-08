/**
 * Maps Frontend Architecture §25.4 required browser journeys to Playwright specs.
 */
export const REQUIRED_BROWSER_JOURNEYS = [
  {
    id: "J01",
    title: "Visitor landing → public diagnostic → identity gate → signup",
    spec: "journeys/01-public-diagnostic-signup.spec.ts",
  },
  {
    id: "J02",
    title: "Learner login → dashboard → enroll → lesson complete → progress",
    spec: "journeys/02-learner-dashboard-enrollment.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J03",
    title: "Learner assessment start → autosave → submit → result",
    spec: "journeys/03-learner-assessment.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J04",
    title: "Learner swipe session → response feedback → completion",
    spec: "journeys/04-learner-swipe.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J05",
    title: "Learner readiness → attributed CTA confirm",
    spec: "journeys/05-learner-readiness-cta.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J06",
    title: "Instructor course/assessment authoring → submit for review",
    spec: "journeys/06-instructor-authoring.spec.ts",
    requiresAuth: "instructor",
  },
  {
    id: "J07",
    title: "Review queue S1 → approve/reject transition",
    spec: "journeys/07-review-approval.spec.ts",
    requiresAuth: "reviewer",
  },
  {
    id: "J08",
    title: "Moderator queue → case decision",
    spec: "journeys/08-moderation-case.spec.ts",
    requiresAuth: "moderator",
  },
  {
    id: "J09",
    title: "Tenant admin member invite/role/config/branding workflows",
    spec: "journeys/09-admin-member-workflows.spec.ts",
    requiresAuth: "admin",
  },
  {
    id: "J10",
    title: "Platform tenant provision → detail → entitlement update with reason",
    spec: "journeys/10-platform-provision-entitlements.spec.ts",
    requiresAuth: "platform",
    platformHost: true,
  },
  {
    id: "J11",
    title: "Cross-tenant negative: Tenant A session cannot see Tenant B resource",
    spec: "journeys/11-cross-tenant-negative.spec.ts",
    requiresAuth: "learner",
  },
] as const;
