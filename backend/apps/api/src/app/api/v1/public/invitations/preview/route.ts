import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { createPublicRouteHandler } from "@atlas/api";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { invalidInvitation, previewInvitation } from "@atlas/membership";
import {
  PreviewInvitationQuerySchema,
  PreviewInvitationResponseSchema,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  return withGlobalDb(async (db) => {
    const tenant = await resolveTenantFromRequest({ req, db });
    const parsed = PreviewInvitationQuerySchema.safeParse({
      token: new URL(req.url).searchParams.get("token"),
    });

    if (!parsed.success) {
      throw invalidInvitation();
    }

    const preview = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        previewInvitation({
          tx,
          tenantId: tenant.tenantId,
          token: parsed.data.token,
        }),
    );

    if (!preview) {
      throw invalidInvitation();
    }

    const body = PreviewInvitationResponseSchema.parse({
      data: preview,
    });

    return NextResponse.json(body);
  });
});
