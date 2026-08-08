"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  alertErrorClassName,
  alertInfoClassName,
  fieldClassName,
  gamificationStatusBadgeClassName,
  labelClassName,
  outlineButtonClassName,
  panelBodyClassName,
  panelClassName,
  panelEyebrowClassName,
  panelHeaderClassName,
  primaryButtonClassName,
} from "../gamification-admin-shared";
import { GamificationSelectField } from "./GamificationSelectField";

export type RewardCurrency = {
  key: string;
  name: string;
  symbol: string | null;
  earnRules: { xpPerCoin?: number | null | undefined } | null;
};

export type RewardItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  costCurrencyKey: string;
  costAmount: number;
  rewardType: "CONTENT_UNLOCK" | "DISCOUNT_CODE" | "CERTIFICATE" | "CUSTOM";
  rewardPayload: {
    courseId?: string | undefined;
    code?: string | undefined;
    note?: string | undefined;
  };
  stock: number | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
};

type RedemptionLogItem = {
  id: string;
  rewardName: string;
  rewardType: string;
  memberLabel: string;
  costAmount: number;
  status: string;
  redeemedAt: string;
};

type MemberOption = { id: string; label: string };
type CourseOption = { id: string; title: string };

type RewardsShopPanelProps = {
  initialCurrencies: RewardCurrency[];
  initialItems: RewardItem[];
  members: MemberOption[];
  courses: CourseOption[];
};

