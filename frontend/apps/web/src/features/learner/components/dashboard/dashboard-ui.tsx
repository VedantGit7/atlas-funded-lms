"use client";

import { useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  useEntryAnimation,
  useReducedMotion,
} from "../../../../components/motion/native-animation";
import { EntryReveal } from "../../../../components/motion/EntryReveal";
import { useCurrency } from "../../../currency/CurrencyProvider";

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

/** Animated numeric bar (0-100) using tokens. */
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const clamped = Math.max(0, Math.min(100, value));
  const width = `${String(clamped)}%`;
  useEntryAnimation(ref, [{ width: 0 }, { width }], { duration: 1000 });
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-[var(--muted)] ${className}`}>
      <div ref={ref} className="h-full rounded-full bg-[var(--primary)]" style={{ width }} />
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
export function HeroSceneMount({ color }: { color: string }) {
  const { rates } = useCurrency();
  const usdInr = typeof rates["INR"] === "number" ? rates["INR"] : null;
  const reduce = useReducedMotion();
  if (reduce) return <CoreFallback color={color} />;
  return <TradingScene accent={color} usdInr={usdInr} />;
}
