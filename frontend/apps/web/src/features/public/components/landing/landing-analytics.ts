"use client";

import type { MouseEvent } from "react";
import { captureProductEvent } from "@/observability/capture-product-event";

export function captureLandingCtaClick(source: string) {
  captureProductEvent("cta_outbound_clicked", {
    routeGroup: "public",
    source,
  });
}

export function useLandingCtaHandler(source: string) {
  return (_event: MouseEvent<HTMLElement>) => {
    captureLandingCtaClick(source);
    // Allow navigation to proceed.
  };
}
