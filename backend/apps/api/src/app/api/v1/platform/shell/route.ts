import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPrincipal } from "@atlas/auth/platform-auth";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { withGlobalDb } from "@atlas/db/global-db";
import { withPlatformScope } from "@atlas/db";

const outputSchema = z.object({
  data: z.object({
    email: z.string(),
    mfaEnabled: z.boolean(),
    platformPermissions: z.array(z.string()),
  }),
});

export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

  return withGlobalDb(async (db) => {
    const principal = await requirePlatformPrincipal({
      req,
      db,
      requiredPermission: "platform.tenant.read",
    });

    const body = await withPlatformScope(
      {
        principalId: principal.platformPrincipalId,
        requestId,
        requiredPermission: "platform.tenant.read",
        platformPermissions: principal.platformPermissions as never,
        route: "/api/v1/platform/shell",
      },
      "platform.shell.read",
      async (tx) => {
        const rows = await tx.$queryRaw<{ email: string; mfa_enabled: boolean }[]>`
          SELECT email, mfa_enabled
          FROM auth_principals
          WHERE id = ${principal.platformPrincipalId}::uuid
          LIMIT 1
        `;

        return outputSchema.parse({
          data: {
            email: rows[0]?.email ?? "platform-operator",
            mfaEnabled: rows[0]?.mfa_enabled ?? false,
            platformPermissions: principal.platformPermissions,
          },
        });
      },
    );

    return NextResponse.json(body, {
      headers: { "x-request-id": requestId },
    });
  });
}
