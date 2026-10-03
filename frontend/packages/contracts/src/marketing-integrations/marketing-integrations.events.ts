import { z } from "zod";
import { marketingIntegrationEventKeySchema } from "./marketing-integrations.schemas";

/**
 * Outbox contract for tenant webhook fan-out.
 *
 * Fan-out used to run inline: `dispatchMarketingIntegrationWebhooks` looped
 * over every enabled webhook and awaited an 8 s-timeout HTTP call for each,
 * sequentially, **while holding the tenant transaction** — on the public signup
 * route and the enrollment path. A tenant with five slow or dead webhook URLs
 * therefore pinned a pooled database connection for up to 40 s on an
 * unauthenticated request, which is the C6 shape Phase 1 measured at 0 rps and
 * a 10 s stall. There was no retry either: failures were recorded and swallowed.
 *
 * Publishing an event instead keeps the request path free of network I/O and
 * gives delivery the worker's retry semantics. Nothing observable is lost —
 * the dispatcher was documented as never throwing, so no caller ever depended
 * on delivery having happened by the time it returned.
 */
export const MARKETING_WEBHOOK_DISPATCH_EVENT = "marketing.webhook_dispatch_requested" as const;

export const MARKETING_WEBHOOK_WORKER_DESTINATION = "marketing.webhooks" as const;

export const marketingWebhookDispatchPayloadSchema = z
  .object({
    eventKey: marketingIntegrationEventKeySchema,
    /** Arbitrary tenant-visible event body, forwarded to the webhook as `data`. */
    data: z.record(z.string(), z.unknown()),
    /** Worker-created immutable endpoint snapshot; absent on the fan-out parent. */
    delivery: z
      .object({
        webhookId: z.uuid(),
        url: z.url(),
        idempotencyKey: z.string().min(1).max(200),
        requestBody: z.string().min(1),
      })
      .strict()
      .optional(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type MarketingWebhookDispatchPayload = z.output<
  typeof marketingWebhookDispatchPayloadSchema
>;
