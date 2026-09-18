"use client";

import { ClientApiError, clientApi } from "../../lib/client-api";

export type ReactionTarget = {
  targetType: "post" | "comment";
  targetId: string;
  reactionKey?: string;
};

const DEFAULT_REACTION_KEY = "like";

export async function addReaction(target: ReactionTarget): Promise<void> {
  await clientApi.post(
    "/api/v1/reactions",
    {
      targetType: target.targetType,
      targetId: target.targetId,
      reactionKey: target.reactionKey ?? DEFAULT_REACTION_KEY,
    },
    "community-reaction",
  );
}

export async function removeReaction(target: ReactionTarget): Promise<void> {
  await clientApi.delete("/api/v1/reactions", "community-reaction-remove", {
    targetType: target.targetType,
    targetId: target.targetId,
    reactionKey: target.reactionKey ?? DEFAULT_REACTION_KEY,
  });
}

export { ClientApiError };
