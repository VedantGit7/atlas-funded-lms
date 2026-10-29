"use client";

import { useEffect } from "react";
import { browserSentryOptions, loadBrowserSentry } from "./browser-sentry";

/**
 * Starts browser Sentry once the page is idle, so the SDK stays out of every
 * route's first load (audit H16); its own handlers report uncaught errors from
 * then on. Rendering errors before that reach Sentry through the error
 * boundaries (reportClientError), which load it on demand. This replaces
 * Sentry's instrumentation-client.ts, whose entry and injected values alone
 * cost the learner first load 0.28 kB gzipped.
 */
export function BrowserSentryStarter(): null {
  useEffect(() => {
    if (!browserSentryOptions().enabled) return;
    // A chunk that fails to load is retried by the next error report.
    const start = () => void loadBrowserSentry().catch(() => {});
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    const timer = setTimeout(start, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return null;
}
