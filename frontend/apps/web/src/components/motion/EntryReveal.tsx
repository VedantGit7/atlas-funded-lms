"use client";

import { useRef, type ReactNode } from "react";
import { useEntryAnimation } from "./native-animation";

export function EntryReveal({
  children,
  delay = 0,
  distance = 20,
  className,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  className?: string | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEntryAnimation(
    ref,
    [
      { opacity: 0, transform: `translateY(${String(distance)}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: 550, delay: delay * 1000, threshold: 0.2 },
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
