import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import { listMembers, memberListQuerySchema, membersListResponseSchema } from "@atlas/membership";
import { getRouteMetadata } from "./route.metadata";

type MembersListResponse = z.output<typeof membersListResponseSchema>;
type MemberListQuery = z.output<typeof memberListQuerySchema>;

export const GET = createTenantRoute<MemberListQuery, MembersListResponse>({
  metadata: getRouteMetadata,
  input: memberListQuerySchema,
  output: membersListResponseSchema,
  handler: async ({ tx, ctx, input }) => listMembers(tx, ctx, input),
});
