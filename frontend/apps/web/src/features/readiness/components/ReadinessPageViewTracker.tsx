"use client";

import { useEffect } from "react";
import { captureProductEvent } from "../../../observability/capture-product-event";

export function ReadinessPageViewTracker() {
  useEffect(() => {
    captureProductEvent("readiness_viewed", {
      routeGroup: "learner",
      source: "readiness_page",
    });
  }, []);

  return null;
}
