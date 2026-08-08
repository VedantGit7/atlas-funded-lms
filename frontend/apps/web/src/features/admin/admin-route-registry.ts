export type AdminScreenId =
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6"
  | "T7"
  | "T8"
  | "T9"
  | "T10"
  | "T11"
  | "T12"
  | "T13"
  | "T14"
  | "T15"
  | "T16"
  | "T17"
  | "T18"
  | "T19"
  | "T20"
  | "T21"
  | "T22"
  | "T23"
  | "T24"
  | "T25"
  | "T26"
  | "T27"
  | "T28"
  | "T29"
  | "T30"
  | "T31"
  | "T32"
  | "T33"
  | "T34"
  | "T35"
  | "T36"
  | "T37"
  | "T38"
  | "T39"
  | "T40"
  | "T41"
  | "T42"
  | "T43"
  | "T44"
  | "T45"
  | "T46"
  | "T47"
  | "T48"
  | "T49"
  | "T50"
  | "T51"
  | "T52"
  | "T53"
  | "T54"
  | "T55"
  | "T56"
  | "T57"
  | "T58"
  | "T59"
  | "T60"
  | "T61"
  | "T62"
  | "T63"
  | "T64"
  | "T65"
  | "T66"
  | "T67"
  | "T68"
  | "T69"
  | "T70"
  | "T71"
  | "T72"
  | "T73"
  | "T74"
  | "T75"
  | "T76"
  | "T77"
  | "T78"
  | "T79"
  | "T80"
  | "T81"
  | "T82"
  | "T83"
  | "T84"
  | "T85"
  | "T86"
  | "T87"
  | "T88"
  | "T89"
  | "T90"
  | "T91"
  | "T92"
  | "T93"
  | "T94"
  | "T95"
  | "T96"
  | "T97"
  | "T98"
  | "T99"
  | "T100";

export type AdminRouteEntitlement =
  | "branding.custom_domain.enable"
  | "certification.enable"
  | "gamification.enable"
  | "analytics.dashboard.view"
  | "data.export.enable";

export type AdminRouteContract = {
  screenId: AdminScreenId;
  pathPattern: string;
  entitlement?: AdminRouteEntitlement;
};

