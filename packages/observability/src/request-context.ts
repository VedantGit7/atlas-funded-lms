import { AsyncLocalStorage } from "node:async_hooks";

export type ObservabilityRequestContext = {
  requestId: string;
  parentRequestId?: string;
  route?: string;
  routeGroup?: string;
  jobName?: string;
  eventType?: string;
  tenantSafeId?: string;
  actorSafeId?: string;
  actorPlane?: "tenant" | "platform" | "public";
};

export const observabilityRequestContext = new AsyncLocalStorage<ObservabilityRequestContext>();

export function getObservabilityRequestContext(): ObservabilityRequestContext | undefined {
  return observabilityRequestContext.getStore();
}

export async function runWithObservabilityContext<T>(
  context: ObservabilityRequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return observabilityRequestContext.run(context, fn);
}
