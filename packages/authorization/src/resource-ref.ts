import type { ResourceRef } from "./types";

export function createTenantResourceRef(args: {
  type: string;
  id: string;
  tenantId: string;
  ownerMembershipId?: string | null;
  relationships?: ResourceRef["relationships"];
}): ResourceRef {
  if (!args.type || !args.id || !args.tenantId) {
    throw new Error("Invalid ResourceRef");
  }

  return {
    type: args.type,
    id: args.id,
    tenantId: args.tenantId,
    tenantScoped: true,
    ownerMembershipId: args.ownerMembershipId ?? null,
    relationships: args.relationships ?? {},
  };
}

export function assertTenantScopedResource(args: {
  resource: ResourceRef;
  tenantId: string;
}): void {
  if (args.resource.tenantId !== args.tenantId) {
    throw new Error("TENANT_MISMATCH");
  }
}
