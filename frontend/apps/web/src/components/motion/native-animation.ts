"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
export const ENTRY_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
};
const snapshot = () => window.matchMedia(QUERY).matches;
const serverSnapshot = () => true;

/** The server renders a calm fallback; hydration reconciles the OS preference. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Animate the already-rendered content once on entry. No JavaScript is needed to see it. */
export function useEntryAnimation<T extends Element>(
  ref: RefObject<T | null>,
  keyframes: Keyframe[],
  { duration, delay = 0, threshold = 0 }: { duration: number; delay?: number; threshold?: number },
) {
  const frames = JSON.stringify(keyframes);
  useEffect(() => {
    const element = ref.current;
    const media = window.matchMedia(QUERY);
    if (!element || media.matches || typeof element.animate !== "function") return;
    let animation: Animation | undefined;
    let started = false;
    const start = () => {
      if (started || media.matches) return;
      started = true;
      animation = element.animate(JSON.parse(frames) as Keyframe[], {
        duration,
        delay,
        easing: ENTRY_EASING,
        fill: "backwards",
      });
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? undefined
        : new IntersectionObserver(
            (entries) => {
              if (
                entries.some(
                  (entry) => entry.isIntersecting && entry.intersectionRatio >= threshold,
                )
              ) {
                start();
                observer?.disconnect();
              }
            },
            { threshold },
          );
    if (observer) observer.observe(element);
    else start();
    const onPreference = () => {
      if (media.matches) {
        started = true;
        observer?.disconnect();
        animation?.cancel();
        animation = undefined;
      }
    };
    media.addEventListener("change", onPreference);
    return () => {
      observer?.disconnect();
      animation?.cancel();
      media.removeEventListener("change", onPreference);
    };
  }, [ref, frames, duration, delay, threshold]);
}

// Solve the same cubic-bezier curve as the entry animations for numeric values.
function easedProgress(progress: number) {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step += 1) {
    const t = (low + high) / 2;
    const x = 3 * (1 - t) ** 2 * t * 0.16 + 3 * (1 - t) * t ** 2 * 0.3 + t ** 3;
    if (x < progress) low = t;
    else high = t;
  }
  return 1 - (1 - (low + high) / 2) ** 3;
}

export function useAnimatedNumber(target: number, duration: number) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    let frame = 0;
    const from = current.current;
    const started = performance.now();
    const update = (next: number) => {
      current.current = next;
      setValue(Math.round(next));
    };
    const finish = () => {
      cancelAnimationFrame(frame);
      update(target);
    };
    const tick = (time: number) => {
      const progress = Math.min(1, (time - started) / duration);
      if (progress >= 1) finish();
      else {
        update(from + (target - from) * easedProgress(progress));
        frame = requestAnimationFrame(tick);
      }
    };
    const onPreference = () => {
      if (media.matches) finish();
    };
    if (media.matches || duration <= 0) finish();
    else frame = requestAnimationFrame(tick);
    media.addEventListener("change", onPreference);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", onPreference);
    };
  }, [target, duration]);
  return value;
}
