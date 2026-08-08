"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Plus } from "lucide-react";
import type {
  PaymentGatewayResponse,
  PaymentGatewayView,
} from "@atlas/domain-config/schemas/payment-gateway";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { PaymentGatewayAddModal } from "./PaymentGatewayAddModal";
import { PaymentGatewayLogo } from "./PaymentGatewayLogo";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function PaymentGatewayListPanel({
  initialGateways,
}: {
  initialGateways: PaymentGatewayView[];
}) {
  const [gateways, setGateways] = useState(initialGateways);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const addedKeys = new Set(gateways.map((gateway) => gateway.gatewayKey));

  async function onAdd(gatewayKey: string) {
    setAdding(true);
    setAddError(null);
    try {
      const response = await clientApi.post<PaymentGatewayResponse>(
        "/api/v1/learner-billing/payment-gateways",
        { gatewayKey },
        "add-payment-gateway",
        { successMessage: "Payment gateway added." },
      );
      setGateways((current) => {
        const next = current.filter((gateway) => gateway.id !== response.data.id);
        return [...next, response.data];
      });
      setAddOpen(false);
    } catch (caught) {
      setAddError(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not add the payment gateway. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Payment Gateway
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Manage the payment gateways your school uses to collect learner payments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Payment Gateway
        </button>
      </header>

      {gateways.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">No payment gateways yet</p>
          <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Add a payment gateway to start collecting payments from your learners.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)]">
                {["Payment Gateway", "Updated On", "Configuration Status", "Status", ""].map(
                  (heading, index) => (
                    <th
                      key={heading || `col-${String(index)}`}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {gateways.map((gateway) => (
                <tr key={gateway.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <PaymentGatewayLogo gatewayKey={gateway.gatewayKey} name={gateway.displayName} />
                      <span className="font-semibold text-[var(--admin-on-surface)]">
                        {gateway.displayName}
                      </span>
                      {gateway.isDefault ? (
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold text-[var(--admin-success)]">
                          Default
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[var(--admin-on-surface-variant)]">
                    {formatDate(gateway.updatedAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    {gateway.isConfigured ? (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-2 py-0.5 text-xs font-semibold text-[var(--admin-success)]">
                        Configured
                      </span>
                    ) : (
                      <span className="text-[var(--admin-on-surface-variant)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        gateway.isPublished
                          ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"
                          : "bg-[color-mix(in_srgb,var(--admin-danger)_14%,var(--admin-surface))] text-[var(--admin-danger)]"
                      }`}
                    >
                      {gateway.isPublished ? "Published" : "Unpublished"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <Link
                      href={`/admin/learner-billing/payment-gateway/${gateway.id}/configure`}
                      prefetch={false}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                    >
                      Configure
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentGatewayAddModal
        open={addOpen}
        addedKeys={addedKeys}
        busy={adding}
        error={addError}
        onSave={(gatewayKey) => void onAdd(gatewayKey)}
        onCancel={() => {
          if (!adding) setAddOpen(false);
        }}
      />
    </div>
  );
}
