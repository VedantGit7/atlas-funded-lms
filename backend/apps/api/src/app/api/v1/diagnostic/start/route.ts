import type { z } from "zod";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { createTenantRoute } from "@atlas/api";
import {
  AuthenticatedDiagnosticStartBodySchema,
  authenticatedDiagnosticStartResponseSchema,
} from "../../../../../server/diagnostics/diagnostic.schemas";
import { startAuthenticatedDiagnostic } from "../../../../../server/diagnostics/diagnostic-authenticated.service";
import { routeMetadata } from "./route.metadata";

export const POST = createTenantRoute<
  z.infer<typeof AuthenticatedDiagnosticStartBodySchema>,
  z.output<typeof authenticatedDiagnosticStartResponseSchema>
>({
  metadata: routeMetadata,
  body: AuthenticatedDiagnosticStartBodySchema,
  output: authenticatedDiagnosticStartResponseSchema,
  handler: async ({ tx, ctx }) => {
    const idempotencyKey = ctx.idempotencyKey;
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

    return startAuthenticatedDiagnostic({
      tx,
      ctx,
      idempotencyKey,
    });
  },
});
