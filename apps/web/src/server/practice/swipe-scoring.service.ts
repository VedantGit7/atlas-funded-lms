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
