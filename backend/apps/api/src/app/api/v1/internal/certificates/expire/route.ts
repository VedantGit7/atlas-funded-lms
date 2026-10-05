import { expireDueCertificatesForActiveTenants } from "../../../../../../server/certificates/certificate-expiry.service";
import { createCronHandler } from "../../../../../../server/internal/cron-auth";
// Referenced so the route-metadata guard can associate this route.
import { routeMetadata } from "./route.metadata";

void routeMetadata;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual run of certificate expiry for every active tenant. The worker already
 * does this per tenant on every sweep (audit M5); this is an operator tool,
 * authorised with CRON_SECRET.
 */
const handle = createCronHandler({
  job: "certificates-expire",
  failureCode: "CERTIFICATE_EXPIRY_FAILED",
  run: (requestId) => expireDueCertificatesForActiveTenants(requestId),
});

export const GET = handle;
export const POST = handle;
