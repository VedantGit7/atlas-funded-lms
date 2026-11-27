import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { signCourseCoverDownload } from "@atlas/storage/course-cover.service";
import { routeMetadata } from "./route.metadata";

const coverIdSchema = z.uuid();

/** Missing, not this academy's, not ready or not an image: all the same 404. */
function coverNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Course image not found.",
  });
}

/**
 * A course's image (QA review 1 M21, M49): a redirect to a short-lived signed
 * URL for a confirmed, public-safe raster image of this academy. The course
 * stores this route's address, so it lasts while the signed URLs don't. It's
 * public like the catalogue picture it is, the same way avatars are served.
 */
export const GET = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const id = coverIdSchema.safeParse(new URL(req.url).pathname.split("/").at(-1) ?? "");
  if (!id.success) throw coverNotFound();

  const tenant = await resolveRequestTenant(req);
  const signedUrl = await withTenantTx(
    { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
    (tx) => signCourseCoverDownload(tx, id.data),
  );
  if (!signedUrl) throw coverNotFound();

  const response = NextResponse.redirect(signedUrl, 302);
  // Browsers may reuse the redirect briefly, never past the signed URL's life.
  response.headers.set("cache-control", "private, max-age=60");
  return response;
});
