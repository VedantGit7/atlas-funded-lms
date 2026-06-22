"use client";

import posthog from "posthog-js";
import {
  type ApprovedPostHogEvent,
  assertNoForbiddenPostHogProperties,
  isApprovedPostHogEvent,
  sanitizePostHogProperties,
} from "@atlas/observability/posthog/taxonomy";

let initialized = false;

export function initPostHogBrowser(): void {
  const key = process.env["NEXT_PUBLIC_POSTHOG_KEY"]?.trim();
  if (!key || initialized) {
    return;
  }

  const host = process.env["NEXT_PUBLIC_POSTHOG_HOST"]?.trim() || "https://us.i.posthog.com";

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "memory",
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
  if (!initialized || !isApprovedPostHogEvent(event)) {
    return;
  }

  const payload = properties ?? {};
  assertNoForbiddenPostHogProperties(payload);

  posthog.capture(event, sanitizePostHogProperties(payload));
}
