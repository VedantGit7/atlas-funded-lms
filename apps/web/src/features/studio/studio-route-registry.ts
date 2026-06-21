export type StudioScreenId =
  | "I1"
  | "I2"
  | "I3"
  | "I4"
  | "I5"
  | "I6"
  | "I7"
  | "I8"
  | "I9"
  | "I10"
  | "I11"
  | "I12"
  | "I13";

export type StudioRouteEntitlement = "analytics.dashboard.view";

export type StudioRouteContract = {
  screenId: StudioScreenId;
  pathPattern: string;
  entitlement?: StudioRouteEntitlement;
};

export const STUDIO_ROUTE_REGISTRY: readonly StudioRouteContract[] = [
  { screenId: "I1", pathPattern: "/studio" },
  { screenId: "I2", pathPattern: "/studio/courses" },
  { screenId: "I3", pathPattern: "/studio/courses/:id" },
  { screenId: "I4", pathPattern: "/studio/courses/:id/lessons/:lessonId" },
  { screenId: "I5", pathPattern: "/studio/items" },
  { screenId: "I6", pathPattern: "/studio/items/:id" },
  { screenId: "I7", pathPattern: "/studio/item-collections" },
  { screenId: "I8", pathPattern: "/studio/assessments" },
  { screenId: "I9", pathPattern: "/studio/learning-paths" },
  { screenId: "I10", pathPattern: "/studio/grading" },
  { screenId: "I11", pathPattern: "/studio/grading/:taskId" },
  { screenId: "I12", pathPattern: "/studio/courses/:id/learners" },
  { screenId: "I13", pathPattern: "/studio/analytics", entitlement: "analytics.dashboard.view" },
] as const;

export function getStudioRouteByScreenId(screenId: StudioScreenId): StudioRouteContract {
  const route = STUDIO_ROUTE_REGISTRY.find((entry) => entry.screenId === screenId);
  if (!route) {
    throw new Error(`Unknown studio screen: ${screenId}`);
  }
  return route;
}

export function listStudioScreenIds(): StudioScreenId[] {
  return STUDIO_ROUTE_REGISTRY.map((entry) => entry.screenId);
}
