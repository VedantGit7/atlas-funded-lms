import { NextResponse } from "next/server";
import { createPublicRouteHandler, requireSessionUser, resolveRequestTenant } from "@atlas/api";
import { authProvider, invitedAccountState } from "@atlas/auth";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { invalidInvitation, previewInvitation } from "@atlas/membership";
import {
  PreviewInvitationQuerySchema,
  PreviewInvitationResponseSchema,
} from "@atlas/domain-identity";
import { routeMetadata } from "./route.metadata";

export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const tenant = await resolveRequestTenant(req);
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

  // Who's signed in here, read by the API so the web app needn't ask the
  // login system itself. Nobody signed in is an answer, not an error.
  const signedInEmail = await requireSessionUser(req)
    .then((user) => user.email.trim().toLowerCase())
    .catch(() => null);

  const body = PreviewInvitationResponseSchema.parse({
    data: {
      ...preview,
      signedInEmail,
      // Better Auth: no account yet means the page can set a password now.
      ...(authProvider() === "better-auth"
        ? { account: await invitedAccountState(preview.invitedEmail) }
        : {}),
    },
  });

  return NextResponse.json(body);
});
