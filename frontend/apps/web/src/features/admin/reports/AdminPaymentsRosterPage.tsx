"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createPaymentInstalmentPlan,
  dateInputToEndIso,
  dateInputToStartIso,
  downloadPaymentInvoice,
  exportGatewayTransactions,
  exportPaymentInstalments,
  exportPaymentInvoices,
  exportPaymentTransactions,
  fetchGatewayTransactions,
  fetchPaymentGateways,
  fetchPaymentInstalmentDetail,
  fetchPaymentInstalments,
  fetchPaymentInvoices,
  fetchPaymentTransactions,
  payPaymentInstalment,
  PAYMENT_INSTALMENT_COLUMN_OPTIONS,
  PAYMENT_INVOICE_COLUMN_OPTIONS,
  PAYMENT_TRANSACTION_COLUMN_OPTIONS,
  type PaymentGatewayItem,
  type PaymentInstalmentColumnKey,
  type PaymentInstalmentPlanItem,
  type PaymentInstalmentScheduleItem,
  type PaymentInvoiceColumnKey,
  type PaymentInvoiceItem,
  type PaymentTransactionColumnKey,
  type PaymentTransactionItem,
} from "./admin-payments-roster-api";
import { AdminPaymentsOverviewPanel } from "./AdminPaymentsOverviewPanel";
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

type TabKey = "overview" | "transactions" | "instalment" | "gateways" | "invoices";

type ExtraFilter = {
  id: string;
  field: "learnerName" | "productType" | "email" | "status";
  value: string;
};

