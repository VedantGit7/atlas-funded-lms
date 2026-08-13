import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const iapPlatformSchema = z.enum(["ios", "android"]);

export const verifyIapBodySchema = rejectClientTenantFields
  .extend({
    courseId: z.uuid(),
    platform: iapPlatformSchema,
    productId: z.string().trim().min(1).max(200),
    signedTransaction: z.string().trim().min(1).max(20000).optional(),
    receiptData: z.string().trim().min(1).max(500000).optional(),
    purchaseToken: z.string().trim().min(1).max(5000).optional(),
    packageName: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.platform === "ios") {
      if (!value.signedTransaction && !value.receiptData) {
        ctx.addIssue({
          code: "custom",
          message: "signedTransaction or receiptData is required for iOS.",
          path: ["signedTransaction"],
        });
      }
      return;
    }

    if (!value.purchaseToken) {
      ctx.addIssue({
        code: "custom",
        message: "purchaseToken is required for Android.",
        path: ["purchaseToken"],
      });
    }
  });

export const verifyIapResponseSchema = z.object({
  data: z
    .object({
      enrollmentId: z.uuid(),
      paymentOrderId: z.uuid(),
      created: z.boolean(),
      platform: iapPlatformSchema,
      environment: z.enum(["sandbox", "production"]),
      externalTransactionId: z.string().min(1),
      productId: z.string().min(1),
    })
    .strict(),
});

export const iapCourseIdParamsSchema = z
  .object({
    id: z.uuid(),
  })
  .strict();

export const storePlatformPublicPricingSchema = z
  .object({
    enabled: z.boolean(),
    productId: z.string().nullable(),
    displayPriceLabel: z.string().nullable(),
    priceTierHintCents: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const courseStorePricingResponseSchema = z.object({
  data: z
    .object({
      courseId: z.uuid(),
      ios: storePlatformPublicPricingSchema,
      android: storePlatformPublicPricingSchema,
    })
    .strict(),
});

export type VerifyIapBody = z.infer<typeof verifyIapBodySchema>;
export type VerifyIapResponse = z.infer<typeof verifyIapResponseSchema>;
export type CourseStorePricingResponse = z.infer<typeof courseStorePricingResponseSchema>;
