import { NextResponse } from "next/server";
import {
  authenticateTenantRequest,
  createPublicRouteHandler,
  resolveRequestTenant,
} from "@atlas/api";
import { extractAccessToken, extractRefreshToken } from "@atlas/auth";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  getPublicMarketingIntegrationSnippetsForViewer,
  noPublicMarketingIntegrationSnippets,
} from "../../../../../../../server/marketing-integrations/marketing-integrations.service";
import { routeMetadata } from "./route.metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Marketing integrations public snippets (Learnyst-style Code Snippets runtime).

/**
 * Tenant code snippets for the current viewer (audit H5).
 *
 * Anonymous visitors and learners get the tenant's snippets; signed-in staff get
 * none, because a snippet runs with the viewer's authority on this origin. A
 * session that is presented but cannot be verified gets none too: an expired
 * admin token must not be mistaken for an anonymous visitor.
 */
export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const presentsSession = Boolean(
    (await extractAccessToken(req)) ?? (await extractRefreshToken(req)),
  );
  let viewer: { tenantId: string; principalId: string | null };
  if (presentsSession) {
    try {
      const { tenant, principal } = await authenticateTenantRequest(req);
      viewer = { tenantId: tenant.tenantId, principalId: principal.id };
    } catch {
      return respond(noPublicMarketingIntegrationSnippets());
    }
  } else {
    const tenant = await resolveRequestTenant(req);
    viewer = { tenantId: tenant.tenantId, principalId: null };
  }

  const result = await withTenantTx(
    { tenantId: viewer.tenantId, requestId, allowAnonymousTenantRead: true },
    async (tx) => getPublicMarketingIntegrationSnippetsForViewer(tx, viewer),
  );
  return respond(result);
});

// Viewer-dependent: never let a shared cache give one viewer's answer to another.
function respond(body: unknown) {
  return NextResponse.json(body, {
    status: 200,
    headers: { "cache-control": "private, no-store", vary: "Cookie" },
  });
}
