"use client";

import { useEffect, useState } from "react";
import { clientApi } from "../lib/client-api";
import { PostHogProvider } from "./PostHogProvider";

type AnalyticsConsentBridgeProps = {
  children: React.ReactNode;
};

type PreferencesResponse = {
  data: {
    privacy?: {
      analyticsConsent?: boolean;
    };
  };
};

export function AnalyticsConsentBridge({ children }: AnalyticsConsentBridgeProps) {
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConsent() {
      try {
        const response = await clientApi.get<PreferencesResponse>("/api/v1/me/preferences");
        if (!cancelled) {
          setAnalyticsConsent(response.data.privacy?.analyticsConsent ?? false);
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
  }, []);

  return <PostHogProvider analyticsConsent={analyticsConsent}>{children}</PostHogProvider>;
}
