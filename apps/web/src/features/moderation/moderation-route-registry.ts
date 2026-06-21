export type ModerationScreenId = "M1" | "M2" | "M3" | "M4";

export type ModerationRouteEntitlement = "community.enable";

export type ModerationRouteContract = {
  screenId: ModerationScreenId;
  pathPattern: string;
  entitlement: ModerationRouteEntitlement;
};

export const MODERATION_ROUTE_REGISTRY: readonly ModerationRouteContract[] = [
  { screenId: "M1", pathPattern: "/moderate/cases", entitlement: "community.enable" },
  { screenId: "M2", pathPattern: "/moderate/cases/:id", entitlement: "community.enable" },
  { screenId: "M3", pathPattern: "/moderate/appeals", entitlement: "community.enable" },
  { screenId: "M4", pathPattern: "/moderate/spaces", entitlement: "community.enable" },
] as const;

export function getModerationRouteByScreenId(
  screenId: ModerationScreenId,
): ModerationRouteContract {
  const route = MODERATION_ROUTE_REGISTRY.find((entry) => entry.screenId === screenId);
  if (!route) {
    throw new Error(`Unknown moderation screen: ${screenId}`);
  }
  return route;
}

export function listModerationScreenIds(): ModerationScreenId[] {
  return MODERATION_ROUTE_REGISTRY.map((entry) => entry.screenId);
}
