"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

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
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
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
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;

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
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: reduce ? 0 : 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Animated numeric bar (0-100) using tokens. */
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)] ${className}`}>
      <motion.div
        className="h-full rounded-full bg-[var(--primary)]"
        initial={reduce ? { width: `${String(clamped)}%` } : { width: 0 }}
        whileInView={{ width: `${String(clamped)}%` }}
        viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 1, ease: EASE }}
      />
    </div>
  );
}

const TradingScene = dynamic(() => import("./TradingScene"), {
  ssr: false,
  loading: () => <CoreFallback />,
});

function CoreFallback({ color = "#6aa9ff" }: { color?: string }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md motion-safe:animate-pulse"
        style={{ background: `radial-gradient(circle at 35% 30%, ${color}, transparent 70%)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80"
        style={{ background: `radial-gradient(circle at 35% 30%, ${color}cc, ${color}22 70%)` }}
      />
    </div>
  );
}

/** Renders the cycling trading 3D scene, or a calm static orb under reduced motion. */
export function HeroSceneMount({ color, usdInr }: { color: string; usdInr: number | null }) {
  const reduce = useReducedMotion();
  if (reduce) return <CoreFallback color={color} />;
  return <TradingScene accent={color} usdInr={usdInr} />;
}
