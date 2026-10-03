import type { ApprovedPostHogEvent } from "./taxonomy";
import { captureServerPostHogEventImmediate } from "./server";
import { actorSafeId, tenantSafeId } from "../safe-identifiers";

type OutboxHandler = {
  destinationKey: string;
  retryOnCrash?: boolean;
  handle: (event: {
    id: string;
    idempotencyKey: string;
    attempt: number;
    eventType: string;
    tenantId: string | null;
    payload: unknown;
    requestId: string;
  }) => Promise<void>;
};

export const POSTHOG_OUTBOX_DESTINATION_KEY = "posthog.product-analytics";

const OUTBOX_TO_POSTHOG: Record<string, ApprovedPostHogEvent> = {
  "lesson.completed": "lesson_completed",
  "assessment.started": "assessment_attempt_started",
  "assessment.submitted": "assessment_submitted",
  "practice.session_completed": "swipe_session_completed",
  "community.post.created": "community_post_created",
  "workflow.transitioned": "admin_workflow_action",
  "badge.awarded": "badge_earned",
  "gamification.level_up": "level_up",
  "quest.completed": "quest_completed",
  "reward.redeemed": "reward_redeemed",
};

export const POSTHOG_OUTBOX_EVENT_TYPES = Object.keys(OUTBOX_TO_POSTHOG);

export function mapOutboxEventToPostHog(eventType: string): ApprovedPostHogEvent | null {
  return OUTBOX_TO_POSTHOG[eventType] ?? null;
}

export async function captureOutboxConfirmedPostHogEvent(args: {
  eventId?: string;
  eventType: string;
  tenantId: string | null;
  actorMembershipId?: string | null;
  actorPlane?: "tenant" | "platform" | "public";
  properties?: Record<string, unknown>;
}): Promise<void> {
  const mapped = mapOutboxEventToPostHog(args.eventType);
  if (!mapped) {
    return;
  }

  const safeTenant = tenantSafeId(args.tenantId);
  const safeActor = actorSafeId(args.actorMembershipId ?? undefined);
  const distinctId = safeActor ?? safeTenant ?? "anonymous";

  await captureServerPostHogEventImmediate({
    event: mapped,
    ...(args.eventId ? { uuid: args.eventId } : {}),
    distinctId,
    properties: {
      tenantSafeId: safeTenant,
      actorSafeId: safeActor,
      actorPlane: args.actorPlane ?? (args.tenantId ? "tenant" : "platform"),
      source: "outbox",
      ...args.properties,
    },
  });
}

export function withPostHogProductHandlers(
  handlers: Record<string, OutboxHandler[]>,
): Record<string, OutboxHandler[]> {
  // Disabled optional analytics does not create falsely successful deliveries.
  if (!process.env["POSTHOG_SERVER_KEY"]?.trim()) return handlers;
  const posthogHandler = createPostHogOutboxHandler();

  for (const eventType of POSTHOG_OUTBOX_EVENT_TYPES) {
    handlers[eventType] = [...(handlers[eventType] ?? []), posthogHandler];
  }

  return handlers;
}

export function createPostHogOutboxHandler(): OutboxHandler {
  return {
    destinationKey: POSTHOG_OUTBOX_DESTINATION_KEY,
    handle: async (event) => {
      await captureOutboxConfirmedPostHogEvent({
        eventId: event.id,
        eventType: event.eventType,
        tenantId: event.tenantId,
        actorPlane: event.tenantId ? "tenant" : "platform",
      });
    },
  };
}
