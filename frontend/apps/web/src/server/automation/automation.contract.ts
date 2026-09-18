// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

export type {
  CreateAutomationRuleBody,
  DeleteAutomationRuleBody,
  UpdateAutomationRuleBody,
} from "./automation.dto";

export {
  createAutomationRuleBodySchema,
  deleteAutomationRuleBodySchema,
  updateAutomationRuleBodySchema,
  automationRuleListResponseSchema,
  automationRuleDetailResponseSchema,
  automationRuleDeleteResponseSchema,
  automationRunListQuerySchema,
  automationRunListResponseSchema,
} from "./automation.dto";
