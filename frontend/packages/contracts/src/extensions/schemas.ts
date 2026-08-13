import { z } from "zod";

export const ExtensionPointKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9_.-]+$/);

export const RegistrationKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9_.-]+$/);

export const EntityStatusSchema = z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]);

export const ListExtensionRegistrationsQuerySchema = z.object({
  extensionPointKey: ExtensionPointKeySchema.optional(),
  status: EntityStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

export const CreateExtensionRegistrationBodySchema = z.object({
  extensionPointKey: ExtensionPointKeySchema,
  registrationKey: RegistrationKeySchema,
  configJson: z.record(z.string(), z.unknown()),
  status: EntityStatusSchema.default("ACTIVE"),
});

export const UpdateExtensionRegistrationBodySchema = z
  .object({
    id: z.uuid().optional(),
    extensionPointKey: ExtensionPointKeySchema.optional(),
    registrationKey: RegistrationKeySchema.optional(),
    configJson: z.record(z.string(), z.unknown()).optional(),
    status: EntityStatusSchema.optional(),
  })
  .refine((value) => value.id || (value.extensionPointKey && value.registrationKey), {
    message: "Either id or extensionPointKey + registrationKey is required",
  });

export const DeleteExtensionRegistrationBodySchema = z
  .object({
    id: z.uuid().optional(),
    extensionPointKey: ExtensionPointKeySchema.optional(),
    registrationKey: RegistrationKeySchema.optional(),
  })
  .refine((value) => value.id || (value.extensionPointKey && value.registrationKey), {
    message: "Either id or extensionPointKey + registrationKey is required",
  });

export type ListExtensionRegistrationsQuery = z.infer<typeof ListExtensionRegistrationsQuerySchema>;
export type CreateExtensionRegistrationInput = z.infer<
  typeof CreateExtensionRegistrationBodySchema
>;
export type UpdateExtensionRegistrationInput = z.infer<
  typeof UpdateExtensionRegistrationBodySchema
>;
export type DeleteExtensionRegistrationInput = z.infer<
  typeof DeleteExtensionRegistrationBodySchema
>;
