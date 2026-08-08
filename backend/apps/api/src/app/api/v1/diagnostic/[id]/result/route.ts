import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  DiagnosticSessionParamsSchema,
  authenticatedDiagnosticResultResponseSchema,
} from "../../../../../../server/diagnostics/diagnostic.schemas";
import { getAuthenticatedDiagnosticResult } from "../../../../../../server/diagnostics/diagnostic-authenticated.service";
import { routeMetadata } from "./route.metadata";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof authenticatedDiagnosticResultResponseSchema>,
  typeof DiagnosticSessionParamsSchema
>({
  metadata: routeMetadata,
  params: DiagnosticSessionParamsSchema,
  output: authenticatedDiagnosticResultResponseSchema,
  handler: async ({ tx, ctx, params }) => {
    const sessionId = params["id"];
    if (!sessionId) throw new Error("Missing diagnostic session id");
    return getAuthenticatedDiagnosticResult({ tx, ctx, sessionId });
  },
});
