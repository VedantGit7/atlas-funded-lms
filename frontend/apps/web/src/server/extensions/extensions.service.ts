import type { TenantTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import type {
  CreateExtensionRegistrationInput,
  DeleteExtensionRegistrationInput,
  EntityStatusSchema,
  ListExtensionRegistrationsQuery,
  UpdateExtensionRegistrationInput,
} from "../../features/extensions/schemas";
import type { z } from "zod";
import { extensionsRepository } from "./extensions.repository";
import { extensionPointNotFound, extensionRegistrationNotFound } from "./extensions.errors";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

type EntityStatus = z.infer<typeof EntityStatusSchema>;

function mapPoint(row: {
  id: string;
  key: string;
  point_type: string;
  schema_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    pointType: row.point_type,
    schemaJson: row.schema_json,
    status: row.status as EntityStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRegistration(row: {
  id: string;
  extension_point_key: string;
  registration_key: string;
  config_json: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    extensionPointKey: row.extension_point_key,
    registrationKey: row.registration_key,
    configJson: row.config_json,
    status: row.status as EntityStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function resolveRegistrationLookup(
  input: UpdateExtensionRegistrationInput | DeleteExtensionRegistrationInput,
) {
  if (input.id) {
    return { id: input.id };
  }

  if (input.extensionPointKey && input.registrationKey) {
    return {
      extensionPointKey: input.extensionPointKey,
      registrationKey: input.registrationKey,
    };
  }

  throw extensionRegistrationNotFound();
}

function pageFrom<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;

  return {
    data,
    page: {
      hasMore,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  const code = (error as { code: string }).code;

  if (code === "P2002") {
    return true;
  }

  if (code === "P2010") {
    const meta = (
      error as {
        meta?: { driverAdapterError?: { cause?: { kind?: string } } };
      }
    ).meta;

    return meta?.driverAdapterError?.cause?.kind === "UniqueConstraintViolation";
  }

  return false;
}

export const extensionsService = {
  async listExtensionPoints(tx: TenantTx) {
    const points = await extensionsRepository.listExtensionPoints(tx);
    return { data: points.map(mapPoint) };
  },

  async listRegistrations(tx: TenantTx, query: ListExtensionRegistrationsQuery) {
    const rows = await extensionsRepository.listRegistrations(tx, query);
    const page = pageFrom(rows, query.limit);

    return {
      data: page.data.map(mapRegistration),
      page: page.page,
    };
  },

  async createRegistration(tx: TenantTx, ctx: ServiceCtx, input: CreateExtensionRegistrationInput) {
    const point = await extensionsRepository.findExtensionPointByKey(tx, input.extensionPointKey);

    if (!point || point.status !== "ACTIVE") {
      throw extensionPointNotFound();
    }

    try {
      const registration = await extensionsRepository.createRegistration(tx, {
        tenantId: ctx.tenantId,
        extensionPointKey: input.extensionPointKey,
        registrationKey: input.registrationKey,
        configJson: input.configJson,
        status: input.status,
      });

      await auditWriter.write(
        tx,
        {
          tenantId: ctx.tenantId,
          actorMembershipId: ctx.actorMembershipId,
          platformPrincipalId: null,
          requestId: ctx.requestId,
        },
        {
          action: "extension.registration.created",
          target: { type: "extension_registration", id: registration.id },
          before: null,
          after: {
            extensionPointKey: input.extensionPointKey,
            registrationKey: input.registrationKey,
            status: input.status,
          },
          metadata: {},
        },
      );

      return { data: mapRegistration(registration) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw extensionRegistrationNotFound();
      }

      throw error;
    }
  },

  async updateRegistration(tx: TenantTx, ctx: ServiceCtx, input: UpdateExtensionRegistrationInput) {
    const existing = await extensionsRepository.findRegistration(
      tx,
      resolveRegistrationLookup(input),
    );

    if (!existing) {
      throw extensionRegistrationNotFound();
    }

    if (input.extensionPointKey) {
      const point = await extensionsRepository.findExtensionPointByKey(tx, input.extensionPointKey);

      if (!point || point.status !== "ACTIVE") {
        throw extensionPointNotFound();
      }
    }

    const updateData: Parameters<typeof extensionsRepository.updateRegistration>[2] = {};
    if (input.extensionPointKey !== undefined)
      updateData.extensionPointKey = input.extensionPointKey;
    if (input.registrationKey !== undefined) updateData.registrationKey = input.registrationKey;
    if (input.configJson !== undefined) updateData.configJson = input.configJson;
    if (input.status !== undefined) updateData.status = input.status;

    const registration = await extensionsRepository.updateRegistration(tx, existing.id, updateData);

    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "extension.registration.updated",
        target: { type: "extension_registration", id: registration.id },
        before: {
          extensionPointKey: existing.extension_point_key,
          registrationKey: existing.registration_key,
          status: existing.status,
        },
        after: {
          extensionPointKey: registration.extension_point_key,
          registrationKey: registration.registration_key,
          status: registration.status,
        },
        metadata: {},
      },
    );

    return { data: mapRegistration(registration) };
  },

  async deleteRegistration(tx: TenantTx, ctx: ServiceCtx, input: DeleteExtensionRegistrationInput) {
    const existing = await extensionsRepository.findRegistration(
      tx,
      resolveRegistrationLookup(input),
    );

    if (!existing) {
      throw extensionRegistrationNotFound();
    }

    await extensionsRepository.deleteRegistration(tx, existing.id);

    await auditWriter.write(
      tx,
      {
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        platformPrincipalId: null,
        requestId: ctx.requestId,
      },
      {
        action: "extension.registration.deleted",
        target: { type: "extension_registration", id: existing.id },
        before: {
          extensionPointKey: existing.extension_point_key,
          registrationKey: existing.registration_key,
          status: existing.status,
        },
        after: { deleted: true },
        metadata: {},
      },
    );

    return { data: { id: existing.id, deleted: true as const } };
  },
};
