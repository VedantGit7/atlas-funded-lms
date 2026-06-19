"use client";

import type { z } from "zod";
import { ClientApiError, clientApi } from "../../lib/client-api";
import type {
  extensionPointListResponseSchema,
  extensionRegistrationListResponseSchema,
  extensionRegistrationDetailResponseSchema,
} from "./extensions-response-schemas";
import type {
  CreateExtensionRegistrationBodySchema,
  UpdateExtensionRegistrationBodySchema,
  DeleteExtensionRegistrationBodySchema,
} from "./schemas";

type ExtensionPointListResponse = z.infer<typeof extensionPointListResponseSchema>;
type ExtensionRegistrationListResponse = z.infer<typeof extensionRegistrationListResponseSchema>;
type ExtensionRegistrationDetailResponse = z.infer<
  typeof extensionRegistrationDetailResponseSchema
>;
type CreateExtensionRegistrationBody = z.infer<typeof CreateExtensionRegistrationBodySchema>;
type UpdateExtensionRegistrationBody = z.infer<typeof UpdateExtensionRegistrationBodySchema>;
type DeleteExtensionRegistrationBody = z.infer<typeof DeleteExtensionRegistrationBodySchema>;

export type ExtensionPointDto = ExtensionPointListResponse["data"][number];
export type ExtensionRegistrationDto = ExtensionRegistrationListResponse["data"][number];

export async function listExtensionPoints(): Promise<ExtensionPointListResponse> {
  return clientApi.get<ExtensionPointListResponse>("/api/v1/extension-points");
}

export async function listExtensionRegistrations(): Promise<ExtensionRegistrationListResponse> {
  return clientApi.get<ExtensionRegistrationListResponse>("/api/v1/extensions/registrations");
}

export async function createExtensionRegistration(
  body: CreateExtensionRegistrationBody,
): Promise<ExtensionRegistrationDetailResponse> {
  return clientApi.post<ExtensionRegistrationDetailResponse>(
    "/api/v1/extensions/registrations",
    body,
    "create-extension-registration",
  );
}

export async function updateExtensionRegistration(
  body: UpdateExtensionRegistrationBody,
): Promise<ExtensionRegistrationDetailResponse> {
  return clientApi.put<ExtensionRegistrationDetailResponse>(
    "/api/v1/extensions/registrations",
    body,
    "update-extension-registration",
  );
}

export async function deleteExtensionRegistration(
  body: DeleteExtensionRegistrationBody,
): Promise<{ data: { id: string; deleted: true } }> {
  return clientApi.delete(
    "/api/v1/extensions/registrations",
    "delete-extension-registration",
    body,
  );
}

export const extensionsApi = {
  listExtensionPoints,
  listExtensionRegistrations,
  createExtensionRegistration,
  updateExtensionRegistration,
  deleteExtensionRegistration,
};

export function formatExtensionsApiError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return error.message;
  }

  return "Request failed.";
}
