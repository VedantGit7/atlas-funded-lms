"use client";

import type { ComponentProps } from "react";
import { domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";

export { AnimatePresence, useReducedMotion } from "motion/react";

// These surfaces use entry, viewport and presence animations, not drag or
// layout projection. Keep the supported feature set synchronous for SSR and
// first interaction, while avoiding Motion's full gesture/layout renderer.
type AnimationProps<T> = Omit<T, "drag" | "layout" | "layoutId">;
function Div(props: AnimationProps<ComponentProps<typeof m.div>>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div {...props} />
    </LazyMotion>
  );
}
function Li(props: AnimationProps<ComponentProps<typeof m.li>>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.li {...props} />
    </LazyMotion>
  );
}
function Path(props: AnimationProps<ComponentProps<typeof m.path>>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.path {...props} />
    </LazyMotion>
  );
}
function Circle(props: AnimationProps<ComponentProps<typeof m.circle>>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.circle {...props} />
    </LazyMotion>
  );
}

export const motion = { div: Div, li: Li, path: Path, circle: Circle };
