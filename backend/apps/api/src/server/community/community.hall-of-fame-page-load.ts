import { headers } from "next/headers";
import { authenticateTenantRequest } from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { buildHallOfFameProjection } from "./community.hall-of-fame-service";
import type { ServiceCtx } from "./community.types";

export async function loadHallOfFamePageData() {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList);
  const req = new Request("http://local", { headers: headerList });

  // Supabase with no connection held, then tenant and principal on a released
  // connection, then the tenant transaction (audit H3).
  const { tenant, principal } = await authenticateTenantRequest(req);

  return withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) => {
      const membership = await requireActiveMembership({
        tx,
        tenantId: tenant.tenantId,
        authPrincipalId: principal.id,
      });

      const ctx: ServiceCtx = {
        tenantId: tenant.tenantId,
        actorMembershipId: membership.membershipId,
        requestId,
      };

      return buildHallOfFameProjection(tx, ctx);
    },
  );
}
