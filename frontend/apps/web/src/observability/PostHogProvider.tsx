"use client";

import { useEffect } from "react";
import { initPostHogBrowser, setPostHogAnalyticsConsent } from "./posthog-browser";

type PostHogProviderProps = Readonly<{
  children: React.ReactNode;
  analyticsConsent?: boolean;
}>;

export function PostHogProvider({ children, analyticsConsent = false }: PostHogProviderProps) {
  useEffect(() => {
    initPostHogBrowser({ analyticsConsent });
  }, [analyticsConsent]);

  useEffect(() => {
    setPostHogAnalyticsConsent(analyticsConsent);
  }, [analyticsConsent]);

  return children;
}
