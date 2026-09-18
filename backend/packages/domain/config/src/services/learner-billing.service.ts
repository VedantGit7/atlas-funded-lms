import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import {
  countBillingLocations,
  ensureRestOfWorldLocation,
  findBillingLocationByCountry,
  getLearnerBillingConfigRow,
  highestIssuedInvoiceSequence,
  insertBillingLocation,
  listBillingLocationRows,
  upsertGst,
  upsertHomeCurrency,
  upsertInvoice,
  upsertLearnerConfig,
  upsertPricingModel,
  type BillingLocationRow,
  type LearnerBillingConfigRow,
} from "../repositories/learner-billing.repository";
import {
  PricingModelSchema,
  formatInvoiceNumber,
  type BillingLocationListResponse,
  type BillingLocationView,
  type LearnerBillingConfigResponse,
  type PricingModel,
  type UpdateGstRequest,
  type UpdateInvoiceRequest,
  type UpdateLearnerConfigRequest,
} from "../schemas/learner-billing";

function toPricingModel(value: string | null): PricingModel | null {
  if (value === null) {
    return null;
  }
  const parsed = PricingModelSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toResponse(row: LearnerBillingConfigRow | null): LearnerBillingConfigResponse {
  return {
    data: {
      pricingModel: toPricingModel(row?.pricing_model ?? null),
      homeCurrency: row?.home_currency ?? null,
      gst: {
        enabled: row?.gst_enabled ?? false,
        number: row?.gst_number ?? null,
        percentage: row?.gst_percentage ?? null,
      },
      invoice: {
        prefix: row?.invoice_prefix ?? null,
        nextNumber: row?.invoice_next_number ?? null,
        businessName: row?.invoice_business_name ?? null,
      },
      learnerConfig: {
        requestBillingAddress: row?.request_billing_address ?? false,
        requestShippingAddress: row?.request_shipping_address ?? false,
        requestGstin: row?.request_gstin ?? false,
        requestMobile: row?.request_mobile ?? false,
      },
      updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
    },
  };
}

export async function readLearnerBillingConfig(
  tx: TenantTx,
): Promise<LearnerBillingConfigResponse> {
  return toResponse(await getLearnerBillingConfigRow(tx));
}

export async function updateLearnerBillingPricingModel(
  tx: TenantTx,
  pricingModel: PricingModel,
): Promise<LearnerBillingConfigResponse> {
  await upsertPricingModel(tx, pricingModel);
  return readLearnerBillingConfig(tx);
}

export async function updateLearnerBillingHomeCurrency(
  tx: TenantTx,
  currency: string,
): Promise<LearnerBillingConfigResponse> {
  await upsertHomeCurrency(tx, currency);
  return readLearnerBillingConfig(tx);
}

export async function updateLearnerBillingGst(
  tx: TenantTx,
  input: UpdateGstRequest,
): Promise<LearnerBillingConfigResponse> {
  await upsertGst(tx, {
    enabled: input.enabled,
    // An emptied field is an absent GSTIN, not a stored empty string — the
    // config read maps null to "not set" and "" would read as set-but-blank.
    number: input.number === null || input.number === "" ? null : input.number,
    percentage: input.percentage,
  });
  return readLearnerBillingConfig(tx);
}

export async function updateLearnerBillingInvoice(
  tx: TenantTx,
  input: UpdateInvoiceRequest,
): Promise<LearnerBillingConfigResponse> {
  // Winding the counter back below what has already been printed would give a
  // second order an invoice number a first order already carries — and nothing
  // in the database prevents that, since invoice_number is only indexed, not
  // unique. Two orders sharing a number is an accounting problem that cannot be
  // undone once both invoices are out.
  const highest = await highestIssuedInvoiceSequence(tx, input.prefix);
  if (highest !== null && input.nextNumber <= highest) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: `Invoice ${formatInvoiceNumber(input.prefix, highest)} has already been issued. The next number must be at least ${highest + 1}.`,
    });
  }

  await upsertInvoice(tx, {
    prefix: input.prefix,
    nextNumber: input.nextNumber,
    businessName: input.businessName,
  });
  return readLearnerBillingConfig(tx);
}

export async function updateLearnerConfig(
  tx: TenantTx,
  input: UpdateLearnerConfigRequest,
): Promise<LearnerBillingConfigResponse> {
  await upsertLearnerConfig(tx, {
    requestBillingAddress: input.requestBillingAddress,
    requestShippingAddress: input.requestShippingAddress,
    requestGstin: input.requestGstin,
    requestMobile: input.requestMobile,
  });
  return readLearnerBillingConfig(tx);
}

function toLocationView(row: BillingLocationRow): BillingLocationView {
  return {
    id: row.id,
    title: row.name,
    locationKey: row.country,
    currency: row.currency,
    description: row.description,
    status: row.status,
    isDefault: row.is_default,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listBillingLocations(tx: TenantTx): Promise<BillingLocationListResponse> {
  // Guarantee the default "Rest Of The World" location exists, seeded with the
  // tenant's home currency (falls back to USD before a home currency is set).
  if ((await countBillingLocations(tx)) === 0) {
    const config = await getLearnerBillingConfigRow(tx);
    await ensureRestOfWorldLocation(tx, config?.home_currency ?? "USD");
  }
  const rows = await listBillingLocationRows(tx);
  return { data: rows.map(toLocationView) };
}

export async function addBillingLocation(
  tx: TenantTx,
  input: { locationKey: string; title: string; currency: string; description: string | null },
): Promise<{ data: BillingLocationView }> {
  // One location per country. A second row for the same country is not a
  // richer configuration, it is an ambiguity: two currencies would both claim
  // the same region and nothing decides between them.
  const existing = await findBillingLocationByCountry(tx, input.locationKey);
  if (existing !== null) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: `${existing.name} already has a location, charging in ${existing.currency}. Remove it before adding another for the same region.`,
    });
  }

  const row = await insertBillingLocation(tx, input);
  return { data: toLocationView(row) };
}
