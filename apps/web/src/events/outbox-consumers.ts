import type { OutboxHandler } from "@atlas/events/services/outbox-worker.service";

import {
  COMPETENCY_WORKER_DESTINATION,
  competencyOutboxHandlers,
  handleCompetencyOutboxEvent,
} from "../server/competency/competency.worker";

import {
  GAMIFICATION_WORKER_DESTINATION,
  gamificationOutboxHandlers,
  handleGamificationOutboxEvent,
} from "../server/gamification/gamification.worker";

import {
  READINESS_WORKER_DESTINATION,
  createReadinessOutboxConsumers,
  handleReadinessOutboxEvent,
} from "../server/readiness/readiness.worker";

import {
  CERTIFICATE_ISSUED_EVENT,
  CERTIFICATE_REVOKED_EVENT,
} from "../server/certificates/certificate.events";
import {
  CERTIFICATE_WORKER_DESTINATION,
  certificateOutboxHandlers,
  handleCertificateOutboxEvent,
} from "../server/certificates/certificate.worker";

export { COMPETENCY_WORKER_DESTINATION, handleCompetencyOutboxEvent };

export { GAMIFICATION_WORKER_DESTINATION, handleGamificationOutboxEvent };

export { READINESS_WORKER_DESTINATION, handleReadinessOutboxEvent, createReadinessOutboxConsumers };

export { CERTIFICATE_WORKER_DESTINATION, handleCertificateOutboxEvent, certificateOutboxHandlers };

const CERTIFICATE_OUTBOX_EVENTS = [CERTIFICATE_ISSUED_EVENT, CERTIFICATE_REVOKED_EVENT] as const;

const GAMIFICATION_SOURCE_EVENTS = [
  "lesson.completed",

  "path.step_completed",

  "assessment.submitted",

  "assessment.graded",

  "practice.session_completed",
] as const;

function appendHandlers(
  map: Record<string, OutboxHandler[]>,

  eventType: string,

  handlers: OutboxHandler[],
) {
  map[eventType] = [...(map[eventType] ?? []), ...handlers];
}

export function createCompetencyOutboxConsumers(): Record<string, OutboxHandler[]> {
  const map: Record<string, OutboxHandler[]> = {};

  appendHandlers(map, "assessment.submitted", competencyOutboxHandlers);

  appendHandlers(map, "assessment.graded", competencyOutboxHandlers);

  appendHandlers(map, "practice.session_completed", competencyOutboxHandlers);

  return map;
}

export function createGamificationOutboxConsumers(): Record<string, OutboxHandler[]> {
  const map: Record<string, OutboxHandler[]> = {};

  for (const eventType of GAMIFICATION_SOURCE_EVENTS) {
    appendHandlers(map, eventType, gamificationOutboxHandlers);
  }

  return map;
}

export function createCertificateOutboxConsumers(): Record<string, OutboxHandler[]> {
  const map: Record<string, OutboxHandler[]> = {};

  for (const eventType of CERTIFICATE_OUTBOX_EVENTS) {
    appendHandlers(map, eventType, certificateOutboxHandlers);
  }

  return map;
}

export function createEngagementOutboxConsumers(): Record<string, OutboxHandler[]> {
  const map: Record<string, OutboxHandler[]> = {};

  for (const [eventType, handlers] of Object.entries(createCompetencyOutboxConsumers())) {
    appendHandlers(map, eventType, handlers);
  }

  for (const [eventType, handlers] of Object.entries(createGamificationOutboxConsumers())) {
    appendHandlers(map, eventType, handlers);
  }

  return map;
}
