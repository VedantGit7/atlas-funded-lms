import type { TenantTx } from "@atlas/db";
import type { AnalyticsProjectionMutation, AnalyticsServiceCtx } from "./analytics.types";

export type AnalyticsSourceAdapter = {
  sourceContext: string;
  supportedEvents: readonly string[];
  buildMutations: (
    tx: TenantTx,
    ctx: AnalyticsServiceCtx,
    event: { id: string; eventType: string; payload: unknown },
  ) => Promise<AnalyticsProjectionMutation[]>;
};

const adapters: AnalyticsSourceAdapter[] = [];

export function registerAnalyticsSourceAdapter(adapter: AnalyticsSourceAdapter): void {
  adapters.push(adapter);
}

export function getAnalyticsAdaptersForEvent(eventType: string): AnalyticsSourceAdapter[] {
  return adapters.filter((adapter) => adapter.supportedEvents.includes(eventType));
}

export function listRegisteredAnalyticsSourceEvents(): string[] {
  const events = new Set<string>();
  for (const adapter of adapters) {
    for (const eventType of adapter.supportedEvents) {
      events.add(eventType);
    }
  }
  return [...events].sort();
}
