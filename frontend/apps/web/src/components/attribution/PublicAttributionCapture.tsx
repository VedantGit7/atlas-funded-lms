"use client";

import { Suspense } from "react";
import { UtmCaptureEffect } from "@/components/attribution/UtmCaptureEffect";

export function PublicAttributionCapture() {
  return (
    <Suspense fallback={null}>
      <UtmCaptureEffect />
    </Suspense>
  );
}
