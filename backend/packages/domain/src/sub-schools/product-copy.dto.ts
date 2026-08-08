import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const PRODUCT_COPY_TYPES = ["COURSE", "MOCK_TEST", "TEST_SERIES"] as const;
export const PRODUCT_COPY_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export const createProductCopyJobBodySchema = rejectClientTenantFields
  .extend({
    productType: z.enum(PRODUCT_COPY_TYPES),
    sourceProductId: z.string().uuid(),
    sourceProductTitle: z.string().min(1).max(200),
    destinationProductName: z.string().min(1).max(200),
    sectionIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .strict();

export const productCopyJobDtoSchema = z
  .object({
    id: z.string().uuid(),
    destinationSubSchoolId: z.string().uuid(),
    productType: z.enum(PRODUCT_COPY_TYPES),
    sourceProductId: z.string().uuid(),
    sourceProductTitle: z.string(),
    destinationProductName: z.string(),
    sectionIds: z.array(z.string().uuid()).nullable(),
    resultProductId: z.string().uuid().nullable(),
    status: z.enum(PRODUCT_COPY_STATUSES),
    errorMessage: z.string().nullable(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const productCopyJobResponseSchema = z.object({ data: productCopyJobDtoSchema });
export const productCopyJobListResponseSchema = z.object({
  data: z.object({ items: z.array(productCopyJobDtoSchema) }),
});
