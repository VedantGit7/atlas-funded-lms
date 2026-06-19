import { AtlasHttpError } from "@atlas/core/http/errors";

export type AssessmentLifecycleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export function assertAssessmentEditable(status: AssessmentLifecycleStatus): void {
  if (status !== "DRAFT" && status !== "REVIEW") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Assessment cannot be edited in its current state.",
    });
  }
}

export function assertAssessmentPublishable(status: AssessmentLifecycleStatus): void {
  if (status !== "DRAFT") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only draft assessments can be submitted for review.",
    });
  }
}

export function validateAssessmentItemPositions(positions: number[]): void {
  const seen = new Set<number>();

  for (const position of positions) {
    if (seen.has(position)) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Duplicate assessment item positions are not allowed.",
      });
    }

    seen.add(position);
  }
}

export function validateUniqueItemIds(itemIds: string[]): void {
  const seen = new Set<string>();

  for (const itemId of itemIds) {
    if (seen.has(itemId)) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Duplicate assessment items are not allowed.",
      });
    }

    seen.add(itemId);
  }
}
