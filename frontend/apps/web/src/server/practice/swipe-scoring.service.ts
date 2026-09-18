// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

const SWIPE_ITEM_TYPE_KEY = "swipe";

type SwipeAnswerKey = {
  direction?: unknown;
};

function readSwipeDirection(answerKeyJson: unknown): "left" | "right" {
  if (!answerKeyJson || typeof answerKeyJson !== "object" || Array.isArray(answerKeyJson)) {
    return "right";
  }

  const direction = (answerKeyJson as SwipeAnswerKey).direction;
  return direction === "left" ? "left" : "right";
}

export function isSwipeItemType(itemTypeKey: string): boolean {
  return itemTypeKey === SWIPE_ITEM_TYPE_KEY;
}

export function scoreSwipeResponse(args: {
  itemTypeKey: string;
  answerKeyJson: unknown;
  action: "known" | "unknown";
}): boolean {
  if (!isSwipeItemType(args.itemTypeKey)) {
    return false;
  }

  const expectedDirection = readSwipeDirection(args.answerKeyJson);
  const responseDirection = args.action === "known" ? "right" : "left";
  return responseDirection === expectedDirection;
}

export function feedbackLabelForAction(isCorrect: boolean): string {
  return isCorrect ? "Correct" : "Needs review";
}
