"use client";

import { useEffect, useState } from "react";
import { FUNDED_BEYOND_LOGO_URL } from "../../../lib/brand";

type CertificateBuilderSplashProps = {
  publicName: string;
  onFinished: () => void;
  minDurationMs?: number;
  /** Override only for tests; production always uses avatar-gradient. */
  logoUrl?: string;
};

/**
 * Dark boot splash: FundedBeyond avatar-gradient mark + soft glow.
 */
export function CertificateBuilderSplash({
  publicName,
  onFinished,
  minDurationMs = 1600,
  logoUrl = FUNDED_BEYOND_LOGO_URL,
}: CertificateBuilderSplashProps) {
  const [assetReady, setAssetReady] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const probe = new window.Image();
    probe.decoding = "async";
    probe.onload = () => {
      if (!cancelled) {
        setLogoFailed(false);
        setAssetReady(true);
      }
    };
    probe.onerror = () => {
      if (!cancelled) {
        setLogoFailed(true);
        setAssetReady(true);
      }
    };
    probe.src = logoUrl;

    if (probe.complete && probe.naturalWidth > 0) {
      setLogoFailed(false);
      setAssetReady(true);
    }

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [logoUrl]);

  useEffect(() => {
    if (!assetReady) return;

    const started = Date.now();
    let exitTimer: number | undefined;
    let removeTimer: number | undefined;

    const wait = Math.max(0, minDurationMs - (Date.now() - started));
    exitTimer = window.setTimeout(() => {
      setExiting(true);
      removeTimer = window.setTimeout(() => {
        onFinished();
      }, 380);
    }, wait);

    return () => {
      if (exitTimer != null) window.clearTimeout(exitTimer);
      if (removeTimer != null) window.clearTimeout(removeTimer);
    };
  }, [assetReady, minDurationMs, onFinished]);

  return (
    <div
      id="certificate-builder-boot"
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      data-exiting={exiting ? "true" : "false"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#05080a",
      }}
    >
      <div
        className="cert-builder-boot-mark"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "5.5rem",
          height: "5.5rem",
        }}
      >
        <span className="cert-builder-boot-glow" aria-hidden="true" />
        {!logoFailed ? (
          <img
            className="cert-builder-boot-logo"
            src={logoUrl}
            alt=""
            width={72}
            height={72}
            decoding="async"
            style={{
              position: "relative",
              zIndex: 1,
              width: "4.5rem",
              height: "4.5rem",
              objectFit: "contain",
              borderRadius: "9999px",
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "4.5rem",
              height: "4.5rem",
              borderRadius: "9999px",
              background: "linear-gradient(135deg, #3d7ab5 0%, #1a3a5c 100%)",
              color: "#fff",
              fontSize: "1.25rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            FB
          </span>
        )}
      </div>
      <span className="sr-only">Loading Certificate Builder for {publicName}</span>
    </div>
  );
}
