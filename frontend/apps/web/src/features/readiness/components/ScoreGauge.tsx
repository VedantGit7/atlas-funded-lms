"use client";

import { useRef } from "react";
import { useAnimatedNumber, useEntryAnimation } from "../../../components/motion/native-animation";
import { cn } from "@atlas/design-system";
import { toGaugePercent } from "../readiness-view";

type ScoreGaugeProps = {
  /** Raw score; clamped to 0-100 for the arc fill. */
  score: number;
  /** Displayed centre value (defaults to the rounded score). */
  displayValue?: number;
  /** CSS colour (design token) for the filled arc. */
  color: string;
  variant?: "hero" | "mini";
  /** Accessible description, e.g. "Composite readiness score 74 of 100, band Proficient". */
  ariaLabel: string;
  /** Small caption under the number (hero only), e.g. "of 100". */
  caption?: string;
  className?: string;
};

const VARIANTS = {
  hero: {
    size: 264,
    stroke: 14,
    sweep: 0.75,
    rotation: 135,
    numberClass: "text-6xl",
    captionClass: "text-xs",
  },
  mini: {
    size: 92,
    stroke: 9,
    sweep: 1,
    rotation: -90,
    numberClass: "text-2xl",
    captionClass: "text-[10px]",
  },
} as const;

export function ScoreGauge({
  score,
  displayValue,
  color,
  variant = "mini",
  ariaLabel,
  caption,
  className,
}: ScoreGaugeProps) {
  const ref = useRef<SVGCircleElement>(null);
  const cfg = VARIANTS[variant];
  const pct = toGaugePercent(score);
  const target = displayValue ?? Math.round(score);

  const radius = (cfg.size - cfg.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * cfg.sweep;
  const drawn = (pct / 100) * arcLength;

  const display = useAnimatedNumber(target, 1100);
  useEntryAnimation(
    ref,
    [{ strokeDashoffset: circumference }, { strokeDashoffset: circumference - drawn }],
    { duration: 1200, threshold: 0.4 },
  );

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: cfg.size, height: cfg.size }}
    >
      <svg
        width={cfg.size}
        height={cfg.size}
        viewBox={`0 0 ${String(cfg.size)} ${String(cfg.size)}`}
        aria-hidden="true"
        style={{ transform: `rotate(${String(cfg.rotation)}deg)` }}
      >
        <circle
          cx={cfg.size / 2}
          cy={cfg.size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={`${String(arcLength)} ${String(circumference)}`}
        />
        <circle
          ref={ref}
          cx={cfg.size / 2}
          cy={cfg.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - drawn}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className={cn("font-semibold leading-none tracking-tight tabular-nums", cfg.numberClass)}
        >
          <span>{display}</span>
        </span>
        {caption ? (
          <span
            className={cn(
              "font-medium uppercase tracking-wider text-muted-foreground",
              cfg.captionClass,
            )}
          >
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}
