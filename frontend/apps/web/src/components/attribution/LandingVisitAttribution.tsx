"use client";

import { useEffect, useRef } from "react";
import { sendAttributionEvent } from "@/lib/attribution/utm-storage";

export function LandingVisitAttribution() {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    void sendAttributionEvent({ eventType: "visited" });
  }, []);

  return null;
}