const VALID_TABS = new Set<TabKey>(["overview"]);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function downloadHtmlFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPaymentsRosterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabKey =
    tabParam && VALID_TABS.has(tabParam as TabKey) ? (tabParam as TabKey) : "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paidFrom, setPaidFrom] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [extraFilters, setExtraFilters] = useState<ExtraFilter[]>([]);
  const [sortBy, setSortBy] = useState("paid_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [txColumns, setTxColumns] = useState<PaymentTransactionColumnKey[]>(
    PAYMENT_TRANSACTION_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [invoiceColumns, setInvoiceColumns] = useState<PaymentInvoiceColumnKey[]>(
    PAYMENT_INVOICE_COLUMN_OPTIONS.map((column) => column.key),
  );
  const [instalmentColumns, setInstalmentColumns] = useState<PaymentInstalmentColumnKey[]>(
    PAYMENT_INSTALMENT_COLUMN_OPTIONS.map((column) => column.key),
  );

  const [transactions, setTransactions] = useState<PaymentTransactionItem[]>([]);
  const [invoices, setInvoices] = useState<PaymentInvoiceItem[]>([]);
  const [instalments, setInstalments] = useState<PaymentInstalmentPlanItem[]>([]);
  const [gateways, setGateways] = useState<PaymentGatewayItem[]>([]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayItem | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PaymentInstalmentPlanItem | null>(null);
  const [planSchedule, setPlanSchedule] = useState<PaymentInstalmentScheduleItem[]>([]);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [createMembershipId, setCreateMembershipId] = useState("");
  const [createProductTitle, setCreateProductTitle] = useState("");
  const [createPricingLabel, setCreatePricingLabel] = useState("2 instalments");
  const [createTotalCents, setCreateTotalCents] = useState("10000");
  const [createDue1, setCreateDue1] = useState("");
  const [createDue2, setCreateDue2] = useState("");

  const filterValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const filter of extraFilters) {
      if (filter.value.trim()) values[filter.field] = filter.value.trim();
    }
    return values;
  }, [extraFilters]);

  const loadData = useCallback(async () => {
    if (tab === "overview") {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === "transactions" || (tab === "gateways" && selectedGateway)) {
        const response = selectedGateway
          ? await fetchGatewayTransactions(selectedGateway.gatewayKey, {
              paidFrom: dateInputToStartIso(paidFrom),
              paidTo: dateInputToEndIso(paidTo),
              learnerName: filterValues.learnerName,
              productType: filterValues.productType,
              sortBy,
              sortDir,
              columns: txColumns,
              page,
              limit: 25,
            })
          : await fetchPaymentTransactions({
              paidFrom: dateInputToStartIso(paidFrom),
              paidTo: dateInputToEndIso(paidTo),
              learnerName: filterValues.learnerName,
              productType: filterValues.productType,
              status: filterValues.status,
              sortBy,
              sortDir,
              columns: txColumns,
              page,
              limit: 25,
            });
        setTransactions(response.data.items);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
      } else if (tab === "gateways") {
        const response = await fetchPaymentGateways();
        setGateways(response.data.items);
        setTotalCount(response.data.items.length);
        setTotalPages(1);
      } else if (tab === "invoices") {
        const response = await fetchPaymentInvoices({
          paidFrom: dateInputToStartIso(paidFrom),
          paidTo: dateInputToEndIso(paidTo),
          learnerName: filterValues.learnerName,
          email: filterValues.email,
          sortBy,
          sortDir,
          columns: invoiceColumns,
          page,
          limit: 25,
        });
        setInvoices(response.data.items);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
      } else if (tab === "instalment") {
        const response = await fetchPaymentInstalments({
          learnerName: filterValues.learnerName,
          email: filterValues.email,
          status: filterValues.status,
          sortBy: sortBy === "paid_at" ? "created_at" : sortBy,
          sortDir,
          columns: instalmentColumns,
          page,
          limit: 25,
        });
        setInstalments(response.data.items);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
      }
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load payments report.",
      );
      setTransactions([]);
      setInvoices([]);
      setInstalments([]);
      setGateways([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    filterValues.email,
    filterValues.learnerName,
    filterValues.productType,
    filterValues.status,
    instalmentColumns,
    invoiceColumns,
    page,
    paidFrom,
    paidTo,
    selectedGateway,
    sortBy,
    sortDir,
    tab,
    txColumns,
  ]);

  useEffect(() => {
    if (tabParam === "transactions") {
      router.replace("/admin/reports/payments/transactions");
      return;
    }
    if (tabParam === "invoices") {
      router.replace("/admin/reports/payments/invoices");
      return;
    }
    if (tabParam === "instalment") {
      router.replace("/admin/reports/payments/instalments");
      return;
    }
    if (tabParam === "gateways") {
      router.replace("/admin/reports/payments/gateways");
      return;
    }
    if (tabParam && VALID_TABS.has(tabParam as TabKey)) {
      setTab(tabParam as TabKey);
    }
  }, [router, tabParam]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function switchTab(next: TabKey) {
    if (next === "transactions") {
      router.push("/admin/reports/payments/transactions");
      return;
    }
    if (next === "invoices") {
      router.push("/admin/reports/payments/invoices");
      return;
    }
    if (next === "instalment") {
      router.push("/admin/reports/payments/instalments");
      return;
    }
    if (next === "gateways") {
      router.push("/admin/reports/payments/gateways");
      return;
    }
    setTab(next);
    setPage(1);
    setSelectedGateway(null);
    setSelectedPlan(null);
    setPlanSchedule([]);
    setExtraFilters([]);
    if (next === "instalment") setSortBy("created_at");
    else if (next === "invoices") setSortBy("paid_at");
    else setSortBy("paid_at");
    const url =
      next === "overview"
        ? "/admin/reports/payments"
        : `/admin/reports/payments?tab=${next}`;
    router.replace(url);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const common = {
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        learnerName: filterValues.learnerName,
        email: filterValues.email,
        productType: filterValues.productType,
        status: filterValues.status,
        sortBy,
        sortDir,
        emailDownloadLink: true,
      };
      let runId: string;
      if (tab === "invoices") {
        const response = await exportPaymentInvoices({ ...common, columns: invoiceColumns });
        runId = response.data.runId;
      } else if (tab === "instalment") {
        const response = await exportPaymentInstalments({
          ...common,
          columns: instalmentColumns,
        });
        runId = response.data.runId;
      } else if (tab === "gateways" && selectedGateway) {
        const response = await exportGatewayTransactions(selectedGateway.gatewayKey, {
          ...common,
          columns: txColumns,
        });
        runId = response.data.runId;
      } else {
        const response = await exportPaymentTransactions({
          ...common,
          columns: txColumns,
        });
        runId = response.data.runId;
      }
      const completed = await pollReportRunUntilComplete(runId);
      if (completed.status === "completed") {
        await downloadReportExport(runId, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export payments report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPlan(plan: PaymentInstalmentPlanItem) {
    setSelectedPlan(plan);
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPaymentInstalmentDetail(plan.id);
      setSelectedPlan(response.data.plan);
      setPlanSchedule(response.data.instalments);
    } catch (detailError) {
      setError(
        detailError instanceof ClientApiError
          ? detailError.message
          : detailError instanceof Error
            ? detailError.message
            : "Unable to load instalment history.",
      );
      setPlanSchedule([]);
    } finally {
      setBusy(false);
    }
  }

  async function handlePayNextInstalment() {
    if (!selectedPlan) return;
    setBusy(true);
    setError(null);
    try {
      await payPaymentInstalment(selectedPlan.id);
      await openPlan(selectedPlan);
      await loadData();
    } catch (payError) {
      setError(
        payError instanceof ClientApiError
          ? payError.message
          : payError instanceof Error
            ? payError.message
            : "Unable to record instalment payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePlan() {
    const total = Number(createTotalCents);
    if (!createMembershipId.trim() || !createProductTitle.trim() || !Number.isFinite(total)) {
      setError("Membership, product title, and total amount are required.");
      return;
    }
    const half = Math.floor(total / 2);
    const second = total - half;
    const due1 = createDue1.trim()
      ? `${createDue1}T00:00:00.000Z`
      : new Date().toISOString();
    const due2 = createDue2.trim()
      ? `${createDue2}T00:00:00.000Z`
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    setBusy(true);
    setError(null);
    try {
      await createPaymentInstalmentPlan({
        membershipId: createMembershipId.trim(),
        productTitle: createProductTitle.trim(),
        pricingPlanLabel: createPricingLabel.trim() || undefined,
        totalAmountCents: total,
        instalments: [
          { amountCents: half, dueAt: due1 },
          { amountCents: second, dueAt: due2 },
        ],
      });
      setCreatePlanOpen(false);
      setCreateMembershipId("");
      setCreateProductTitle("");
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof ClientApiError
          ? createError.message
          : createError instanceof Error
            ? createError.message
            : "Unable to create instalment plan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadInvoice(orderId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await downloadPaymentInvoice(orderId);
      downloadHtmlFile(response.data.filename, response.data.content);
    } catch (downloadError) {
      setError(
        downloadError instanceof ClientApiError
          ? downloadError.message
          : downloadError instanceof Error
            ? downloadError.message
            : "Unable to download invoice.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleColumn<T extends string>(
    columns: T[],
    key: T,
    setter: (next: T[]) => void,
    allKeys: readonly T[],
  ) {
    if (columns.includes(key)) {
      const next = columns.filter((column) => column !== key);
      setter(next.length > 0 ? next : [...allKeys]);
      return;
    }
    setter([...columns, key]);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active={tab} />

      {tab === "overview" ? (
        <AdminPaymentsOverviewPanel
            onNavigateTab={(next) => {
              if (next === "transactions") {
                router.push("/admin/reports/payments/transactions");
                return;
              }
              switchTab(next);
            }}
            onRecordPayment={() => {
              switchTab("instalment");
              setCreatePlanOpen(true);
            }}
          />
      ) : (
        <>
      <div>
        <h1 className={generalSettingsPageTitleClassName}>Payments</h1>
        <p className={generalSettingsPageDescClassName}>
          Review transactions, instalment plans, gateway activity, and invoices.
        </p>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      <section className={generalSettingsFormCardClassName}>
        <div className="flex flex-wrap items-end gap-3">
          {(tab === "invoices" || (tab === "gateways" && selectedGateway)) && (
            <>
              <label className="grid gap-1 text-sm">
                From
                <input
                  type="date"
                  className={fieldClassName}
                  value={paidFrom}
                  onChange={(event) => {
                    setPaidFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="grid gap-1 text-sm">
                To
                <input
                  type="date"
                  className={fieldClassName}
                  value={paidTo}
                  onChange={(event) => {
                    setPaidTo(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </>
          )}

          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() =>
              setExtraFilters((current) => [
                ...current,
                {
                  id: `${Date.now()}`,
                  field: tab === "invoices" || tab === "instalment" ? "email" : "learnerName",
                  value: "",
                },
              ])
            }
          >
            Add filter
          </button>

          {(tab === "gateways" && selectedGateway) && (
            <label className="grid gap-1 text-sm">
              Sort
              <select
                className={fieldClassName}
                value={`${sortBy}:${sortDir}`}
                onChange={(event) => {
                  const [nextSort, nextDir] = event.target.value.split(":") as [
                    string,
                    "asc" | "desc",
                  ];
                  setSortBy(nextSort);
                  setSortDir(nextDir);
                }}
              >
                <option value="paid_at:desc">Transaction date ↓</option>
                <option value="paid_at:asc">Transaction date ↑</option>
                <option value="coupon_amount_cents:desc">Coupon amount ↓</option>
                <option value="coupon_amount_cents:asc">Coupon amount ↑</option>
                <option value="amount_cents:desc">Amount ↓</option>
                <option value="amount_cents:asc">Amount ↑</option>
              </select>
            </label>
          )}

          {tab !== "gateways" || selectedGateway ? (
            <button
              type="button"
              className={analyticsExportButtonClassName}
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              Export CSV
            </button>
          ) : null}

          {tab === "instalment" ? (
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => setCreatePlanOpen((open) => !open)}
            >
              {createPlanOpen ? "Close create" : "Create plan"}
            </button>
          ) : null}

          {tab === "gateways" && selectedGateway ? (
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={() => {
                setSelectedGateway(null);
                setPage(1);
              }}
            >
              Back to gateways
            </button>
          ) : null}
        </div>

        {extraFilters.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {extraFilters.map((filter) => (
              <div key={filter.id} className="flex flex-wrap items-end gap-2">
                <select
                  className={fieldClassName}
                  value={filter.field}
                  onChange={(event) =>
                    setExtraFilters((current) =>
                      current.map((item) =>
                        item.id === filter.id
                          ? {
                              ...item,
                              field: event.target.value as ExtraFilter["field"],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  <option value="learnerName">Name</option>
                  <option value="email">Email</option>
                  <option value="productType">Product type</option>
                  <option value="status">Status</option>
                </select>
                <input
                  className={fieldClassName}
                  value={filter.value}
                  placeholder="Filter value"
                  onChange={(event) =>
                    setExtraFilters((current) =>
                      current.map((item) =>
                        item.id === filter.id ? { ...item, value: event.target.value } : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() =>
                    setExtraFilters((current) => current.filter((item) => item.id !== filter.id))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {(tab === "transactions" || (tab === "gateways" && selectedGateway)) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {PAYMENT_TRANSACTION_COLUMN_OPTIONS.map((column) => (
              <label key={column.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={txColumns.includes(column.key)}
                  onChange={() =>
                    toggleColumn(
                      txColumns,
                      column.key,
                      setTxColumns,
                      PAYMENT_TRANSACTION_COLUMN_OPTIONS.map((item) => item.key),
                    )
                  }
                />
                {column.label}
              </label>
            ))}
          </div>
        )}

        {tab === "invoices" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {PAYMENT_INVOICE_COLUMN_OPTIONS.map((column) => (
              <label key={column.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={invoiceColumns.includes(column.key)}
                  onChange={() =>
                    toggleColumn(
                      invoiceColumns,
                      column.key,
                      setInvoiceColumns,
                      PAYMENT_INVOICE_COLUMN_OPTIONS.map((item) => item.key),
                    )
                  }
                />
                {column.label}
              </label>
            ))}
          </div>
        ) : null}

        {tab === "instalment" && createPlanOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className={fieldClassName}
              placeholder="Membership ID (UUID)"
              value={createMembershipId}
              onChange={(event) => setCreateMembershipId(event.target.value)}
            />
            <input
              className={fieldClassName}
              placeholder="Product title"
              value={createProductTitle}
              onChange={(event) => setCreateProductTitle(event.target.value)}
            />
            <input
              className={fieldClassName}
              placeholder="Pricing plan label"
              value={createPricingLabel}
              onChange={(event) => setCreatePricingLabel(event.target.value)}
            />
            <input
              className={fieldClassName}
              placeholder="Total amount (cents)"
              value={createTotalCents}
              onChange={(event) => setCreateTotalCents(event.target.value)}
            />
            <input
              type="date"
              className={fieldClassName}
              value={createDue1}
              onChange={(event) => setCreateDue1(event.target.value)}
            />
            <input
              type="date"
              className={fieldClassName}
              value={createDue2}
              onChange={(event) => setCreateDue2(event.target.value)}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={busy}
              onClick={() => void handleCreatePlan()}
            >
              Save plan
            </button>
          </div>
        ) : null}
      </section>

      <section className={analyticsTableShellClassName}>
        {loading ? (
          <p className="p-4 text-sm text-neutral-600">Loading…</p>
        ) : tab === "gateways" && !selectedGateway ? (
          <table className="w-full text-left text-sm">
            <thead className={analyticsTableHeadClassName}>
              <tr>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transactions</th>
                <th className="px-4 py-3">Paid volume</th>
              </tr>
            </thead>
            <tbody>
              {gateways.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={4}>
                    No payment gateways configured yet.
                  </td>
                </tr>
              ) : (
                gateways.map((gateway) => (
                  <tr
                    key={gateway.id}
                    className={`${analyticsTableRowClassName} cursor-pointer`}
                    onClick={() => {
                      setSelectedGateway(gateway);
                      setPage(1);
                    }}
                  >
                    <td className="px-4 py-3">
                      {gateway.displayName}
                      {gateway.isDefault ? " (default)" : ""}
                    </td>
                    <td className="px-4 py-3">
                      {gateway.isPublished
                        ? "Published"
                        : gateway.isConfigured
                          ? "Configured"
                          : "Draft"}
                    </td>
                    <td className="px-4 py-3">{gateway.transactionCount}</td>
                    <td className="px-4 py-3">{formatMoney(gateway.paidAmountCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : tab === "invoices" ? (
          <table className="w-full text-left text-sm">
            <thead className={analyticsTableHeadClassName}>
              <tr>
                {invoiceColumns.includes("invoice_number") ? (
                  <th className="px-4 py-3">Invoice #</th>
                ) : null}
                {invoiceColumns.includes("learner_name") ? (
                  <th className="px-4 py-3">Learner</th>
                ) : null}
                {invoiceColumns.includes("product_title") ? (
                  <th className="px-4 py-3">Product</th>
                ) : null}
                {invoiceColumns.includes("amount_cents") ? (
                  <th className="px-4 py-3">Price</th>
                ) : null}
                {invoiceColumns.includes("tax_amount_cents") ? (
                  <th className="px-4 py-3">Tax</th>
                ) : null}
                {invoiceColumns.includes("paid_at") ? <th className="px-4 py-3">Date</th> : null}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={7}>
                    No invoices yet. Paid orders receive invoice numbers automatically.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className={analyticsTableRowClassName}>
                    {invoiceColumns.includes("invoice_number") ? (
                      <td className="px-4 py-3">{invoice.invoiceNumber}</td>
                    ) : null}
                    {invoiceColumns.includes("learner_name") ? (
                      <td className="px-4 py-3">
                        {invoice.membershipId ? (
                          <Link
                            href={`/admin/members/${invoice.membershipId}`}
                            className="underline"
                          >
                            {invoice.learnerName ?? invoice.email ?? "Learner"}
                          </Link>
                        ) : (
                          (invoice.learnerName ?? "—")
                        )}
                      </td>
                    ) : null}
                    {invoiceColumns.includes("product_title") ? (
                      <td className="px-4 py-3">{invoice.productTitle ?? "—"}</td>
                    ) : null}
                    {invoiceColumns.includes("amount_cents") ? (
                      <td className="px-4 py-3">
                        {formatMoney(invoice.amountCents, invoice.currency)}
                      </td>
                    ) : null}
                    {invoiceColumns.includes("tax_amount_cents") ? (
                      <td className="px-4 py-3">
                        {formatMoney(invoice.taxAmountCents, invoice.currency)}
                      </td>
                    ) : null}
                    {invoiceColumns.includes("paid_at") ? (
                      <td className="px-4 py-3">{formatDate(invoice.paidAt)}</td>
                    ) : null}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        disabled={busy}
                        onClick={() => void handleDownloadInvoice(invoice.id)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : tab === "instalment" ? (
          selectedPlan ? (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">{selectedPlan.productTitle}</h2>
                  <p className="text-sm text-neutral-600">
                    {selectedPlan.learnerName ?? selectedPlan.email} · Remaining{" "}
                    {formatMoney(selectedPlan.remainingAmountCents, selectedPlan.currency)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    onClick={() => {
                      setSelectedPlan(null);
                      setPlanSchedule([]);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={busy || selectedPlan.status === "completed"}
                    onClick={() => void handlePayNextInstalment()}
                  >
                    Record next payment
                  </button>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {planSchedule.map((item) => (
                    <tr key={item.id} className={analyticsTableRowClassName}>
                      <td className="px-4 py-3">{item.sequenceNo}</td>
                      <td className="px-4 py-3">
                        {formatMoney(item.amountCents, selectedPlan.currency)}
                      </td>
                      <td className="px-4 py-3">{formatDate(item.dueAt)}</td>
                      <td className="px-4 py-3">{formatDate(item.paidAt)}</td>
                      <td className="px-4 py-3">{titleCase(item.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className={analyticsTableHeadClassName}>
                <tr>
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Pricing</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {instalments.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500" colSpan={5}>
                      No instalment plans yet. Create a plan to track remaining balances.
                    </td>
                  </tr>
                ) : (
                  instalments.map((plan) => (
                    <tr
                      key={plan.id}
                      className={`${analyticsTableRowClassName} cursor-pointer`}
                      onClick={() => void openPlan(plan)}
                    >
                      <td className="px-4 py-3">{plan.learnerName ?? plan.email ?? "—"}</td>
                      <td className="px-4 py-3">{plan.productTitle}</td>
                      <td className="px-4 py-3">{plan.pricingPlanLabel ?? "—"}</td>
                      <td className="px-4 py-3">
                        {formatMoney(plan.remainingAmountCents, plan.currency)} /{" "}
                        {formatMoney(plan.totalAmountCents, plan.currency)}
                      </td>
                      <td className="px-4 py-3">{titleCase(plan.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )
        ) : (
          <table className="w-full text-left text-sm">
            <thead className={analyticsTableHeadClassName}>
              <tr>
                {txColumns.includes("learner_name") ? <th className="px-4 py-3">Learner</th> : null}
                {txColumns.includes("product_title") ? <th className="px-4 py-3">Product</th> : null}
                {txColumns.includes("product_type") ? <th className="px-4 py-3">Type</th> : null}
                {txColumns.includes("gateway_key") ? <th className="px-4 py-3">Gateway</th> : null}
                {txColumns.includes("coupon_amount_cents") ? (
                  <th className="px-4 py-3">Coupon</th>
                ) : null}
                {txColumns.includes("amount_cents") ? <th className="px-4 py-3">Amount</th> : null}
                {txColumns.includes("status") ? <th className="px-4 py-3">Status</th> : null}
                {txColumns.includes("paid_at") ? <th className="px-4 py-3">Date</th> : null}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={8}>
                    No transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`${analyticsTableRowClassName} cursor-pointer`}
                    onClick={() => {
                      if (tx.membershipId) router.push(`/admin/members/${tx.membershipId}`);
                    }}
                  >
                    {txColumns.includes("learner_name") ? (
                      <td className="px-4 py-3">{tx.learnerName ?? tx.email ?? "—"}</td>
                    ) : null}
                    {txColumns.includes("product_title") ? (
                      <td className="px-4 py-3">{tx.productTitle ?? "—"}</td>
                    ) : null}
                    {txColumns.includes("product_type") ? (
                      <td className="px-4 py-3">{titleCase(tx.productType)}</td>
                    ) : null}
                    {txColumns.includes("gateway_key") ? (
                      <td className="px-4 py-3">{tx.gatewayKey ?? "—"}</td>
                    ) : null}
                    {txColumns.includes("coupon_amount_cents") ? (
                      <td className="px-4 py-3">
                        {formatMoney(tx.couponAmountCents, tx.currency)}
                      </td>
                    ) : null}
                    {txColumns.includes("amount_cents") ? (
                      <td className="px-4 py-3">{formatMoney(tx.amountCents, tx.currency)}</td>
                    ) : null}
                    {txColumns.includes("status") ? (
                      <td className="px-4 py-3">{titleCase(tx.status)}</td>
                    ) : null}
                    {txColumns.includes("paid_at") ? (
                      <td className="px-4 py-3">{formatDate(tx.paidAt ?? tx.createdAt)}</td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-neutral-600">
            Page {page} of {totalPages} · {totalCount} rows
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={ghostButtonClassName}
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
        </>
      )}
    </div>
  );
}
