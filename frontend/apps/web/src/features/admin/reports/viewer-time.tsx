"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  currentAcademyFormat,
  formatDateTime,
  formatNumber,
} from "../../../lib/format/academy-format";
import { useAcademyFormat } from "../../../lib/format/academy-format-context";

/*
 * Dates and numbers are shown in the academy's time zone and locale
 * (lib/format/academy-format.ts), the same on the server and in the browser,
 * so they never cause a hydration error and an admin abroad still reads the
 * academy's own times. Relative times ("5m ago") depend on the clock: until
 * hydration ends they count from when the server rendered.
 */

const subscribe = () => () => {};

/** False on the server and while hydrating, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

const RenderedAtContext = createContext<number | null>(null);

/** Gives relative times below it the moment the server rendered the page. */
export function RenderedAtProvider({
  renderedAt,
  children,
}: {
  /** Epoch milliseconds on the server, or null when the page rendered in the browser. */
  renderedAt: number | null;
  children: ReactNode;
}) {
  return <RenderedAtContext.Provider value={renderedAt}>{children}</RenderedAtContext.Provider>;
}

/** The "now" relative times count from. */
function useViewerNow(): number {
  const hydrated = useHydrated();
  const renderedAt = useContext(RenderedAtContext);
  return hydrated || renderedAt === null ? Date.now() : renderedAt;
}

/**
 * How to format viewer-dependent text where a component will not do (helpers,
 * attributes, template strings): pass `locale` and `timeZone` to the `Intl` and
 * `toLocale*` calls and measure relative times from `now`. They are the
 * academy's time zone and locale.
 */
export type ViewerLocale = {
  locale: string | undefined;
  timeZone: string | undefined;
  now: number;
};

export function useViewerLocale(): ViewerLocale {
  const { locale, timeZone } = useAcademyFormat();
  const now = useViewerNow();
  return { locale, timeZone, now };
}

/**
 * Binds a formatter that takes the viewer last, so a component calls it the
 * way it did before the viewer was needed: `formatDate(value)`.
 */
export function withViewer<A extends unknown[], R>(
  format: (...args: [...A, ViewerLocale]) => R,
  viewer: ViewerLocale,
): (...args: A) => R {
  return (...args) => format(...args, viewer);
}

/**
 * The same settings for code that only runs after hydration, such as a click
 * handler or a CSV export.
 */
export function ownViewerLocale(): ViewerLocale {
  const { locale, timeZone } = currentAcademyFormat();
  return { locale, timeZone, now: Date.now() };
}

/** A relative time such as "5m ago", formatted by the report's own helper. */
export function RelativeTime({
  value,
  format,
}: {
  value: string | null;
  format: (value: string | null, now: number) => string;
}) {
  return <>{format(value, useViewerNow())}</>;
}

/** A date and time in the academy's time zone, such as "10 Oct, 05:30 pm". */
export function LocalDateTime({ value }: { value: string | null }) {
  const format = useAcademyFormat();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (
    <>
      {formatDateTime(
        date,
        { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" },
        format,
      )}
    </>
  );
}

/** A count grouped the academy's way, such as "1,00,000" in India. */
export function LocalCount({ value }: { value: number }) {
  return <>{formatNumber(value, undefined, useAcademyFormat())}</>;
}
