// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { z } from "zod";

const certificatePageUnitSchema = z.enum(["px", "mm", "in"]);
const certificatePageOrientationSchema = z.enum(["landscape", "portrait"]);

export const certificateDesignPageSchema = z
  .object({
    width: z.number().positive(),
    height: z.number().positive(),
    unit: certificatePageUnitSchema,
    orientation: certificatePageOrientationSchema,
    bleedMm: z.number().nonnegative().optional(),
    safeMm: z.number().nonnegative().optional(),
  })
  .strict();

export const certificateDesignBackgroundSchema = z
  .object({
    type: z.enum(["color", "image", "gradient"]),
    value: z.string().min(1),
  })
  .strict();

const certificateElementBaseSchema = z
  .object({
    id: z.string().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    rotation: z.number().optional(),
    zIndex: z.number().int(),
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
    name: z.string().optional(),
  })
  .strict();

export const certificateTextElementSchema = certificateElementBaseSchema
  .extend({
    type: z.literal("text"),
    text: z.string(),
    fontFamily: z.string().min(1),
    fontSize: z.number().positive(),
    fontWeight: z.union([z.number().int().min(1).max(1000), z.string().min(1)]),
    fontStyle: z.string().optional(),
    color: z.string().min(1),
    align: z.enum(["left", "center", "right", "justify"]),
    letterSpacing: z.number().optional(),
    lineHeight: z.number().positive().optional(),
    variableKey: z.string().optional(),
    direction: z.enum(["ltr", "rtl"]).optional(),
    autoFit: z.boolean().optional(),
  })
  .strict();

export const certificateImageElementSchema = certificateElementBaseSchema
  .extend({
    type: z.literal("image"),
    src: z.string().min(1),
    opacity: z.number().min(0).max(1).optional(),
    variableKey: z.string().optional(),
  })
  .strict();

export const certificateShapeElementSchema = certificateElementBaseSchema
  .extend({
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse", "line"]),
    fill: z.string().optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().nonnegative().optional(),
    cornerRadius: z.number().nonnegative().optional(),
  })
  .strict();

export const certificateQrElementSchema = certificateElementBaseSchema
  .extend({
    type: z.literal("qr"),
    valueSource: z.enum(["verification_url", "credential_id", "custom"]),
    customValue: z.string().optional(),
  })
  .strict();

export const certificateSignatureElementSchema = certificateElementBaseSchema
  .extend({
    type: z.literal("signature"),
    imageSrc: z.string().optional(),
    labelVariableKey: z.string().optional(),
    titleVariableKey: z.string().optional(),
  })
  .strict();

export const certificateDesignElementSchema = z.discriminatedUnion("type", [
  certificateTextElementSchema,
  certificateImageElementSchema,
  certificateShapeElementSchema,
  certificateQrElementSchema,
  certificateSignatureElementSchema,
]);

export const certificateDesignVariableSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    sampleValue: z.string().optional(),
  })
  .strict();

export const certificateDesignRuleSchema = z
  .object({
    id: z.string().min(1),
    when: z
      .object({
        variableKey: z.string().min(1),
        op: z.enum(["eq", "gte", "lte", "contains"]),
        value: z.union([z.string(), z.number()]),
      })
      .strict(),
    then: z
      .object({
        action: z.enum(["show", "hide", "setStyle"]),
        elementId: z.string().min(1),
        style: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export const certificateDesignDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    page: certificateDesignPageSchema,
    background: certificateDesignBackgroundSchema,
    elements: z.array(certificateDesignElementSchema),
    variables: z.array(certificateDesignVariableSchema).optional(),
    rules: z.array(certificateDesignRuleSchema).optional(),
    brandKitRef: z.string().nullable().optional(),
    locale: z.string().optional(),
  })
  .strict();

export type CertificateDesignPage = z.infer<typeof certificateDesignPageSchema>;
export type CertificateDesignBackground = z.infer<typeof certificateDesignBackgroundSchema>;
export type CertificateTextElement = z.infer<typeof certificateTextElementSchema>;
export type CertificateImageElement = z.infer<typeof certificateImageElementSchema>;
export type CertificateShapeElement = z.infer<typeof certificateShapeElementSchema>;
export type CertificateQrElement = z.infer<typeof certificateQrElementSchema>;
export type CertificateSignatureElement = z.infer<typeof certificateSignatureElementSchema>;
export type CertificateDesignElement = z.infer<typeof certificateDesignElementSchema>;
export type CertificateDesignVariable = z.infer<typeof certificateDesignVariableSchema>;
export type CertificateDesignRule = z.infer<typeof certificateDesignRuleSchema>;
export type CertificateDesignDocument = z.infer<typeof certificateDesignDocumentSchema>;

export function createEmptyDesignDocument(): CertificateDesignDocument {
  return {
    schemaVersion: 1,
    page: {
      width: 297,
      height: 210,
      unit: "mm",
      orientation: "landscape",
      safeMm: 10,
    },
    background: {
      type: "color",
      value: "#ffffff",
    },
    elements: [
      {
        id: "recipient-name",
        type: "text",
        name: "Recipient name",
        x: 40,
        y: 80,
        width: 217,
        height: 24,
        zIndex: 1,
        text: "{{recipient_name}}",
        fontFamily: "Georgia, serif",
        fontSize: 28,
        fontWeight: 700,
        color: "#1a1a1a",
        align: "center",
        variableKey: "recipient_name",
      },
      {
        id: "verification-qr",
        type: "qr",
        name: "Verification QR",
        x: 240,
        y: 165,
        width: 32,
        height: 32,
        zIndex: 2,
        valueSource: "verification_url",
      },
    ],
    variables: [
      {
        key: "recipient_name",
        label: "Recipient name",
        sampleValue: "Jane Doe",
      },
      {
        key: "course_title",
        label: "Course title",
        sampleValue: "Introduction to Trading",
      },
      {
        key: "score",
        label: "Score",
        sampleValue: "95",
      },
    ],
  };
}
