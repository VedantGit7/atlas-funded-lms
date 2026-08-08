import { AtlasHttpError } from "@atlas/core/http/errors";

export function badgeNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Badge not found.",
  });
}

export function leaderboardNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Leaderboard not found.",
  });
}

export function streakNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Streak not found.",
  });
}

export function freezeNotAvailable(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "No streak freeze is available.",
  });
}

export function freezeNotEligible(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Streak freeze is not eligible for the current streak state.",
  });
}

export function duplicateBadgeKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A badge with this key already exists.",
  });
}

export function duplicateLeaderboardKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A leaderboard with this key already exists.",
  });
}

export function invalidTargetMembership(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Target membership not found.",
  });
}

export function questNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Quest not found.",
  });
}

export function duplicateQuestKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A quest with this key already exists.",
  });
}

export function seasonalEventNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Seasonal event not found.",
  });
}

export function duplicateSeasonalKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A seasonal event with this key already exists.",
  });
}

export function rewardItemNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: "Reward item not found.",
  });
}

export function duplicateRewardKey(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "A reward with this key already exists.",
  });
}

export function currencyNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Currency not found.",
  });
}

export function insufficientBalance(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Insufficient balance for this reward.",
  });
}

export function rewardOutOfStock(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "This reward is out of stock.",
  });
}

export function redemptionNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Redemption not found.",
  });
}

export function badgeAwardNotFound(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Badge award not found for this membership.",
  });
}

export function badgeAlreadyAwarded(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 409,
    message: "Badge has already been awarded to this membership.",
  });
}

export function badgeNotAwarded(): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 404,
    message: "Badge has not been awarded to this membership.",
  });
}

export function hallOfFameConfigInvalid(message: string): AtlasHttpError {
  return new AtlasHttpError({
    code: "VALIDATION_ERROR",
    status: 400,
    message,
  });
}
