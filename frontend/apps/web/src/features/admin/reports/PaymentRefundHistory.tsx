import type { PaymentTransactionDetail } from "./admin-payments-roster-api";
import { formatAbsolute, formatMoney } from "./payment-transaction-ui";
import { refundOutcomeTitle } from "./refund-submission";

export function PaymentRefundHistory({
  refunds,
  currency,
}: {
  refunds: PaymentTransactionDetail["refunds"];
  currency: string;
}) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        Refund requests and adjustments
      </h3>
      {refunds.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-on-surface-variant)]">
          No refund requests or adjustments on this order yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {refunds.map((refund) => (
            <li
              key={refund.id}
              className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4"
            >
              <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                {refundOutcomeTitle(refund.status)}
              </p>
              <p className="mt-1 font-mono text-sm text-[var(--admin-on-surface)]">
                {formatMoney(refund.amountCents, currency)} · {refund.reason.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                Fulfillment: {refund.fulfillment.replace(/_/g, " ")}
              </p>
              {refund.gatewayRefundId ? (
                <p className="mt-1 break-all font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Gateway refund ID: {refund.gatewayRefundId}
                </p>
              ) : null}
              {refund.note ? (
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">{refund.note}</p>
              ) : null}
              <p className="mt-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                {formatAbsolute(refund.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
