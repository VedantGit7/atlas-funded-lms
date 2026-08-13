"use client";

import posthog from "posthog-js";
import {
  type ApprovedPostHogEvent,
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "./posthog-taxonomy";

let initialized = false;
let consentGranted = false;

export function setPostHogAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (!granted && initialized) {
    posthog.opt_out_capturing();
    return;
  }
  if (granted && initialized) {
    posthog.opt_in_capturing();
  }
}

export function getPostHogAnalyticsConsent(): boolean {
  return consentGranted;
}

export function initPostHogBrowser(options?: { analyticsConsent?: boolean }): void {
  const key = process.env["NEXT_PUBLIC_POSTHOG_KEY"]?.trim();
  if (!key || initialized) {
    if (options?.analyticsConsent != null) {
      setPostHogAnalyticsConsent(options.analyticsConsent);
    }
    return;
  }

  consentGranted = options?.analyticsConsent ?? false;

  const host = process.env["NEXT_PUBLIC_POSTHOG_HOST"]?.trim() || "https://eu.i.posthog.com";

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "memory",
    opt_out_capturing_by_default: !consentGranted,
  });

  initialized = true;
}

export function resetPostHogBrowser(): void {
  if (!initialized) {
    return;
  }

  posthog.reset();
}

export function captureApprovedClientEvent(
  event: ApprovedPostHogEvent,
  properties?: Record<string, unknown>,
): void {
  if (!initialized || !consentGranted || !isApprovedPostHogEvent(event)) {
    return;
  }

  const payload = properties ?? {};
  assertNoForbiddenPostHogProperties(payload);

  posthog.capture(event, sanitizePostHogProperties(payload));
}
