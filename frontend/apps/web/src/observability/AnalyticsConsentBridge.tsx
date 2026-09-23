"use client";

import { useEffect, useState } from "react";
import { clientApi } from "../lib/client-api";
import { PostHogProvider } from "./PostHogProvider";

type AnalyticsConsentBridgeProps = {
  children: React.ReactNode;
  hasSession: boolean;
};

type PreferencesResponse = {
  data: {
    privacy?: {
      analyticsConsent?: boolean;
    };
  };
};

export function AnalyticsConsentBridge({ children, hasSession }: AnalyticsConsentBridgeProps) {
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Anonymous pages must not trigger private requests and automatic auth refreshes.
    // Cookie presence only permits the fetch; the API still verifies consent.
    if (!hasSession) {
      setAnalyticsConsent(false);
      return;
    }

    async function loadConsent() {
      try {
        const response = await clientApi.get<PreferencesResponse>("/api/v1/me/preferences");
        if (!cancelled) {
          setAnalyticsConsent(response.data.privacy?.analyticsConsent === true);
        }
      } catch {
        if (!cancelled) {
          setAnalyticsConsent(false);
        }
      }
    }

    void loadConsent();

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  return (
    <PostHogProvider analyticsConsent={hasSession && analyticsConsent}>{children}</PostHogProvider>
  );
}
