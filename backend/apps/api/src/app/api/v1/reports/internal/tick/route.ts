import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { withTenantTx } from "@atlas/db";
import { tickReportSchedules } from "@atlas/domain/reports/reports.service";
import { routeMetadata } from "./route.metadata";

void routeMetadata;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Claim due report schedules and enqueue report runs. Triggered on a schedule by
 * a cron and authorised with CRON_SECRET rather than a user session.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return NextResponse.json({ error: { code: "CRON_NOT_CONFIGURED" } }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) {
    return NextResponse.json({ error: { code: "TENANT_REQUIRED" } }, { status: 400 });
  }

  const requestId = randomUUID();

  try {
    const result = await withTenantTx(
      {
        tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        tickReportSchedules(tx, {
          tenantId,
          actorMembershipId: "00000000-0000-0000-0000-000000000000",
          requestId,
        }),
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "REPORT_TICK_FAILED", message: String(error) } },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
