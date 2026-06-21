/** Display-only owner capability hints — server `can()` remains authoritative. */
export type AdminOwnerCapabilityProjection = {
  canManageOwnerMembership: boolean;
  canEditOwnerRole: boolean;
  canManageBroadOverrides: boolean;
  canRunFullTenantExport: boolean;
  canProcessFullTenantDeletion: boolean;
};

export function projectAdminOwnerCapabilities(args: {
  actorHasOwnerRank: boolean;
}): AdminOwnerCapabilityProjection {
  return {
    canManageOwnerMembership: args.actorHasOwnerRank,
    canEditOwnerRole: args.actorHasOwnerRank,
    canManageBroadOverrides: args.actorHasOwnerRank,
    canRunFullTenantExport: args.actorHasOwnerRank,
    canProcessFullTenantDeletion: args.actorHasOwnerRank,
  };
}
