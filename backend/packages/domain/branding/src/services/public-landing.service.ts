import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { PublicLandingPage } from "../schemas/public-landing";
import {
  buildPublicLandingPage,
  resolvePublicLandingCopy,
} from "../utils/public-landing-projection";
import { readRuntimeBrandingProjection } from "./runtime-branding.service";

export async function getPublicLandingPage(
  tx: TenantTx,
  slug: string,
): Promise<PublicLandingPage> {
  const branding = await readRuntimeBrandingProjection(tx);
  const copy = resolvePublicLandingCopy(branding.publicLandingCopy, slug);

  if (slug !== "home" && !copy) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "Landing page not found",
    });
  }

  return buildPublicLandingPage({
    slug,
    publicName: branding.publicName,
    issuerName: branding.issuerName,
    copy,
  });
}
