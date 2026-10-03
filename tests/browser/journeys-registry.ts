/**
 * Maps Frontend Architecture §25.4 required browser journeys to Playwright specs.
 */
export const REQUIRED_BROWSER_JOURNEYS = [
  {
    id: "J01",
    title: "Shell smoke: public landing, diagnostic entry and signup form",
    spec: "journeys/01-public-diagnostic-signup.spec.ts",
  },
  {
    id: "J02",
    title: "Learner enroll → saved resume → keyboard completion → persisted progress",
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
    title: "Shell smoke: authenticated learner swipe page",
    spec: "journeys/04-learner-swipe.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J05",
    title: "Shell smoke: authenticated learner readiness page",
    spec: "journeys/05-learner-readiness-cta.spec.ts",
    requiresAuth: "learner",
  },
  {
    id: "J06",
    title: "Instructor course draft → review → separate reviewer publishes",
    spec: "journeys/06-instructor-authoring.spec.ts",
    requiresAuth: "instructor",
  },
  {
    id: "J07",
    title: "Review queue → return course to draft with persisted note",
    spec: "journeys/07-review-approval.spec.ts",
    requiresAuth: "reviewer",
  },
  {
    id: "J08",
    title: "Shell smoke: moderation queue page",
    spec: "journeys/08-moderation-case.spec.ts",
    requiresAuth: "moderator",
  },
  {
    id: "J09",
    title: "Tenant admin grants and revokes role with persisted assignments",
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
    title: "Cross-tenant read/update/delete/download denial and unchanged foreign records",
    spec: "journeys/11-cross-tenant-negative.spec.ts",
    requiresAuth: "admin",
  },
] as const;
