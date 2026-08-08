"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicMarketingEventDto } from "../../../admin/grow/events-shared";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Starting now";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

async function fetchLiveEvents(attempt = 1): Promise<PublicMarketingEventDto[]> {
  const response = await fetch("/api/v1/public/marketing/events", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      return fetchLiveEvents(attempt + 1);
    }
    throw new Error(`Events list failed (${response.status})`);
  }
  const json = (await response.json()) as { data?: { items: PublicMarketingEventDto[] } };
  return json.data?.items ?? [];
}

export function LearnerEventsCountdown() {
  const [items, setItems] = useState<PublicMarketingEventDto[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchLiveEvents();
        if (!cancelled) setItems(next);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[events] failed to load public events", error);
        }
        if (!cancelled) setItems([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const nextEvent = useMemo(() => {
    const upcoming = items
      .map((item) => ({ item, startMs: new Date(item.startsAt).getTime() }))
      .filter((entry) => Number.isFinite(entry.startMs))
      .sort((a, b) => a.startMs - b.startMs);
    return upcoming[0] ?? null;
  }, [items]);

  if (!nextEvent) return null;

  const { item, startMs } = nextEvent;
  const remaining = startMs - now;
  const href = item.joinUrl || item.linkUrl || null;

  const body = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Upcoming event
        </p>
        <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
        {item.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        ) : null}
      </div>
      <div className="shrink-0 rounded-xl bg-muted px-4 py-3 text-center">
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {formatCountdown(remaining)}
        </p>
        <p className="text-xs text-muted-foreground">
          {remaining > 0 ? "until start" : "in progress"}
        </p>
      </div>
    </div>
  );

  return (
    <section
      aria-label="Upcoming event"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    >
      {href ? (
        <Link href={href} className="block transition-opacity hover:opacity-90">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}
