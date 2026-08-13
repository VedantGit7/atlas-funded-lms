import { z } from "zod";

export const rejectClientTenantIdSchema = z
  .object({
    tenant_id: z.never().optional(),
    tenantId: z.never().optional(),
  })
  .strict();

export function mutationBodySchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({
      ...shape,
      tenant_id: z.never().optional(),
      tenantId: z.never().optional(),
    })
    .strict();
}

export const uuidParamSchema = z.object({
  id: z.uuid(),
});

export const memberRoleParamsSchema = z.object({
  id: z.uuid(),
  roleId: z.uuid(),
});

export function decodeListCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };

    if (!parsed.createdAt || !parsed.id) {
      throw new Error("Invalid cursor");
    }

    return {
      createdAt: new Date(parsed.createdAt),
      id: parsed.id,
    };
  } catch {
    throw new Error("Invalid cursor");
  }
}

export function encodeListCursor(args: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: args.createdAt.toISOString(),
      id: args.id,
    }),
    "utf8",
  ).toString("base64url");
}

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});
