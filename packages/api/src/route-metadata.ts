import type { ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";

export type TenantRouteContext = {
  tenantId: string;
  requestId: string;
  actorMembershipId: string;
};

export type ResourceLoaderFn<TInput = unknown> = (args: {
  tx: TenantTx;
  ctx: TenantRouteContext;
  params: Record<string, string>;
  input: TInput;
}) => Promise<ResourceRef>;

export type RouteMetadata<TInput = unknown> = {
  public?: false;
  permission: string;
  entitlement?: string | null;
  resourceLoader?: ResourceLoaderFn<TInput>;
  audit: "none" | "required";
  rateLimit: string;
  idempotency: "none" | "required";
};
