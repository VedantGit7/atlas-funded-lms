"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Skeleton } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  localesAlertErrorClassName,
  localesAlertSuccessClassName,
  localesMonoKeyClassName,
  localesPrimaryButtonClassName,
  localesTableHeadClassName,
  localesTableRowClassName,
  localesTableShellClassName,
} from "../../locales-admin-shared";
import { formatRelativeTime, truncateText } from "../../locales-admin-utils";

type ReviewQueueItem = {
  locale: string;
  key: string;
  value: string;
  reviewStatus: "pending" | "approved" | "rejected";
  sourceValue: string | null;
  updatedAt: string;
};

type LocalesReviewQueueTabProps = {
  canManage: boolean;
};

export function LocalesReviewQueueTab({ canManage }: LocalesReviewQueueTabProps) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: ReviewQueueItem[] }>(
        "/api/v1/locales/review-queue",
      );
      setItems(response.data);
    } catch (caught) {
      setMessage(
        caught instanceof ClientApiError ? caught.message : "Failed to load review queue.",
      );
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reviewItem(item: ReviewQueueItem, status: "approved" | "rejected") {
    if (!canManage) return;
    const actionKey = `${item.locale}:${item.key}`;
    setActingKey(actionKey);
    setMessage(null);
    try {
      await clientApi.put(
        `/api/v1/locales/${item.locale}/${encodeURIComponent(item.key)}/review`,
        { status },
        `locale-review-${actionKey}-${status}`,
      );
      setItems((current) =>
        current.filter((row) => !(row.locale === item.locale && row.key === item.key)),
      );
      setMessage(`String ${status}.`);
      setMessageTone("success");
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Review action failed.");
      setMessageTone("error");
    } finally {
      setActingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-hidden="true">
        <Skeleton className="h-10 w-full bg-[var(--admin-surface-high)]" />
        <Skeleton className="h-48 w-full bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {message ? (
        <div
          role="alert"
          className={
            messageTone === "success" ? localesAlertSuccessClassName : localesAlertErrorClassName
          }
        >
          {message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Review queue is empty"
          description="Strings awaiting review will appear here after edits in non-default locales."
          className="border-[var(--admin-border)] bg-[var(--admin-surface)] [&_h2]:text-[var(--admin-on-surface)] [&_p]:text-[var(--admin-on-surface-variant)]"
        />
      ) : (
        <div className={localesTableShellClassName}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`${localesTableRowClassName} hover:bg-transparent`}>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Locale</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Key</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Translation</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Source</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Updated</th>
                {canManage ? (
                  <th className={`${localesTableHeadClassName} px-4 py-2 text-right`}>Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const actionKey = `${item.locale}:${item.key}`;
                return (
                  <tr key={actionKey} className={localesTableRowClassName}>
                    <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                      {item.locale}
                    </td>
                    <td className="px-4 py-3">
                      <code className={localesMonoKeyClassName}>{item.key}</code>
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                      {truncateText(item.value)}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {item.sourceValue ? truncateText(item.sourceValue) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {formatRelativeTime(item.updatedAt)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className={localesPrimaryButtonClassName}
                            disabled={actingKey === actionKey}
                            onClick={() => void reviewItem(item, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actingKey === actionKey}
                            onClick={() => void reviewItem(item, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
