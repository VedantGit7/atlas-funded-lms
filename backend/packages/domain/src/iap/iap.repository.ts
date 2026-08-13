import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { PaymentOrderRow } from "../payments/payments.repository";
import { paymentsRepository } from "../payments/payments.repository";

export type IapCourseRow = {
  id: string;
  title: string;
  status: string;
  metadata_json: Record<string, unknown> | null;
};

function mapPaymentOrder(row: PaymentOrderRow): PaymentOrderRow {
  return row;
}

export const iapRepository = {
  async findCourseById(tx: TenantTx, courseId: string): Promise<IapCourseRow | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        title: string;
        status: string;
        metadata_json: Record<string, unknown> | null;
      }>
    >`
      select
        c.id::text,
        c.title,
        c.status::text,
        c.metadata_json
      from courses c
      where c.id = ${courseId}::uuid
        and c.deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findPaymentOrderByExternalId(
    tx: TenantTx,
    externalId: string,
  ): Promise<PaymentOrderRow | null> {
    return paymentsRepository.findByExternalId(tx, externalId);
  },

  async insertPendingIapOrder(
    tx: TenantTx,
    args: {
      membershipId: string;
      externalId: string;
      amountCents: number;
      currency: string;
      gatewayKey: "apple_iap" | "google_play";
      productTitle: string;
      metadataJson: unknown;
    },
  ): Promise<PaymentOrderRow> {
    return paymentsRepository.insertOrder(tx, {
      membershipId: args.membershipId,
      externalId: args.externalId,
      amountCents: args.amountCents,
      currency: args.currency,
      status: "pending",
      gatewayKey: args.gatewayKey,
      productTitle: args.productTitle,
      productType: "course",
      metadataJson: args.metadataJson,
    });
  },

  async markOrderPaid(
    tx: TenantTx,
    args: { orderId: string; metadataPatch: Record<string, unknown> },
  ): Promise<PaymentOrderRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update payment_orders
      set
        status = 'paid',
        paid_at = coalesce(paid_at, now()),
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || ${JSON.stringify(args.metadataPatch)}::jsonb,
        updated_at = now()
      where id = ${args.orderId}::uuid
      returning *
    `;
    const row = rows[0];
    if (!row) return null;
    return mapPaymentOrder({
      id: String(row["id"]),
      tenant_id: String(row["tenant_id"]),
      membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
      external_id: typeof row["external_id"] === "string" ? row["external_id"] : null,
      amount_cents: Number(row["amount_cents"]),
      currency: String(row["currency"]),
      status: String(row["status"]),
      metadata_json: row["metadata_json"] ?? null,
      gateway_key: typeof row["gateway_key"] === "string" ? row["gateway_key"] : null,
      product_title: typeof row["product_title"] === "string" ? row["product_title"] : null,
      product_type: typeof row["product_type"] === "string" ? row["product_type"] : null,
      coupon_amount_cents:
        row["coupon_amount_cents"] == null ? null : Number(row["coupon_amount_cents"]),
      tax_amount_cents: row["tax_amount_cents"] == null ? null : Number(row["tax_amount_cents"]),
      invoice_number: typeof row["invoice_number"] === "string" ? row["invoice_number"] : null,
      billing_name: typeof row["billing_name"] === "string" ? row["billing_name"] : null,
      paid_at: row["paid_at"] instanceof Date ? row["paid_at"] : null,
      created_at: row["created_at"] as Date,
      updated_at: row["updated_at"] as Date,
    });
  },

  async findActiveEnrollment(
    tx: TenantTx,
    args: { courseId: string; membershipId: string },
  ): Promise<{ id: string } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select e.id::text
      from enrollments e
      where e.course_id = ${args.courseId}::uuid
        and e.membership_id = ${args.membershipId}::uuid
        and e.status = 'active'
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertEnrollment(
    tx: TenantTx,
    args: { tenantId: string; courseId: string; membershipId: string },
  ): Promise<{ id: string; created: boolean }> {
    const existing = await this.findActiveEnrollment(tx, {
      courseId: args.courseId,
      membershipId: args.membershipId,
    });
    if (existing) {
      return { id: existing.id, created: false };
    }

    const id = randomUUID();
    await tx.$executeRaw`
      insert into enrollments (
        id,
        tenant_id,
        course_id,
        membership_id,
        status,
        enrolled_type,
        enrolled_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.courseId}::uuid,
        ${args.membershipId}::uuid,
        'active',
        'paid',
        now()
      )
    `;
    return { id, created: true };
  },
};
