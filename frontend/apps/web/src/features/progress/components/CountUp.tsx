"use client";

import { useAnimatedNumber } from "../../../components/motion/native-animation";

type CountUpProps = {
  value: number;
  /** Formats the rounded intermediate value (e.g. thousands grouping). */
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
};

/** Animates a number from 0 to `value`; static under reduced motion. */
export function CountUp({ value, format, durationMs = 1100, className }: CountUpProps) {
  const current = useAnimatedNumber(value, durationMs);
  const text = format ? format(current) : String(current);
  return <span className={className}>{text}</span>;
}
