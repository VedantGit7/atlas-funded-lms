"use client";

import { useRef, type ReactNode } from "react";
import { useEntryAnimation } from "../../../../components/motion/native-animation";
import { EntryReveal } from "../../../../components/motion/EntryReveal";

/** Scroll/entry reveal. Collapses to instant under reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <EntryReveal delay={delay} distance={18} className={className}>
      {children}
    </EntryReveal>
  );
}

/** Animated circular progress ring driven by design tokens. */
export function RadialProgress({
  value,
  size = 128,
  stroke = 9,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: ReactNode;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;
  useEntryAnimation(ref, [{ strokeDashoffset: circumference }, { strokeDashoffset: offset }], {
    duration: 1100,
  });

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
