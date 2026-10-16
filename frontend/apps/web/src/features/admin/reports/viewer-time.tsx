"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/*
 * Text that depends on the viewer's clock, locale or timezone ("5m ago",
 * "Oct 10, 05:30 PM", "1,00,000") would differ between a server-rendered page
 * and the browser's first render, which React reports as a hydration error.
 * Until hydration ends these render a fixed form: relative times measured from
 * when the server rendered, dates in UTC and numbers in en-US. Afterwards they
 * use the viewer's own settings, as they did when the page rendered only in
 * the browser.
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
 * `toLocale*` calls and measure relative times from `now`. Until hydration ends
 * they are the fixed forms above; afterwards `locale` and `timeZone` are
 * undefined, which means the viewer's own.
 */
export type ViewerLocale = {
  locale: string | undefined;
  timeZone: string | undefined;
  now: number;
};

export function useViewerLocale(): ViewerLocale {
  const hydrated = useHydrated();
  const now = useViewerNow();
  return hydrated
    ? { locale: undefined, timeZone: undefined, now }
    : { locale: "en-US", timeZone: "UTC", now };
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

/** A date and time in the viewer's locale and timezone, such as "Oct 10, 05:30 PM". */
export function LocalDateTime({ value }: { value: string | null }) {
  const hydrated = useHydrated();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  return (
    <>
      {hydrated
        ? date.toLocaleString(undefined, options)
        : date.toLocaleString("en-US", { ...options, timeZone: "UTC" })}
    </>
  );
}

/** A count grouped the viewer's way, such as "1,00,000" in India. */
export function LocalCount({ value }: { value: number }) {
  const hydrated = useHydrated();
  return <>{hydrated ? value.toLocaleString() : value.toLocaleString("en-US")}</>;
}
