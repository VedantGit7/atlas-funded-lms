import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export const extensionsRepository = {
  async listExtensionPoints(tx: TenantTx) {
    return tx.extensionPoint.findMany({
      where: { status: "ACTIVE" },
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        point_type: true,
        schema_json: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async findExtensionPointByKey(tx: TenantTx, key: string) {
    return tx.extensionPoint.findUnique({
      where: { key },
      select: {
        id: true,
        key: true,
        point_type: true,
        schema_json: true,
        status: true,
      },
    });
  },

  async listRegistrations(
    tx: TenantTx,
    args: {
      extensionPointKey?: string | undefined;
      status?: string | undefined;
      limit: number;
      cursor?: string | undefined;
    },
  ) {
    return tx.extensionRegistration.findMany({
      where: {
        ...(args.extensionPointKey ? { extension_point_key: args.extensionPointKey } : {}),
        ...(args.status ? { status: args.status as never } : {}),
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: Math.min(args.limit + 1, 101),
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        extension_point_key: true,
        registration_key: true,
        config_json: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async findRegistration(
    tx: TenantTx,
    input:
      | { id: string }
      | {
          extensionPointKey: string;
          registrationKey: string;
        },
  ) {
    return tx.extensionRegistration.findFirst({
      where:
        "id" in input
          ? { id: input.id }
          : {
              extension_point_key: input.extensionPointKey,
              registration_key: input.registrationKey,
            },
      select: {
        id: true,
        extension_point_key: true,
        registration_key: true,
        config_json: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async createRegistration(
    tx: TenantTx,
    data: {
      tenantId: string;
      extensionPointKey: string;
      registrationKey: string;
      configJson: unknown;
      status: "ACTIVE" | "DISABLED" | "ARCHIVED";
    },
  ) {
    const registrationId = randomUUID();

    await tx.$executeRaw`
      insert into extension_registrations (
        id,
        tenant_id,
        extension_point_key,
        registration_key,
        config_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${registrationId}::uuid,
        ${data.tenantId}::uuid,
        ${data.extensionPointKey},
        ${data.registrationKey},
        ${JSON.stringify(data.configJson)}::jsonb,
        ${data.status}::"EntityStatus",
        now(),
        now()
      )
    `;

    const registration = await tx.extensionRegistration.findFirst({
      where: { id: registrationId },
      select: {
        id: true,
        extension_point_key: true,
        registration_key: true,
        config_json: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!registration) {
      throw new Error("EXTENSION_REGISTRATION_CREATE_FAILED");
    }

    return registration;
  },

  async updateRegistration(
    tx: TenantTx,
    id: string,
    data: {
      extensionPointKey?: string;
      registrationKey?: string;
      configJson?: unknown;
      status?: "ACTIVE" | "DISABLED" | "ARCHIVED";
    },
  ) {
    return tx.extensionRegistration.update({
      where: { id },
      data: {
        ...(data.extensionPointKey !== undefined
          ? { extension_point_key: data.extensionPointKey }
          : {}),
        ...(data.registrationKey !== undefined ? { registration_key: data.registrationKey } : {}),
        ...(data.configJson !== undefined ? { config_json: data.configJson as never } : {}),
        ...(data.status !== undefined ? { status: data.status as never } : {}),
      },
      select: {
        id: true,
        extension_point_key: true,
        registration_key: true,
        config_json: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });
  },

  async deleteRegistration(tx: TenantTx, id: string) {
    return tx.extensionRegistration.delete({
      where: { id },
      select: { id: true },
    });
  },
};
