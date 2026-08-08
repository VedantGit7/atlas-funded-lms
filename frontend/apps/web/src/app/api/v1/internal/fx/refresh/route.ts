import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshFxRatesForActiveTenants } from "@atlas/domain-config/services/fx.service";
// Referenced so the route-metadata guard can associate this route.
import { routeMetadata } from "./route.metadata";

void routeMetadata;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh cached FX rates for every active tenant. Triggered on a schedule by a
 * cron (Vercel Cron issues GET) and authorised with a static CRON_SECRET rather
 * than a user session. Also callable manually with the same bearer token.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json(
      { error: { code: "CRON_NOT_CONFIGURED" } },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const requestId = randomUUID();
  try {
    const result = await refreshFxRatesForActiveTenants(requestId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "FX_REFRESH_FAILED", message: String(error) } },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
