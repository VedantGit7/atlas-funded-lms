"use client";

import { createContext, useContext, useEffect, useId, useMemo, type ReactNode } from "react";
import {
  DEFAULT_ACADEMY_FORMAT,
  setAcademyFormatResolver,
  type AcademyFormat,
} from "./academy-format";

type Scope = { format: AcademyFormat; depth: number };

const AcademyFormatContext = createContext<Scope>({ format: DEFAULT_ACADEMY_FORMAT, depth: 0 });

/**
 * The browser shows one academy per page. Providers record their value here
 * so code that runs outside a render (a click handler, a CSV export) formats
 * the same way; the innermost one wins, such as a learner's own time zone.
 */
const browserScopes = new Map<string, Scope>();

function innermostBrowserFormat(): AcademyFormat {
  let best: Scope | null = null;
  for (const scope of browserScopes.values()) {
    if (!best || scope.depth >= best.depth) best = scope;
  }
  return best?.format ?? DEFAULT_ACADEMY_FORMAT;
}

/*
 * On the server several academies' pages render at once, so the settings come
 * from the request's own provider through context. Server code only formats
 * while rendering (effects and click handlers run in the browser). React's
 * server renderer keeps the provider value of the component it is rendering
 * on the context object, which is what `useContext` returns; reading it here
 * also works inside `useMemo` and `useState` initialisers, where hooks may not
 * be called. tests/unit/frontend/academy-format.test.tsx pins this behaviour.
 */
type ServerContext = { _currentValue?: Scope; _currentValue2?: Scope };

setAcademyFormatResolver(() => {
  if (typeof window === "undefined") {
    // The streaming renderer Next.js uses keeps the value in `_currentValue`,
    // the older string renderer in `_currentValue2`; the one not rendering
    // holds the depth-0 default, so the deeper scope is the live one.
    const context = AcademyFormatContext as unknown as ServerContext;
    const primary = context._currentValue;
    const secondary = context._currentValue2;
    const live = (secondary?.depth ?? 0) > (primary?.depth ?? 0) ? secondary : primary;
    return live?.format ?? DEFAULT_ACADEMY_FORMAT;
  }
  return innermostBrowserFormat();
});

/**
 * Gives every date, number and amount below it the academy's time zone,
 * locale and currency. Nest a second one to show a learner's own time zone.
 */
export function AcademyFormatProvider({
  value,
  children,
}: {
  value: AcademyFormat;
  children: ReactNode;
}) {
  const id = useId();
  const parent = useContext(AcademyFormatContext);
  const { timeZone, locale, currency } = value;
  const depth = parent.depth + 1;
  const scope = useMemo<Scope>(
    () => ({ format: { timeZone, locale, currency }, depth }),
    [timeZone, locale, currency, depth],
  );
  // Recorded during render so the children rendering next already see it.
  if (typeof window !== "undefined") browserScopes.set(id, scope);
  useEffect(() => {
    browserScopes.set(id, scope);
    return () => {
      browserScopes.delete(id);
    };
  }, [id, scope]);
  return <AcademyFormatContext.Provider value={scope}>{children}</AcademyFormatContext.Provider>;
}

/** The academy's format, for components that pass it on. */
export function useAcademyFormat(): AcademyFormat {
  return useContext(AcademyFormatContext).format;
}
