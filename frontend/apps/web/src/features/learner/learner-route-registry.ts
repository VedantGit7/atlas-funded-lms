export type LearnerScreenId =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "L6"
  | "L7"
  | "L8"
  | "L9"
  | "L10"
  | "L11"
  | "L12"
  | "L13"
  | "L14"
  | "L15"
  | "L16"
  | "L17"
  | "L18"
  | "L19"
  | "L20"
  | "L21"
  | "L22"
  | "L23"
  | "L24"
  | "L25"
  | "L26"
  | "L27"
  | "L28"
  | "L29"
  | "L30";

export type LearnerRouteEntitlement =
  | "certification.enable"
  | "gamification.enable"
  | "community.enable";

export type LearnerRouteContract = {
  screenId: LearnerScreenId;
  pathPattern: string;
  entitlement?: LearnerRouteEntitlement;
};

export const LEARNER_ROUTE_REGISTRY: readonly LearnerRouteContract[] = [
  { screenId: "L1", pathPattern: "/" },
  { screenId: "L2", pathPattern: "/courses" },
  { screenId: "L3", pathPattern: "/courses/:id" },
  { screenId: "L4", pathPattern: "/courses/:id/lessons/:lessonId" },
  { screenId: "L5", pathPattern: "/roadmap" },
  { screenId: "L6", pathPattern: "/paths/:id" },
  { screenId: "L7", pathPattern: "/assessments/:id" },
  { screenId: "L8", pathPattern: "/attempts/:id" },
  { screenId: "L9", pathPattern: "/attempts/:id/result" },
  { screenId: "L10", pathPattern: "/practice" },
  { screenId: "L11", pathPattern: "/diagnostic/me" },
  { screenId: "L12", pathPattern: "/readiness" },
  { screenId: "L13", pathPattern: "/progress" },
  { screenId: "L14", pathPattern: "/certificates", entitlement: "certification.enable" },
  { screenId: "L15", pathPattern: "/achievements", entitlement: "gamification.enable" },
  { screenId: "L16", pathPattern: "/leaderboards", entitlement: "gamification.enable" },
  { screenId: "L17", pathPattern: "/community", entitlement: "community.enable" },
  { screenId: "L18", pathPattern: "/community/spaces/:id", entitlement: "community.enable" },
  { screenId: "L19", pathPattern: "/community/posts/:id", entitlement: "community.enable" },
  { screenId: "L20", pathPattern: "/hall-of-fame", entitlement: "community.enable" },
  { screenId: "L21", pathPattern: "/resources" },
  { screenId: "L26", pathPattern: "/help" },
  { screenId: "L27", pathPattern: "/help/:slug" },
  { screenId: "L28", pathPattern: "/help/category/:categoryId" },
  { screenId: "L22", pathPattern: "/search" },
  { screenId: "L23", pathPattern: "/notifications" },
  { screenId: "L24", pathPattern: "/profile" },
  { screenId: "L25", pathPattern: "/settings" },
  { screenId: "L29", pathPattern: "/newsfeed" },
  { screenId: "L30", pathPattern: "/newsfeed/:slug" },
] as const;

export function getLearnerRouteByScreenId(screenId: LearnerScreenId): LearnerRouteContract {
  const route = LEARNER_ROUTE_REGISTRY.find((entry) => entry.screenId === screenId);
  if (!route) {
    throw new Error(`Unknown learner screen: ${screenId}`);
  }
  return route;
}

export function listLearnerScreenIds(): LearnerScreenId[] {
  return LEARNER_ROUTE_REGISTRY.map((entry) => entry.screenId);
}
