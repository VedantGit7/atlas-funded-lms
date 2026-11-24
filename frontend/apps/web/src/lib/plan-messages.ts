/**
 * What a page says when the academy's plan leaves a feature out (the API's
 * ENTITLEMENT_REQUIRED). It used to read "no access" or "requires the
 * gamification.enable entitlement", which sounds like a permission problem or
 * a developer note (QA review 1 C14).
 *
 * Staff are told it's the plan and who can change it; learners, who can't,
 * are told it isn't available.
 */
type FeatureWording = { plural?: boolean };

function isnt(options?: FeatureWording): string {
  return options?.plural ? "aren't" : "isn't";
}

/** Pass `{ plural: true }` for names like "Leaderboards": "Leaderboards aren't …". */
export function notOnPlanMessage(feature: string, options?: FeatureWording): string {
  return `${feature} ${isnt(options)} included in your academy's plan. The academy owner can add ${options?.plural ? "them" : "it"}.`;
}

export function notInAcademyMessage(feature: string, options?: FeatureWording): string {
  return `${feature} ${isnt(options)} available in this academy.`;
}

export const PLAN_GATE_TITLE = "Not on your plan";
