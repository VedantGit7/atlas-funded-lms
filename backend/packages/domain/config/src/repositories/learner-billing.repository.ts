import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";

export type LearnerBillingConfigRow = {
  pricing_model: string | null;
  home_currency: string | null;
  gst_enabled: boolean;
  gst_number: string | null;
  gst_percentage: number | null;
  invoice_prefix: string | null;
  invoice_next_number: number | null;
  invoice_business_name: string | null;
  request_billing_address: boolean;
  request_shipping_address: boolean;
  request_gstin: boolean;
  request_mobile: boolean;
  updated_at: Date;
};

export async function getLearnerBillingConfigRow(
  tx: TenantTx,
): Promise<LearnerBillingConfigRow | null> {
  const rows = await tx.$queryRaw<LearnerBillingConfigRow[]>`
    SELECT
      pricing_model,
      home_currency,
      gst_enabled,
      gst_number,
      gst_percentage::float8 AS gst_percentage,
      invoice_prefix,
      invoice_next_number,
      invoice_business_name,
      request_billing_address,
      request_shipping_address,
      request_gstin,
      request_mobile,
      updated_at
    FROM learner_billing_config
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertPricingModel(tx: TenantTx, pricingModel: string): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO learner_billing_config (tenant_id, pricing_model, updated_at)
    VALUES (current_setting('app.tenant_id')::uuid, ${pricingModel}, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET pricing_model = ${pricingModel}, updated_at = now()
  `;
}

export async function upsertHomeCurrency(tx: TenantTx, currency: string): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO learner_billing_config (tenant_id, home_currency, updated_at)
    VALUES (current_setting('app.tenant_id')::uuid, ${currency}, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET home_currency = ${currency}, updated_at = now()
  `;
}

export async function upsertGst(
  tx: TenantTx,
  args: { enabled: boolean; number: string | null; percentage: number | null },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO learner_billing_config (tenant_id, gst_enabled, gst_number, gst_percentage, updated_at)
    VALUES (current_setting('app.tenant_id')::uuid, ${args.enabled}, ${args.number}, ${args.percentage}, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      gst_enabled = ${args.enabled},
      gst_number = ${args.number},
      gst_percentage = ${args.percentage},
      updated_at = now()
  `;
}

export async function upsertInvoice(
  tx: TenantTx,
  args: { prefix: string; nextNumber: number; businessName: string },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO learner_billing_config (tenant_id, invoice_prefix, invoice_next_number, invoice_business_name, updated_at)
    VALUES (current_setting('app.tenant_id')::uuid, ${args.prefix}, ${args.nextNumber}, ${args.businessName}, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      invoice_prefix = ${args.prefix},
      invoice_next_number = ${args.nextNumber},
      invoice_business_name = ${args.businessName},
      updated_at = now()
  `;
}

export async function upsertLearnerConfig(
  tx: TenantTx,
  args: {
    requestBillingAddress: boolean;
    requestShippingAddress: boolean;
    requestGstin: boolean;
    requestMobile: boolean;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO learner_billing_config (
      tenant_id, request_billing_address, request_shipping_address, request_gstin, request_mobile, updated_at
    )
    VALUES (
      current_setting('app.tenant_id')::uuid,
      ${args.requestBillingAddress},
      ${args.requestShippingAddress},
      ${args.requestGstin},
      ${args.requestMobile},
      now()
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      request_billing_address = ${args.requestBillingAddress},
      request_shipping_address = ${args.requestShippingAddress},
      request_gstin = ${args.requestGstin},
      request_mobile = ${args.requestMobile},
      updated_at = now()
  `;
}

export type BillingLocationRow = {
  id: string;
  name: string;
  country: string;
  currency: string;
  description: string | null;
  status: string;
  is_default: boolean;
  updated_at: Date;
};

export async function listBillingLocationRows(tx: TenantTx): Promise<BillingLocationRow[]> {
  return tx.$queryRaw<BillingLocationRow[]>`
    SELECT id::text, name, country, currency, description, status, is_default, updated_at
    FROM learner_billing_locations
    ORDER BY is_default DESC, name ASC
  `;
}

export async function countBillingLocations(tx: TenantTx): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count FROM learner_billing_locations
  `;
  return rows[0]?.count ?? 0;
}

const ROW_DEFAULT_DESCRIPTION =
  "In this location, any currency added is accessible to all learners in regions where a specific location has not been set.";

/** Ensures the tenant has the default "Rest Of The World" location (idempotent). */
export async function ensureRestOfWorldLocation(
  tx: TenantTx,
  currency: string,
): Promise<void> {
  const existing = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id::text FROM learner_billing_locations WHERE country = 'ROW' LIMIT 1
  `;
  if (existing[0]) {
    return;
  }
  await tx.$executeRaw`
    INSERT INTO learner_billing_locations (id, tenant_id, name, country, currency, description, status, is_default, updated_at)
    VALUES (
      ${randomUUID()}::uuid,
      current_setting('app.tenant_id')::uuid,
      'Rest Of The World',
      'ROW',
      ${currency},
      ${ROW_DEFAULT_DESCRIPTION},
      'published',
      true,
      now()
    )
  `;
}

export async function insertBillingLocation(
  tx: TenantTx,
  args: { title: string; locationKey: string; currency: string; description: string | null },
): Promise<BillingLocationRow> {
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO learner_billing_locations (id, tenant_id, name, country, currency, description, status, is_default, updated_at)
    VALUES (
      ${id}::uuid,
      current_setting('app.tenant_id')::uuid,
      ${args.title},
      ${args.locationKey},
      ${args.currency},
      ${args.description},
      'published',
      false,
      now()
    )
  `;
  const rows = await tx.$queryRaw<BillingLocationRow[]>`
    SELECT id::text, name, country, currency, description, status, is_default, updated_at
    FROM learner_billing_locations
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to add billing location.");
  }
  return row;
}
