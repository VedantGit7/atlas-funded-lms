/**
 * What a page says when the academy's plan leaves a feature out (the API's
 * ENTITLEMENT_REQUIRED). It used to read "no access" or "requires the
 * gamification.enable entitlement", which sounds like a permission problem or
 * a developer note (QA review 1 C14).
 *
 * Staff are told it's the plan and who can change it; learners, who can't,
 * are told it isn't available.
 */
export function notOnPlanMessage(feature: string): string {
  return `${feature} isn't included in your academy's plan. The academy owner can add it.`;
}

export function notInAcademyMessage(feature: string): string {
  return `${feature} isn't available in this academy.`;
}

export const PLAN_GATE_TITLE = "Not on your plan";
