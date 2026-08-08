"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureUtmFromSearchParams, persistUtmAttribution } from "@/lib/attribution/utm-storage";

export function UtmCaptureEffect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const attribution = captureUtmFromSearchParams(searchParams);
    if (attribution) {
      persistUtmAttribution(attribution);
    }
  }, [searchParams]);

  return null;
}
