/**
 * Which tenant operations require step-up MFA (audit H4).
 *
 * A password alone must not be enough to change who holds power in a tenant,
 * where its money goes, where its data goes, or what code runs for everyone.
 * Routes declare `mfa: "required"` in their metadata (enforced by
 * `assertTenantMfa` against the session's verified assurance, aal2); this file
 * is the policy that `scripts/ci/check-sensitive-route-mfa.ts` holds every
 * route to, so the declaration cannot be forgotten or edited away.
 *
 * Two lists, because permissions here are not uniformly granular:
 *
 * - Narrow permissions that only ever guard sensitive work: every mutating
 *   route that declares one must require MFA, including routes added later.
 * - Specific operations behind coarse permissions. `config.update` guards
 *   payment-gateway credentials and site-wide script injection, but also polls
 *   and custom fields; requiring MFA for the permission would make every
 *   settings change a challenge, so those operations are listed by route.
 *
 * Reads are not challenged unless listed: the boundary is changing state or
 * moving data out in bulk.
 */

export type StepUpCategory = "privilege" | "credentials" | "money" | "bulk-data" | "site-code";

/** Mutations declaring any of these permissions always require MFA. */
export const STEP_UP_MFA_PERMISSIONS: Readonly<Record<string, StepUpCategory>> = {
  // Who holds power: granting, editing or removing roles and access.
  "role.create": "privilege",
  "role.update": "privilege",
  "role.delete": "privilege",
  "role.assign": "privilege",
  "role.revoke": "privilege",
  "permission_override.manage": "privilege",
  // Invitations carry a role, so an invite is a grant.
  "membership.invite": "privilege",
  "membership.suspend": "privilege",
  "membership.remove": "privilege",
  // A tenant domain decides where its sign-in pages and cookies live.
  "tenancy.domain.manage": "credentials",
  // Extensions receive tenant data and run in its flows.
  "extension.registration.manage": "credentials",
  // Subject access exports and erasure.
  "data.export.run": "bulk-data",
  "data.deletion.manage": "bulk-data",
};

export type StepUpOperation = {
  /** Route path under backend/apps/api/src/app, e.g. `/api/v1/domains/[id]`. */
  route: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  category: StepUpCategory;
  reason: string;
};

/** Specific operations behind coarse permissions that require MFA. */
export const STEP_UP_MFA_OPERATIONS: readonly StepUpOperation[] = [
  {
    route: "/api/v1/learner-billing/payment-gateways",
    method: "POST",
    category: "credentials",
    reason: "Adds payment-gateway API keys; decides where learners' payments go.",
  },
  {
    route: "/api/v1/learner-billing/payment-gateways/[id]",
    method: "PUT",
    category: "credentials",
    reason: "Replaces payment-gateway API keys and webhook secrets.",
  },
  {
    route: "/api/v1/learner-billing/payment-gateways/[id]/publish",
    method: "PUT",
    category: "money",
    reason: "Switches which gateway takes live payments.",
  },
  {
    route: "/api/v1/learner-billing/config",
    method: "PUT",
    category: "money",
    reason: "Billing configuration applied to every learner charge.",
  },
  {
    route: "/api/v1/learner-billing/gst",
    method: "PUT",
    category: "money",
    reason: "Tax registration printed on every invoice.",
  },
  {
    route: "/api/v1/learner-billing/home-currency",
    method: "PUT",
    category: "money",
    reason: "Currency every price is charged in.",
  },
  {
    route: "/api/v1/learner-billing/invoice",
    method: "PUT",
    category: "money",
    reason: "Legal seller details on every invoice.",
  },
  {
    route: "/api/v1/learner-billing/learner-config",
    method: "PUT",
    category: "money",
    reason: "Which billing details learners must supply at checkout.",
  },
  {
    route: "/api/v1/payments/orders/export",
    method: "GET",
    category: "bulk-data",
    reason: "Every order with buyer identities and amounts, in one file.",
  },
  {
    route: "/api/v1/marketing/integrations/credentials",
    method: "POST",
    category: "credentials",
    reason: "Stores third-party integration secrets.",
  },
  {
    route: "/api/v1/marketing/integrations/snippets",
    method: "PUT",
    category: "site-code",
    reason: "HTML and script injected into tenant pages (audit H5).",
  },
  {
    route: "/api/v1/marketing/integrations/webhooks",
    method: "POST",
    category: "bulk-data",
    reason: "New outbound destination for learner sign-up and payment events.",
  },
  {
    route: "/api/v1/marketing/integrations/webhooks/[id]",
    method: "PATCH",
    category: "bulk-data",
    reason: "Redirects an outbound learner-event webhook.",
  },
  {
    route: "/api/v1/marketing/integrations/webhooks/[id]",
    method: "DELETE",
    category: "bulk-data",
    reason: "Removes an outbound webhook other systems depend on.",
  },
  {
    route: "/api/v1/marketing/integrations/webhooks/[id]/test",
    method: "POST",
    category: "bulk-data",
    reason: "Sends a sample learner event to the configured outbound URL.",
  },
  {
    route: "/api/v1/reports/exports/destinations",
    method: "POST",
    category: "credentials",
    reason: "New webhook or cloud-storage credentials that scheduled exports are sent to.",
  },
  {
    route: "/api/v1/reports/exports/destinations/[destinationId]",
    method: "PATCH",
    category: "credentials",
    reason: "Redirects where scheduled report exports are delivered.",
  },
  {
    route: "/api/v1/reports/exports/destinations/[destinationId]",
    method: "DELETE",
    category: "credentials",
    reason: "Removes an export destination.",
  },
];

