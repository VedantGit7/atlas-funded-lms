import type { PublicRouteMetadata } from "@atlas/authorization/route-metadata";

export const routeMetadata: PublicRouteMetadata = {
  id: "storage.local.download",
  summary: "Download a locally stored object using a signed token",
  rateLimit: "public-read",
};
