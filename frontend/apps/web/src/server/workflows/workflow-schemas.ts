// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/** Canonical workflow API schemas — keep in sync via @atlas/contracts. */
export {
  createWorkflowDefinitionBodySchema,
  updateWorkflowDefinitionBodySchema,
  workflowDefinitionListResponseSchema,
  workflowDefinitionResponseSchema,
  workflowDefinitionViewSchema,
  workflowHistoryItemSchema,
  workflowHistoryQuerySchema,
  workflowHistoryResponseSchema,
  workflowListQuerySchema,
  workflowListResponseSchema,
  workflowQueueItemSchema,
  workflowTargetSchema,
  workflowTargetTypeSchema,
  workflowTransitionBodySchema,
  workflowTransitionParamsSchema,
  workflowTransitionResultSchema,
  type WorkflowHistoryQuery,
  type WorkflowListQuery,
  type WorkflowTransitionBody,
} from "@atlas/contracts/workflows/workflow-schemas";
