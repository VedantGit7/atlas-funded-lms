"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { cn } from "@atlas/design-system";
import { addReaction, ClientApiError, removeReaction } from "../community-api";

type ReactionToggleProps = {
  targetType: "post" | "comment";
  targetId: string;
  initialCount?: number;
  initialViewerReactionKeys?: string[];
  reactionKey?: string;
  label?: string;
  /** "pill" for post action bars, "inline" for compact comment actions. */
  variant?: "pill" | "inline";
};

export function ReactionToggle({
  targetType,
  targetId,
  initialCount = 0,
  initialViewerReactionKeys = [],
  reactionKey = "like",
  label = "Like",
  variant = "pill",
}: ReactionToggleProps) {
  const initiallyReacted = initialViewerReactionKeys.includes(reactionKey);
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initiallyReacted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const target = { targetType, targetId, reactionKey };
    const nextReacted = !reacted;
    const previousCount = count;
    const previousReacted = reacted;

    setReacted(nextReacted);
    setCount((current) => Math.max(0, current + (nextReacted ? 1 : -1)));

    try {
      if (nextReacted) {
        await addReaction(target);
      } else {
        await removeReaction(target);
      }
    } catch (toggleError) {
      setReacted(previousReacted);
      setCount(previousCount);
      setError(
        toggleError instanceof ClientApiError ? toggleError.message : "Unable to update reaction.",
      );
    } finally {
      setBusy(false);
    }
  }

  const pressedLabel = `${reacted ? "Remove reaction" : label}${count > 0 ? ` (${String(count)})` : ""}`;

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium transition-colors",
            reacted ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={reacted}
          aria-label={pressedLabel}
          disabled={busy}
          onClick={() => void toggle()}
        >
          <ThumbsUp
            className="h-3.5 w-3.5"
            strokeWidth={2}
            fill={reacted ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {count > 0 ? <span className="tabular-nums">{count}</span> : null}
        </button>
        {error ? <span className="ml-2 text-[11px] text-destructive">{error}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          reacted
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
        )}
        aria-pressed={reacted}
        aria-label={pressedLabel}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <ThumbsUp
          className="h-4 w-4"
          strokeWidth={2}
          fill={reacted ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span className="tabular-nums">{count}</span>
      </button>
      {error ? <span className="ml-2 text-[11px] text-destructive">{error}</span> : null}
    </span>
  );
}
