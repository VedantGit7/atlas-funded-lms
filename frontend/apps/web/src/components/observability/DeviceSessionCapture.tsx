"use client";

import { useEffect, useRef } from "react";
import { clientApi } from "../../lib/client-api";

async function hashDeviceFingerprint(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  }

  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function DeviceSessionCapture() {
  const capturedRef = useRef(false);

  useEffect(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;

    void (async () => {
      const userAgent = navigator.userAgent;
      const screenSize = `${String(window.screen.width)}x${String(window.screen.height)}`;
      const deviceFingerprint = await hashDeviceFingerprint(`${userAgent}|${screenSize}`);

      try {
        await clientApi.post(
          "/api/v1/devices/sessions",
          { platform: "web", userAgent, deviceFingerprint },
          "device-session-capture",
        );
      } catch {
        // Best-effort capture; ignore bootstrap failures.
      }
    })();
  }, []);

  return null;
}
