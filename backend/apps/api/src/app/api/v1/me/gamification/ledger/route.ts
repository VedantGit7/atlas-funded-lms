import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  myLedgerQuerySchema,
  myLedgerResponseSchema,
} from "../../../../../../server/gamification/gamification.schemas";
import { listMyGamificationLedger } from "../../../../../../server/gamification/gamification.service";
import { routeMetadata } from "./route.metadata";

type MyLedgerQuery = z.output<typeof myLedgerQuerySchema>;
type MyLedgerResponse = z.output<typeof myLedgerResponseSchema>;

export const GET = createTenantRoute<MyLedgerQuery, MyLedgerResponse>({
  metadata: routeMetadata,
  input: myLedgerQuerySchema,
  output: myLedgerResponseSchema,
  handler: async ({ tx, ctx, input }) => listMyGamificationLedger(tx, ctx, input),
});
