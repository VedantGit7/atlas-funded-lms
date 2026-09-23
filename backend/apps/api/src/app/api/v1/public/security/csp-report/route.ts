import { NextResponse } from "next/server";
import { createPublicRouteHandler } from "@atlas/api/public-route";
import { readCspReports } from "@atlas/api/csp-report";
import { structuredLogger } from "@atlas/observability/logger";
import { readReleaseIdentifier } from "@atlas/observability/release";

export const routeMetadata = {
  public: true,
  permission: "pub",
  audit: "none",
  rateLimit: "cspReport",
  idempotency: "none",
} as const;

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const reports = await readCspReports(req);
  for (const report of reports) {
    structuredLogger.info({
      message: "csp.report.received",
      module: "csp-report",
      requestId,
      release: readReleaseIdentifier() ?? "unknown",
      trust: "untrusted",
      ...report,
    });
  }
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
});
