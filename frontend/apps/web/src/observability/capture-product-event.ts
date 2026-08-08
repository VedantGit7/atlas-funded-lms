"use client";

import { captureApprovedClientEvent } from "./posthog-browser";
import type { ApprovedPostHogEvent } from "./posthog-taxonomy";

type ProductEventProperties = Record<string, unknown>;

export function captureProductEvent(
  event: ApprovedPostHogEvent,
  properties?: ProductEventProperties,
): void {
  captureApprovedClientEvent(event, properties);
}
