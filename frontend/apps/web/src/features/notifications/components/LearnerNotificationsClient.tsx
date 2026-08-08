"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { notificationInboxItemSchema } from "@atlas/contracts/notifications/notification.dto";

type InboxItem = z.infer<typeof notificationInboxItemSchema>;

type LearnerNotificationsClientProps = {
  initialItems: InboxItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
};

export function LearnerNotificationsClient({
  initialItems,
  initialNextCursor,
  initialHasMore,
}: LearnerNotificationsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMessage(null);
    try {
      const response = await clientApi.get<{
        data: InboxItem[];
        page: { nextCursor: string | null; hasMore: boolean };
      }>(`/api/v1/me/notifications?limit=25&cursor=${nextCursor}`);
      setItems((current) => [...current, ...response.data]);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoadingMore(false);
    }
  }

  async function openNotification(item: InboxItem) {
    setMessage(null);
    setRequestId(null);
    try {
      if (!item.read) {
        const response = await clientApi.post<{
          data: { id: string; read: true; readAt: string };
        }>(`/api/v1/me/notifications/${item.id}/read`, {}, `notification-read-${item.id}`);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read: true, readAt: response.data.readAt } : entry,
          ),
        );
      }
      router.push(item.actionPath);
    } catch (caught) {
      setError(caught);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded border p-6">
        <p>No notifications yet.</p>
        {message ? <p role="alert">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p role="alert">
          {message}
          {requestId ? ` (Request ID: ${requestId})` : null}
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`w-full rounded border px-4 py-3 text-left ${
                item.read ? "opacity-80" : "border-black"
              }`}
              onClick={() => void openNotification(item)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{item.title}</span>
                {!item.read ? <span className="text-xs uppercase">Unread</span> : null}
              </div>
              <p className="mt-1 text-sm">{item.body}</p>
              <p className="mt-2 text-xs text-gray-600">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button
          type="button"
          className="rounded border px-3 py-2"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
