import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createPaymentOrderBodySchema,
  createPaymentOrderResponseSchema,
  listPaymentOrdersQuerySchema,
  listPaymentOrdersResponseSchema,
  stripeWebhookBodySchema,
  stripeWebhookResponseSchema,
} from "./payments.dto";
import { paymentsRosterRepository } from "../reports/payments-roster.repository";
import { paymentOrderNotFound } from "./payments.errors";
import { paymentsRepository, type PaymentOrderRow } from "./payments.repository";

function toDto(row: PaymentOrderRow) {
  return {
    id: row.id,
    membershipId: row.membership_id,
    externalId: row.external_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    paidAt: row.paid_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createPaymentOrder(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body = createPaymentOrderBodySchema.parse(rawBody);
  const row = await paymentsRepository.insertOrder(tx, {
    membershipId: body.membershipId ?? ctx.actorMembershipId,
    externalId: body.externalId ?? null,
    amountCents: body.amountCents,
    currency: body.currency,
    status: body.status,
    metadataJson: body.metadataJson,
  });

  return createPaymentOrderResponseSchema.parse({ data: toDto(row) });
}

export async function listPaymentOrders(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = listPaymentOrdersQuerySchema.parse(rawQuery);
  const rows = await paymentsRepository.listOrders(tx, {
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const items = rows.slice(0, query.limit).map(toDto);

  return listPaymentOrdersResponseSchema.parse({
    data: {
      items,
      pageInfo: {
        nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function handleStripeWebhook(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = stripeWebhookBodySchema.parse(rawBody);
  const current = await paymentsRepository.findByExternalId(tx, body.externalId);
  if (!current) {
    throw paymentOrderNotFound();
  }

  const invoiceNumber =
    body.status === "paid" && !current.invoice_number
      ? await paymentsRosterRepository.allocateInvoiceNumber(tx)
      : null;

  const row = await paymentsRepository.updateOrderByExternalId(tx, {
    externalId: body.externalId,
    status: body.status,
    paidAt: body.paidAt ? new Date(body.paidAt) : body.status === "paid" ? new Date() : null,
    invoiceNumber,
  });

  if (!row) {
    throw paymentOrderNotFound();
  }

  return stripeWebhookResponseSchema.parse({
    data: { updated: true, orderId: row.id },
  });
}