export type StepUpRouteRule = {
  /** Matched against the route path under backend/apps/api/src/app. */
  pattern: RegExp;
  methods: readonly StepUpOperation["method"][];
  category: StepUpCategory;
  reason: string;
};

/**
 * Report exports, by route shape (H4 follow-up). There are dozens of these and
 * every new report adds more, so they are matched by path rather than listed:
 * a new report's export endpoints are covered the day they are written.
 *
 * Report data leaves the tenant three ways, and each is a rule here:
 * producing an export (which can email it to any address or post it to a
 * webhook), retrieving a finished file, and changing where scheduled exports
 * are delivered. Viewing a report on screen is not a rule: `POST
 * /reports/runs` and its status and preview stay open, and the status
 * response carries no download link, so the file itself is only reachable
 * through the download route below.
 */
export const STEP_UP_MFA_ROUTE_RULES: readonly StepUpRouteRule[] = [
  {
    pattern: /^\/api\/v1\/reports\/(?:.+\/)?(?:export|exports|bi-exports)$/,
    methods: ["POST"],
    category: "bulk-data",
    reason: "Produces a report export, which can be emailed to any address or sent to a webhook.",
  },
  {
    pattern: /^\/api\/v1\/reports\/(?:.+\/)?exports\/\[runId\]\/retry$/,
    methods: ["POST"],
    category: "bulk-data",
    reason: "Regenerates and redelivers a report export.",
  },
  {
    pattern: /^\/api\/v1\/reports\/schedules(?:\/\[id\])?$/,
    methods: ["POST", "PATCH"],
    category: "bulk-data",
    reason: "Sets the recipients and webhook that scheduled report runs are delivered to.",
  },
  {
    pattern:
      /^\/api\/v1\/reports\/(?:.+\/)?exports\/schedules\/(?:bulk|\[scheduleId\](?:\/(?:run|duplicate))?)$/,
    methods: ["POST", "PATCH"],
    category: "bulk-data",
    reason: "Starts, copies or redirects a scheduled export delivery.",
  },
  {
    pattern: /^\/api\/v1\/reports\/exports\/destinations\/\[destinationId\]\/test$/,
    methods: ["POST"],
    category: "bulk-data",
    reason: "Sends sample report data to an export destination.",
  },
  {
    pattern:
      /^\/api\/v1\/(?:reports\/runs\/\[runId\]\/download\/\[format\]|reports\/exports\/\[runId\]|reports\/bi-exports\/\[id\]|exports\/\[id\]|sales\/attribution\/export)$/,
    methods: ["GET"],
    category: "bulk-data",
    reason: "Returns an export file, or a signed link to one.",
  },
];

/** True when a route/method falls under a report export rule. */
export function matchesStepUpRouteRule(route: string, method: string): StepUpRouteRule | null {
  return (
    STEP_UP_MFA_ROUTE_RULES.find(
      (rule) => (rule.methods as readonly string[]).includes(method) && rule.pattern.test(route),
    ) ?? null
  );
}
