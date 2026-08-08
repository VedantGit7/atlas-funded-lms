"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

type CountUpProps = {
  value: number;
  /** Formats the rounded intermediate value (e.g. thousands grouping). */
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
};

/** Animates a number from 0 to `value`; static under reduced motion. */
export function CountUp({ value, format, durationMs = 1100, className }: CountUpProps) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : 0);
  const text = useTransform(motionValue, (current) => {
    const rounded = Math.round(current);
    return format ? format(rounded) : String(rounded);
  });

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: durationMs / 1000, ease: EASE });
    return () => {
      controls.stop();
    };
  }, [motionValue, value, reduce, durationMs]);

  return <motion.span className={className}>{text}</motion.span>;
}
