"use client";

import { useEffect, useRef } from "react";
import { clientApi } from "../../lib/client-api";

/**
 * The DOM lib types `crypto` and `crypto.subtle` as always present, but a
 * browser on an insecure origin (plain HTTP beyond localhost) exposes neither.
 * That is exactly when the non-crypto fallback exists to serve, so the lookup
 * goes through `unknown` rather than trusting the lib type.
 */
function readSubtleCrypto(): SubtleCrypto | undefined {
  const candidate: unknown = globalThis.crypto;
  if (candidate === null || typeof candidate !== "object") return undefined;
  const subtle = (candidate as { subtle?: SubtleCrypto }).subtle;
  return typeof subtle === "object" ? subtle : undefined;
}

async function hashDeviceFingerprint(input: string): Promise<string> {
  const subtle = readSubtleCrypto();

  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
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
