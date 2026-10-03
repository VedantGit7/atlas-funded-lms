"use client";

import type { PostHog } from "posthog-js";
import {
  type ApprovedPostHogEvent,
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "./posthog-taxonomy";

let consentGranted = false;
let posthog: PostHog | undefined;
let pendingInitialization: Promise<void> | undefined;
let consentVersion = 0;

export function setPostHogAnalyticsConsent(granted: boolean): void {
  if (consentGranted !== granted) consentVersion += 1;
  consentGranted = granted;
  if (!granted && posthog) {
    posthog.opt_out_capturing();
    return;
  }
  if (granted && posthog) {
    posthog.opt_in_capturing({ captureEventName: false });
  }
}

export function getPostHogAnalyticsConsent(): boolean {
  return consentGranted;
}

export function initPostHogBrowser(options?: { analyticsConsent?: boolean }): void {
  if (options?.analyticsConsent != null) {
    setPostHogAnalyticsConsent(options.analyticsConsent);
  }
  const key = process.env["NEXT_PUBLIC_POSTHOG_KEY"]?.trim();
  if (!key || posthog || !consentGranted || pendingInitialization) return;

  const host = process.env["NEXT_PUBLIC_POSTHOG_HOST"]?.trim() || "https://eu.i.posthog.com";
  // The SDK is optional and must not be part of the initial route bundle.
  // Consent can change while the chunk is in flight, including during logout.
  pendingInitialization = import("posthog-js")
    .then(({ default: sdk }) => {
      if (!consentGranted) return;
      sdk.init(key, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        // Atlas uses explicit taxonomy events, not PostHog feature flags.
        // SDK reset reloads flags independently of capture consent.
        advanced_disable_flags: true,
        persistence: "memory",
        opt_out_capturing_by_default: true,
      });
      // SDK consent storage can contain an older denial independently of the
      // configured in-memory event persistence. Reconcile current consent.
      sdk.opt_in_capturing({ captureEventName: false });
      posthog = sdk;
    })
    // Analytics is best effort; blocked/offline chunks must not break the app.
    .catch(() => {})
    .finally(() => {
      pendingInitialization = undefined;
    });
}

export function resetPostHogBrowser(): void {
  consentVersion += 1;
  setPostHogAnalyticsConsent(false);
  if (posthog) posthog.reset();
}

export function captureApprovedClientEvent(
  event: ApprovedPostHogEvent,
  properties?: Record<string, unknown>,
): void {
  if (!consentGranted || !isApprovedPostHogEvent(event)) {
    return;
  }

  const payload = properties ?? {};
  assertNoForbiddenPostHogProperties(payload);

  const sanitized = sanitizePostHogProperties(payload);
  if (posthog) {
    posthog.capture(event, sanitized);
  } else if (pendingInitialization) {
    const version = consentVersion;
    void pendingInitialization.then(() => {
      if (posthog && consentGranted && version === consentVersion) {
        posthog.capture(event, sanitized);
      }
    });
  }
}
