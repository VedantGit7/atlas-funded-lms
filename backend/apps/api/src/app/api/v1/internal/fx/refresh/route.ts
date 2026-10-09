import { refreshFxRatesForActiveTenants } from "@atlas/domain-config/services/fx.service";
import { createCronHandler } from "../../../../../../server/internal/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual FX refresh for every active tenant. The worker refreshes each tenant
 * once per UTC day on its own (audit M5); this is an operator tool, authorised
 * with CRON_SECRET.
 */
const handle = createCronHandler({
  job: "fx-refresh",
  failureCode: "FX_REFRESH_FAILED",
  run: (requestId) => refreshFxRatesForActiveTenants(requestId),
});

export const GET = handle;
export const POST = handle;
