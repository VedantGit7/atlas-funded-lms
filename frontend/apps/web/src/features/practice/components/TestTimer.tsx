"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

type TestTimerProps = {
  expiresAt: string;
  onExpire: () => void;
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Countdown for a timed test. The deadline is set and enforced by the server;
 * this is the visible mirror of it and fires `onExpire` once when it runs out.
 */
export function TestTimer({ expiresAt, onExpire }: TestTimerProps) {
  const deadline = Date.parse(expiresAt);
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    if (!Number.isFinite(deadline)) return;

    let fired = false;
    const tick = () => {
      const next = deadline - Date.now();
      setRemaining(next);
      if (next <= 0 && !fired) {
        fired = true;
        onExpire();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [deadline, onExpire]);

  if (!Number.isFinite(deadline)) return null;

  const urgent = remaining <= 30_000;

  return (
    <span
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
      aria-label={`Time remaining ${formatRemaining(remaining)}`}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold tabular-nums"
      style={
        urgent
          ? {
              borderColor: "color-mix(in srgb, var(--destructive) 40%, transparent)",
              background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
              color: "var(--destructive)",
            }
          : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
      }
    >
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {formatRemaining(remaining)}
    </span>
  );
}
