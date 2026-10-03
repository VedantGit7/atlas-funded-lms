"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ENTRY_EASING } from "./native-animation";

/** A single disclosure panel. Its content is ordinary, visible server HTML. */
export function FadePresence({
  open,
  children,
  className,
  duration = 200,
  offset = 0,
  collapse = false,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
  duration?: number;
  offset?: number;
  collapse?: boolean;
}) {
  const [present, setPresent] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  const previousOpen = useRef(open);

  useEffect(() => {
    const unchanged = previousOpen.current === open;
    previousOpen.current = open;
    const element = ref.current;
    if (!element) return;
    if (open) setPresent(true);
    // Match disclosure semantics: don't animate initially expanded content.
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (unchanged || media.matches || typeof element.animate !== "function") {
      if (!open) setPresent(false);
      return;
    }
    const frames = [
      {
        opacity: 0,
        transform: `translateY(${String(offset)}px)`,
        ...(collapse ? { height: "0px" } : {}),
      },
      {
        opacity: 1,
        transform: "translateY(0)",
        ...(collapse ? { height: `${String(element.scrollHeight)}px` } : {}),
      },
    ];
    const animation = element.animate(open ? frames : frames.reverse(), {
      duration,
      easing: ENTRY_EASING,
      fill: "backwards",
    });
    let cancelled = false;
    const finish = () => {
      if (!cancelled && !open) setPresent(false);
    };
    animation.onfinish = finish;
    const onPreference = () => {
      if (media.matches) {
        animation.cancel();
        finish();
      }
    };
    media.addEventListener("change", onPreference);
    return () => {
      cancelled = true;
      animation.onfinish = null;
      animation.cancel();
      media.removeEventListener("change", onPreference);
    };
  }, [open, duration, offset, collapse]);

  if (!open && !present) return null;
  return (
    <div ref={ref} className={className} inert={!open} aria-hidden={open ? undefined : true}>
      {children}
    </div>
  );
}
