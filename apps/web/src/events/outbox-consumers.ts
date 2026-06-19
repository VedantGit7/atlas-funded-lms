import type { OutboxHandler } from "@atlas/events/services/outbox-worker.service";
import {
  COMPETENCY_WORKER_DESTINATION,
  competencyOutboxHandlers,
  handleCompetencyOutboxEvent,
} from "../server/competency/competency.worker";
import {
  READINESS_WORKER_DESTINATION,
  createReadinessOutboxConsumers,
  handleReadinessOutboxEvent,
} from "../server/readiness/readiness.worker";

export { COMPETENCY_WORKER_DESTINATION, handleCompetencyOutboxEvent };
export { READINESS_WORKER_DESTINATION, handleReadinessOutboxEvent, createReadinessOutboxConsumers };

export function createCompetencyOutboxConsumers(): Record<string, OutboxHandler[]> {
  return {
    "assessment.submitted": competencyOutboxHandlers,
    "assessment.graded": competencyOutboxHandlers,
    "practice.session_completed": competencyOutboxHandlers,
  };
}