export const ADMIN_ROUTE_REGISTRY: readonly AdminRouteContract[] = [
  { screenId: "T1", pathPattern: "/admin" },
  { screenId: "T2", pathPattern: "/admin/members" },
  { screenId: "T3", pathPattern: "/admin/members/:id" },
  { screenId: "T4", pathPattern: "/admin/roles" },
  { screenId: "T5", pathPattern: "/admin/roles/:id" },
  { screenId: "T6", pathPattern: "/admin/branding" },
  { screenId: "T7", pathPattern: "/admin/domains", entitlement: "branding.custom_domain.enable" },
  { screenId: "T8", pathPattern: "/admin/config" },
  { screenId: "T9", pathPattern: "/admin/feature-flags" },
  { screenId: "T10", pathPattern: "/admin/entitlements" },
  { screenId: "T11", pathPattern: "/admin/competency" },
  {
    screenId: "T12",
    pathPattern: "/admin/certificates/templates",
    entitlement: "certification.enable",
  },
  { screenId: "T13", pathPattern: "/admin/certificates", entitlement: "certification.enable" },
  { screenId: "T14", pathPattern: "/admin/gamification", entitlement: "gamification.enable" },
  { screenId: "T15", pathPattern: "/admin/notifications/templates" },
  { screenId: "T16", pathPattern: "/admin/automation" },
  { screenId: "T17", pathPattern: "/admin/workflows" },
  { screenId: "T18", pathPattern: "/admin/locales" },
  { screenId: "T19", pathPattern: "/admin/extensions" },
  { screenId: "T20", pathPattern: "/admin/readiness-policy" },
  { screenId: "T21", pathPattern: "/admin/analytics", entitlement: "analytics.dashboard.view" },
  { screenId: "T22", pathPattern: "/admin/audit" },
  { screenId: "T23", pathPattern: "/admin/exports", entitlement: "data.export.enable" },
  { screenId: "T24", pathPattern: "/admin/deletion-requests" },
  { screenId: "T25", pathPattern: "/admin/review" },
  { screenId: "T26", pathPattern: "/admin/notifications" },
  { screenId: "T27", pathPattern: "/admin/settings" },
  { screenId: "T28", pathPattern: "/admin/billing" },
  { screenId: "T29", pathPattern: "/admin/timezones" },
  { screenId: "T30", pathPattern: "/admin/video-quality" },
  { screenId: "T31", pathPattern: "/admin/seo" },
  { screenId: "T32", pathPattern: "/admin/learner-billing/pricing-model" },
  { screenId: "T33", pathPattern: "/admin/learner-billing/home-currency" },
  { screenId: "T34", pathPattern: "/admin/learner-billing/payment-gateway" },
  { screenId: "T35", pathPattern: "/admin/learner-billing/gst" },
  { screenId: "T36", pathPattern: "/admin/learner-billing/learner-config" },
  { screenId: "T37", pathPattern: "/admin/learner-billing/invoice-config" },
  { screenId: "T38", pathPattern: "/admin/learner-billing/locations" },
  { screenId: "T39", pathPattern: "/admin/fast-checkout" },
  { screenId: "T40", pathPattern: "/admin/security/learner-email-verification" },
  { screenId: "T41", pathPattern: "/admin/security/admin-otp" },
  { screenId: "T42", pathPattern: "/admin/security/device-monitor" },
  { screenId: "T43", pathPattern: "/admin/channels/transactional-email" },
  { screenId: "T44", pathPattern: "/admin/channels/marketing-email" },
  { screenId: "T45", pathPattern: "/admin/channels/support-email" },
  { screenId: "T46", pathPattern: "/admin/trash" },
  { screenId: "T47", pathPattern: "/admin/trash/activity" },
  { screenId: "T48", pathPattern: "/admin/reports" },
  { screenId: "T49", pathPattern: "/admin/insights" },
  { screenId: "T50", pathPattern: "/admin/reports/:slug" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/:pollId" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/:pollId/live" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/compare" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/exports" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/live-sessions" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/live-sessions/:liveSessionId" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/:pollId/options/:optionId" },
  { screenId: "T50", pathPattern: "/admin/reports/polls/:pollId/non-respondents" },
  { screenId: "T50", pathPattern: "/admin/reports/batches/:batchId" },
  { screenId: "T51", pathPattern: "/admin/insights/:slug" },
  { screenId: "T52", pathPattern: "/admin/batches" },
  { screenId: "T53", pathPattern: "/admin/polls" },
  { screenId: "T54", pathPattern: "/admin/live-sessions" },
  { screenId: "T55", pathPattern: "/admin/custom-fields" },
  { screenId: "T56", pathPattern: "/admin/messenger" },
  { screenId: "T57", pathPattern: "/admin/devices" },
  { screenId: "T58", pathPattern: "/admin/manage" },
  { screenId: "T59", pathPattern: "/admin/sub-schools" },
  { screenId: "T60", pathPattern: "/admin/manage/:slug" },
  { screenId: "T61", pathPattern: "/admin/sub-schools/:id" },
  { screenId: "T62", pathPattern: "/admin/sub-schools/:id/copy-product" },
  { screenId: "T63", pathPattern: "/admin/sub-schools/:id/copy-product/course" },
  { screenId: "T64", pathPattern: "/admin/sub-schools/:id/copy-product/mock-test" },
  { screenId: "T65", pathPattern: "/admin/sub-schools/:id/copy-product/test-series" },
  { screenId: "T66", pathPattern: "/admin/marketing" },
  { screenId: "T67", pathPattern: "/admin/sales" },
  { screenId: "T68", pathPattern: "/admin/marketing/:slug" },
  { screenId: "T69", pathPattern: "/admin/sales/:slug" },
  { screenId: "T70", pathPattern: "/admin/marketing/messenger/push" },
  { screenId: "T71", pathPattern: "/admin/marketing/messenger/push/create" },
  { screenId: "T72", pathPattern: "/admin/marketing/messenger/push/:id" },
  { screenId: "T73", pathPattern: "/admin/marketing/messenger/email" },
  { screenId: "T74", pathPattern: "/admin/marketing/messenger/email/create" },
  { screenId: "T75", pathPattern: "/admin/marketing/messenger/email/:id" },
  { screenId: "T76", pathPattern: "/admin/marketing/messenger/system-email" },
  { screenId: "T77", pathPattern: "/admin/marketing/messenger/system-email/:key" },
  { screenId: "T78", pathPattern: "/admin/marketing/messenger/announcements" },
  { screenId: "T79", pathPattern: "/admin/marketing/messenger/announcements/create" },
  { screenId: "T80", pathPattern: "/admin/marketing/messenger/whatsapp" },
  { screenId: "T81", pathPattern: "/admin/marketing/messenger/whatsapp/create" },
  { screenId: "T82", pathPattern: "/admin/marketing/messenger/whatsapp/:id" },
  { screenId: "T83", pathPattern: "/admin/marketing/messenger/whatsapp/templates" },
  { screenId: "T84", pathPattern: "/admin/marketing/messenger/whatsapp/inbox" },
  { screenId: "T85", pathPattern: "/admin/marketing/workflows/create" },
  { screenId: "T86", pathPattern: "/admin/marketing/workflows/:id" },
  { screenId: "T87", pathPattern: "/admin/marketing/forms/create" },
  { screenId: "T88", pathPattern: "/admin/marketing/forms/:id" },
  { screenId: "T89", pathPattern: "/admin/marketing/forms/:id/submissions" },
  { screenId: "T90", pathPattern: "/admin/marketing/forms/contacts" },
  { screenId: "T91", pathPattern: "/admin/marketing/cta/create" },
  { screenId: "T92", pathPattern: "/admin/marketing/cta/:id" },
  { screenId: "T93", pathPattern: "/admin/marketing/promo-slider/create" },
  { screenId: "T94", pathPattern: "/admin/marketing/promo-slider/:id" },
  { screenId: "T95", pathPattern: "/admin/marketing/events/create" },
  { screenId: "T96", pathPattern: "/admin/marketing/events/:id" },
  { screenId: "T97", pathPattern: "/admin/marketing/newsfeed/create" },
  { screenId: "T98", pathPattern: "/admin/marketing/newsfeed/:id" },
  { screenId: "T99", pathPattern: "/admin/sales/coupons/create" },
  { screenId: "T100", pathPattern: "/admin/sales/coupons/:id" },
] as const;

/** Approved reuse paths — not duplicate admin routes. */
export const ADMIN_REUSE_ROUTE_REGISTRY = [
  { label: "Studio courses", pathPattern: "/studio/courses", screenRef: "I2" },
  { label: "Moderation queue", pathPattern: "/admin/moderation/cases", screenRef: "M1" },
  { label: "Appeals review", pathPattern: "/admin/moderation/appeals", screenRef: "M3" },
  { label: "Review & approvals", pathPattern: "/admin/review", screenRef: "S1" },
] as const;

export const FORBIDDEN_ADMIN_DUPLICATE_ROUTES = [
  "/admin/courses",
  "/admin/assessments",
  "/admin/learning-paths",
] as const;

export function getAdminRouteByScreenId(screenId: AdminScreenId): AdminRouteContract {
  const route = ADMIN_ROUTE_REGISTRY.find((entry) => entry.screenId === screenId);
  if (!route) {
    throw new Error(`Unknown admin screen: ${screenId}`);
  }
  return route;
}

export function listAdminScreenIds(): AdminScreenId[] {
  return ADMIN_ROUTE_REGISTRY.map((entry) => entry.screenId);
}
