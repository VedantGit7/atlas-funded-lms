"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { helpOutlineButtonClassName } from "../help-center-styles";

type HelpArticleFeedbackProps = {
  articleSlug: string;
};

type FeedbackState = "idle" | "positive" | "negative";

export function HelpArticleFeedback({ articleSlug }: HelpArticleFeedbackProps) {
  const storageKey = `help-feedback:${articleSlug}`;
  const [state, setState] = useState<FeedbackState>("idle");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === "positive" || stored === "negative") {
        setState(stored);
      }
    } catch {
      // Ignore unavailable storage.
    }
  }, [storageKey]);

  function submit(next: FeedbackState) {
    setState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Storage may be unavailable in private mode; UI still thanks the user.
    }
  }

  if (state !== "idle") {
    return (
      <section
        id="feedback"
        className="rounded-xl border border-border bg-card p-8 text-center"
        aria-live="polite"
      >
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-primary" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-primary">Thank you for your feedback</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your response helps us improve the help center for everyone.
        </p>
      </section>
    );
  }

  return (
    <section id="feedback" className="rounded-xl border border-border bg-card p-8 text-center">
      <h3 className="text-lg font-semibold text-primary">Was this article helpful?</h3>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            submit("positive");
          }}
          className={`${helpOutlineButtonClassName} px-6 py-3`}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => {
            submit("negative");
          }}
          className={`${helpOutlineButtonClassName} px-6 py-3`}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          No
        </button>
      </div>
    </section>
  );
}
