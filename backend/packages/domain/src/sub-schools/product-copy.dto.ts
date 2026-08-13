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
    sourceProductId: z.uuid(),
    sourceProductTitle: z.string().min(1).max(200),
    destinationProductName: z.string().min(1).max(200),
    sectionIds: z.array(z.uuid()).max(500).optional(),
  })
  .strict();

export const productCopyJobDtoSchema = z
  .object({
    id: z.uuid(),
    destinationSubSchoolId: z.uuid(),
    productType: z.enum(PRODUCT_COPY_TYPES),
    sourceProductId: z.uuid(),
    sourceProductTitle: z.string(),
    destinationProductName: z.string(),
    sectionIds: z.array(z.uuid()).nullable(),
    resultProductId: z.uuid().nullable(),
    status: z.enum(PRODUCT_COPY_STATUSES),
    errorMessage: z.string().nullable(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const productCopyJobResponseSchema = z.object({ data: productCopyJobDtoSchema });
export const productCopyJobListResponseSchema = z.object({
  data: z.object({ items: z.array(productCopyJobDtoSchema) }),
});
