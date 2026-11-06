import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { signMemberAvatarDownload } from "@atlas/storage/member-avatar.service";
import { routeMetadata } from "./route.metadata";

const avatarIdSchema = z.uuid();

/** Missing, not this academy's, not ready or not an image: all the same 404. */
function avatarNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Avatar not found.",
  });
}

/**
 * A member's avatar, where there's no public R2 endpoint: a redirect to a
 * short-lived signed URL for a confirmed, public-safe raster image of this
 * academy. Profiles store this route's address, so it lasts while the signed
 * URLs it hands out don't (launch plan 5.1, staging, 6 November 2026).
 */
export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = avatarIdSchema.safeParse(new URL(req.url).pathname.split("/").at(-1) ?? "");
  if (!id.success) throw avatarNotFound();

  const tenant = await resolveRequestTenant(req);
  const signedUrl = await withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    (tx) => signMemberAvatarDownload(tx, id.data),
  );
  if (!signedUrl) throw avatarNotFound();

  const response = NextResponse.redirect(signedUrl, 302);
  // Browsers may reuse the redirect briefly, never past the signed URL's life.
  response.headers.set("cache-control", "private, max-age=60");
  return response;
});
