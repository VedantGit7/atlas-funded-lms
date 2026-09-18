import type { z } from "zod";
import { createTenantRoute, noBodySchema } from "@atlas/api";
import {
  createPollExportBodySchema,
  createPollExportResponseSchema,
  pollsExportsResponseSchema,
} from "@atlas/domain/reports/polls-exports.dto";
import {
  createPollsExportMetadata,
  getPollsExportsMetadata,
} from "@atlas/domain/reports/polls-exports.route-metadata";
import { createPollExport, getPollsExports } from "@atlas/domain/reports/polls-exports.service";

export const GET = createTenantRoute<
  Record<string, never>,
  z.output<typeof pollsExportsResponseSchema>
>({
  metadata: getPollsExportsMetadata,
  input: noBodySchema,
  output: pollsExportsResponseSchema,
  handler: async ({ tx, ctx }) => getPollsExports(tx, ctx),
});

export const POST = createTenantRoute<
  z.output<typeof createPollExportBodySchema>,
  z.output<typeof createPollExportResponseSchema>
>({
  metadata: createPollsExportMetadata,
  body: createPollExportBodySchema,
  output: createPollExportResponseSchema,
  handler: async ({ tx, ctx, input }) => createPollExport(tx, ctx, input),
});
