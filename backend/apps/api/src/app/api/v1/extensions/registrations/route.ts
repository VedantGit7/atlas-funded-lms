import type { z } from "zod";
import { createTenantRoute } from "@atlas/api";
import {
  CreateExtensionRegistrationBodySchema,
  DeleteExtensionRegistrationBodySchema,
  ListExtensionRegistrationsQuerySchema,
  UpdateExtensionRegistrationBodySchema,
} from "@atlas/api-server/extensions/schemas";
import { extensionsService } from "@atlas/api-server/extensions/extensions.service";
import {
  extensionRegistrationDeleteResponseSchema,
  extensionRegistrationDetailResponseSchema,
  extensionRegistrationListResponseSchema,
} from "@atlas/api-server/extensions/extensions-response-schemas";
import {
  deleteExtensionRegistrationsRouteMetadata,
  getExtensionRegistrationsRouteMetadata,
  postExtensionRegistrationsRouteMetadata,
  putExtensionRegistrationsRouteMetadata,
} from "./route.metadata";

type ListExtensionRegistrationsQuery = z.output<typeof ListExtensionRegistrationsQuerySchema>;
type CreateExtensionRegistrationBody = z.output<typeof CreateExtensionRegistrationBodySchema>;
type UpdateExtensionRegistrationBody = z.output<typeof UpdateExtensionRegistrationBodySchema>;
type DeleteExtensionRegistrationBody = z.output<typeof DeleteExtensionRegistrationBodySchema>;

export const GET = createTenantRoute<
  ListExtensionRegistrationsQuery,
  z.output<typeof extensionRegistrationListResponseSchema>
>({
  metadata: getExtensionRegistrationsRouteMetadata,
  input: ListExtensionRegistrationsQuerySchema,
  output: extensionRegistrationListResponseSchema,
  handler: async ({ tx, input }) => extensionsService.listRegistrations(tx, input),
});

export const POST = createTenantRoute<
  CreateExtensionRegistrationBody,
  z.output<typeof extensionRegistrationDetailResponseSchema>
>({
  metadata: postExtensionRegistrationsRouteMetadata,
  body: CreateExtensionRegistrationBodySchema,
  output: extensionRegistrationDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => extensionsService.createRegistration(tx, ctx, input),
});

export const PUT = createTenantRoute<
  UpdateExtensionRegistrationBody,
  z.output<typeof extensionRegistrationDetailResponseSchema>
>({
  metadata: putExtensionRegistrationsRouteMetadata,
  body: UpdateExtensionRegistrationBodySchema,
  output: extensionRegistrationDetailResponseSchema,
  handler: async ({ tx, ctx, input }) => extensionsService.updateRegistration(tx, ctx, input),
});

export const DELETE = createTenantRoute<
  DeleteExtensionRegistrationBody,
  z.output<typeof extensionRegistrationDeleteResponseSchema>
>({
  metadata: deleteExtensionRegistrationsRouteMetadata,
  body: DeleteExtensionRegistrationBodySchema,
  output: extensionRegistrationDeleteResponseSchema,
  handler: async ({ tx, ctx, input }) => extensionsService.deleteRegistration(tx, ctx, input),
});