const REWARD_TYPE_LABELS: Record<RewardItem["rewardType"], string> = {
  CONTENT_UNLOCK: "Unlock a course",
  DISCOUNT_CODE: "Discount code",
  CERTIFICATE: "Certificate (manual)",
  CUSTOM: "Custom (manual)",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function RewardsShopPanel({
  initialCurrencies,
  initialItems,
  members,
  courses,
}: RewardsShopPanelProps) {
  const [currencies, setCurrencies] = useState(initialCurrencies);
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Currency form
  const [currencyKey, setCurrencyKey] = useState(initialCurrencies[0]?.key ?? "coins");
  const [currencyName, setCurrencyName] = useState(initialCurrencies[0]?.name ?? "Coins");
  const [currencySymbol, setCurrencySymbol] = useState(initialCurrencies[0]?.symbol ?? "");
  const [xpPerCoin, setXpPerCoin] = useState<number>(
    initialCurrencies[0]?.earnRules?.xpPerCoin ?? 0,
  );

  // Item create form
  const [itemKey, setItemKey] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCurrency, setItemCurrency] = useState(initialCurrencies[0]?.key ?? "");
  const [itemCost, setItemCost] = useState(50);
  const [itemType, setItemType] = useState<RewardItem["rewardType"]>("DISCOUNT_CODE");
  const [itemCode, setItemCode] = useState("");
  const [itemCourseId, setItemCourseId] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [itemStock, setItemStock] = useState<number | "">("");

  // Balance grant form
  const [balanceMemberId, setBalanceMemberId] = useState(members[0]?.id ?? "");
  const [balanceCurrency, setBalanceCurrency] = useState(initialCurrencies[0]?.key ?? "");
  const [balanceAmount, setBalanceAmount] = useState(100);
  const [balanceOp, setBalanceOp] = useState<"grant_balance" | "revoke_balance">("grant_balance");
  const [balanceReason, setBalanceReason] = useState("");

  // Redemption log
  const [log, setLog] = useState<RedemptionLogItem[]>([]);
  const [logCursor, setLogCursor] = useState<string | null>(null);
  const [logLoaded, setLogLoaded] = useState(false);

  function reportError(caught: unknown, fallback: string) {
    if (caught instanceof ClientApiError) {
      setError(caught.message);
      setRequestId(caught.requestId);
    } else {
      setError(fallback);
    }
  }

  function clearFeedback() {
    setMessage(null);
    setError(null);
    setRequestId(null);
  }

  async function saveCurrency() {
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: { currencies?: RewardCurrency[] } }>(
        "/api/v1/rewards",
        {
          operation: "upsert_currency",
          currency: {
            key: currencyKey.trim(),
            name: currencyName.trim(),
            symbol: currencySymbol.trim() || null,
            earnRules: xpPerCoin > 0 ? { xpPerCoin } : null,
          },
        },
        `rewards-currency-${currencyKey.trim()}-${Date.now().toString()}`,
      );
      if (response.data.currencies) {
        setCurrencies(response.data.currencies);
      }
      setMessage("Currency saved.");
    } catch (caught) {
      reportError(caught, "Failed to save currency.");
    } finally {
      setBusy(false);
    }
  }

  async function createItem() {
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: { item?: RewardItem } }>(
        "/api/v1/rewards",
        {
          operation: "create_item",
          item: {
            key: itemKey.trim(),
            name: itemName.trim(),
            description: itemDescription.trim() || null,
            costCurrencyKey: itemCurrency,
            costAmount: itemCost,
            rewardType: itemType,
            rewardPayload: {
              ...(itemType === "CONTENT_UNLOCK" && itemCourseId ? { courseId: itemCourseId } : {}),
              ...(itemType === "DISCOUNT_CODE" && itemCode.trim() ? { code: itemCode.trim() } : {}),
              ...(itemNote.trim() ? { note: itemNote.trim() } : {}),
            },
            stock: itemStock === "" ? null : itemStock,
            status: "ACTIVE",
          },
        },
        `rewards-item-${itemKey.trim()}`,
      );
      if (response.data.item) {
        setItems((current) => [...current, response.data.item as RewardItem]);
      }
      setItemKey("");
      setItemName("");
      setItemDescription("");
      setItemCode("");
      setItemNote("");
      setItemStock("");
      setMessage("Reward created.");
    } catch (caught) {
      reportError(caught, "Failed to create reward.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItemStatus(item: RewardItem) {
    clearFeedback();
    setBusy(true);
    try {
      const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const response = await clientApi.put<{ data: { item?: RewardItem } }>(
        "/api/v1/rewards",
        { id: item.id, status: nextStatus },
        `rewards-item-status-${item.id}-${Date.now().toString()}`,
      );
      if (response.data.item) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? (response.data.item as RewardItem) : entry,
          ),
        );
      }
      setMessage("Reward updated.");
    } catch (caught) {
      reportError(caught, "Failed to update reward.");
    } finally {
      setBusy(false);
    }
  }

  async function adjustBalance() {
    clearFeedback();
    setBusy(true);
    try {
      const response = await clientApi.post<{
        data: { balance?: { balance: number } };
      }>(
        "/api/v1/rewards",
        {
          operation: balanceOp,
          membershipId: balanceMemberId,
          currencyKey: balanceCurrency,
          amount: balanceAmount,
          reason: balanceReason.trim(),
        },
        `rewards-balance-${balanceMemberId}-${Date.now().toString()}`,
      );
      setBalanceReason("");
      setMessage(
        `Balance ${balanceOp === "grant_balance" ? "granted" : "revoked"}. New balance: ${String(
          response.data.balance?.balance ?? "—",
        )}.`,
      );
    } catch (caught) {
      reportError(caught, "Failed to adjust balance.");
    } finally {
      setBusy(false);
    }
  }

  async function loadLog(reset: boolean) {
    clearFeedback();
    try {
      const params = new URLSearchParams();
      params.set("limit", "10");
      if (!reset && logCursor) params.set("cursor", logCursor);
      const response = await clientApi.get<{
        data: { items: RedemptionLogItem[]; nextCursor: string | null };
      }>(`/api/v1/rewards/redemptions?${params.toString()}`);
      setLog((current) => (reset ? response.data.items : [...current, ...response.data.items]));
      setLogCursor(response.data.nextCursor);
      setLogLoaded(true);
    } catch (caught) {
      reportError(caught, "Failed to load redemptions.");
    }
  }

  async function fulfillRedemption(redemptionId: string) {
    clearFeedback();
    setBusy(true);
    try {
      await clientApi.post(
        "/api/v1/rewards",
        { operation: "fulfill_redemption", redemptionId },
        `rewards-fulfill-${redemptionId}`,
      );
      setMessage("Redemption marked fulfilled.");
      await loadLog(true);
    } catch (caught) {
      reportError(caught, "Failed to fulfill redemption.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className={alertInfoClassName} role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className={alertErrorClassName} role="alert">
          {error}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Economy</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Currency</h2>
          </div>
        </div>
        <div className={`${panelBodyClassName} space-y-4`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className={labelClassName}>Key</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={currencyKey}
                onChange={(e) => {
                  setCurrencyKey(slugify(e.target.value));
                }}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Name</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={currencyName}
                onChange={(e) => {
                  setCurrencyName(e.target.value);
                }}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Symbol</span>
              <input
                className={`${fieldClassName} mt-1.5`}
                value={currencySymbol}
                placeholder="🪙"
                onChange={(e) => {
                  setCurrencySymbol(e.target.value);
                }}
              />
            </label>
            <label className="block">
              <span className={labelClassName}>Earn 1 per N XP (0 = off)</span>
              <input
                type="number"
                min={0}
                className={`${fieldClassName} mt-1.5`}
                value={xpPerCoin}
                onChange={(e) => {
                  setXpPerCoin(Math.max(0, Number(e.target.value) || 0));
                }}
              />
            </label>
          </div>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || !currencyKey.trim() || !currencyName.trim()}
            onClick={() => {
              void saveCurrency();
            }}
          >
            Save currency
          </button>
          {currencies.length > 0 ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Configured:{" "}
              {currencies.map((currency) => `${currency.name} (${currency.key})`).join(", ")}
            </p>
          ) : null}
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Catalog</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Rewards</h2>
          </div>
        </div>
        <div className={`${panelBodyClassName} space-y-4`}>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">No rewards yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--admin-border)]">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                      {item.name}
                      <span className="ml-2 text-xs font-normal text-[var(--admin-outline)]">
                        {item.key}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {REWARD_TYPE_LABELS[item.rewardType]} · {item.costAmount}{" "}
                      {item.costCurrencyKey}
                      {item.stock != null ? ` · ${String(item.stock)} left` : ""}
                    </p>
                  </div>
                  <span className={gamificationStatusBadgeClassName(item.status)}>
                    {item.status}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--admin-primary)]"
                    disabled={busy}
                    onClick={() => {
                      void toggleItemStatus(item);
                    }}
                  >
                    {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <p className="mb-3 text-sm font-semibold text-[var(--admin-on-surface)]">New reward</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClassName}>Key</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={itemKey}
                  placeholder="discount-10"
                  onChange={(e) => {
                    setItemKey(slugify(e.target.value));
                  }}
                />
              </label>
              <label className="block">
                <span className={labelClassName}>Name</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={itemName}
                  placeholder="10% discount"
                  onChange={(e) => {
                    setItemName(e.target.value);
                  }}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClassName}>Description</span>
                <input
                  className={`${fieldClassName} mt-1.5`}
                  value={itemDescription}
                  onChange={(e) => {
                    setItemDescription(e.target.value);
                  }}
                />
              </label>
              <GamificationSelectField
                label="Type"
                value={itemType}
                onChange={(value) => {
                  setItemType(value as RewardItem["rewardType"]);
                }}
                options={Object.entries(REWARD_TYPE_LABELS).map(([value, typeLabel]) => ({
                  value,
                  label: typeLabel,
                }))}
              />
              <div className="block">
                <span className={labelClassName}>Cost</span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    className={fieldClassName}
                    value={itemCost}
                    onChange={(e) => {
                      setItemCost(Math.max(1, Number(e.target.value) || 1));
                    }}
                  />
                  <GamificationSelectField
                    className="min-w-[7rem] shrink-0"
                    label={<span className="sr-only">Currency</span>}
                    value={itemCurrency}
                    onChange={setItemCurrency}
                    options={currencies.map((currency) => ({
                      value: currency.key,
                      label: currency.key,
                    }))}
                  />
                </div>
              </div>
              {itemType === "DISCOUNT_CODE" ? (
                <label className="block">
                  <span className={labelClassName}>Discount code</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={itemCode}
                    placeholder="SAVE10"
                    onChange={(e) => {
                      setItemCode(e.target.value);
                    }}
                  />
                </label>
              ) : null}
              {itemType === "CONTENT_UNLOCK" ? (
                <GamificationSelectField
                  label="Course to unlock"
                  value={itemCourseId}
                  onChange={setItemCourseId}
                  placeholder="Select a course…"
                  options={[
                    { value: "", label: "Select a course…" },
                    ...courses.map((course) => ({
                      value: course.id,
                      label: course.title,
                    })),
                  ]}
                />
              ) : null}
              {itemType === "CERTIFICATE" || itemType === "CUSTOM" ? (
                <label className="block">
                  <span className={labelClassName}>Fulfillment note</span>
                  <input
                    className={`${fieldClassName} mt-1.5`}
                    value={itemNote}
                    placeholder="How this gets fulfilled"
                    onChange={(e) => {
                      setItemNote(e.target.value);
                    }}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className={labelClassName}>Stock (blank = unlimited)</span>
                <input
                  type="number"
                  min={0}
                  className={`${fieldClassName} mt-1.5`}
                  value={itemStock}
                  onChange={(e) => {
                    setItemStock(
                      e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0),
                    );
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className={`${primaryButtonClassName} mt-4`}
              disabled={
                busy ||
                !itemKey.trim() ||
                !itemName.trim() ||
                !itemCurrency ||
                (itemType === "DISCOUNT_CODE" && !itemCode.trim()) ||
                (itemType === "CONTENT_UNLOCK" && !itemCourseId)
              }
              onClick={() => {
                void createItem();
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create reward
            </button>
          </div>
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>Manual action</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Adjust balance</h2>
          </div>
        </div>
        <div className={`${panelBodyClassName} space-y-4`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <GamificationSelectField
              label="Member"
              value={balanceMemberId}
              onChange={setBalanceMemberId}
              options={members.map((member) => ({
                value: member.id,
                label: member.label,
              }))}
            />
            <GamificationSelectField
              label="Action"
              value={balanceOp}
              onChange={(value) => {
                setBalanceOp(value as typeof balanceOp);
              }}
              options={[
                { value: "grant_balance", label: "Grant" },
                { value: "revoke_balance", label: "Revoke" },
              ]}
            />
            <GamificationSelectField
              label="Currency"
              value={balanceCurrency}
              onChange={setBalanceCurrency}
              options={currencies.map((currency) => ({
                value: currency.key,
                label: currency.key,
              }))}
            />
            <label className="block">
              <span className={labelClassName}>Amount</span>
              <input
                type="number"
                min={1}
                className={`${fieldClassName} mt-1.5`}
                value={balanceAmount}
                onChange={(e) => {
                  setBalanceAmount(Math.max(1, Number(e.target.value) || 1));
                }}
              />
            </label>
          </div>
          <label className="block">
            <span className={labelClassName}>Audit reason</span>
            <input
              className={`${fieldClassName} mt-1.5`}
              value={balanceReason}
              placeholder="Required audit reason"
              onChange={(e) => {
                setBalanceReason(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={busy || !balanceMemberId || !balanceCurrency || !balanceReason.trim()}
            onClick={() => {
              void adjustBalance();
            }}
          >
            Apply balance change
          </button>
        </div>
      </section>

      <section className={panelClassName}>
        <div className={panelHeaderClassName}>
          <div>
            <p className={panelEyebrowClassName}>History</p>
            <h2 className="font-semibold text-[var(--admin-on-surface)]">Redemptions</h2>
          </div>
          <button
            type="button"
            className={outlineButtonClassName}
            disabled={busy}
            onClick={() => {
              void loadLog(true);
            }}
          >
            {logLoaded ? "Refresh" : "Load redemptions"}
          </button>
        </div>
        <div className={panelBodyClassName}>
          {!logLoaded ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Load the log to review and fulfill redemptions.
            </p>
          ) : log.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">No redemptions yet.</p>
          ) : (
            <div className="space-y-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] text-left text-[var(--admin-on-surface-variant)]">
                    <th className="py-2 pr-3 font-medium">Reward</th>
                    <th className="py-2 pr-3 font-medium">Member</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--admin-border)] last:border-b-0"
                    >
                      <td className="py-2 pr-3">{entry.rewardName}</td>
                      <td className="py-2 pr-3">{entry.memberLabel}</td>
                      <td className="py-2 pr-3">{entry.costAmount}</td>
                      <td className="py-2 pr-3">{new Date(entry.redeemedAt).toLocaleString()}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={gamificationStatusBadgeClassName(
                            entry.status === "fulfilled" ? "ACTIVE" : "INACTIVE",
                          )}
                        >
                          {entry.status === "fulfilled" ? "FULFILLED" : "PENDING"}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {entry.status !== "fulfilled" ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--admin-primary)]"
                            disabled={busy}
                            onClick={() => {
                              void fulfillRedemption(entry.id);
                            }}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Fulfill
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logCursor ? (
                <button
                  type="button"
                  className={outlineButtonClassName}
                  disabled={busy}
                  onClick={() => {
                    void loadLog(false);
                  }}
                >
                  Load more
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
