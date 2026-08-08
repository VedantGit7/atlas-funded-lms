import {
  deleteAutomationRuleMetadata,
  listAutomationRulesMetadata,
  mutateAutomationRulesMetadata,
  updateAutomationRuleMetadata,
} from "../../../../server/automation/automation.route-metadata";

export const routeMetadata = {
  GET: listAutomationRulesMetadata,
  POST: mutateAutomationRulesMetadata,
  PUT: updateAutomationRuleMetadata,
  DELETE: deleteAutomationRuleMetadata,
};
