import { z } from "zod";
import { createPlatformRoute } from "@atlas/api/create-platform-route";
import { routeMetadata } from "./route.metadata";

const outputSchema = z.object({
  data: z.object({
    email: z.string(),
    mfaEnabled: z.boolean(),
    platformPermissions: z.array(z.string()),
  }),
});

/**
 * Who the console is for. Built like every platform route, so a refusal
 * answers with its code (PERMISSION_DENIED, MFA_REQUIRED) instead of an
 * unhandled 500: the console's gate needs MFA_REQUIRED to offer MFA setup.
 */
export const GET = createPlatformRoute({
  metadata: routeMetadata,
  output: outputSchema,
  handler: async ({ tx, ctx }) => {
    const rows = await tx.$queryRaw<{ email: string; mfa_enabled: boolean }[]>`
      SELECT email, mfa_enabled
      FROM auth_principals
      WHERE id = ${ctx.platformPrincipalId}::uuid
      LIMIT 1
    `;

    return {
      data: {
        email: rows[0]?.email ?? "platform-operator",
        mfaEnabled: rows[0]?.mfa_enabled ?? false,
        platformPermissions: [...ctx.platformPermissions],
      },
    };
  },
});
