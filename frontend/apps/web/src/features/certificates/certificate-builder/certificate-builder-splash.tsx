"use client";

import { useEffect, useState } from "react";
import { tenantInitials } from "../../../components/patterns/TenantBrandMark";

type CertificateBuilderSplashProps = {
  publicName: string;
  onFinished: () => void;
  minDurationMs?: number;
  /** The tenant's own logo; without one the splash shows their initials. */
  logoUrl?: string | null;
};

/**
 * Dark boot splash: the tenant's mark (or their initials) plus a soft glow.
 *
 * The initials disc used to read a hardcoded "FB", so every academy booted the
 * certificate builder under FundedBeyond's monogram.
 */
export function CertificateBuilderSplash({
  publicName,
  onFinished,
  minDurationMs = 1600,
  logoUrl = null,
}: CertificateBuilderSplashProps) {
  const [assetReady, setAssetReady] = useState(false);
  // No logo at all goes straight to the initials disc; the probe below only
  // exists to catch a logo URL that fails to load (expired or moved asset).
  const [logoFailed, setLogoFailed] = useState(logoUrl == null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (logoUrl == null) {
      setLogoFailed(true);
      setAssetReady(true);
      return;
    }
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
    let removeTimer: number | undefined;

    const wait = Math.max(0, minDurationMs - (Date.now() - started));
    const exitTimer = window.setTimeout(() => {
      setExiting(true);
      removeTimer = window.setTimeout(() => {
        onFinished();
      }, 380);
    }, wait);

    return () => {
      // removeTimer is assigned inside the first timeout, so it genuinely may
      // still be undefined when cleanup runs.
      window.clearTimeout(exitTimer);
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
        {!logoFailed && logoUrl != null ? (
          // Raw <img> on purpose: the probe above preloads this exact URL, and
          // tenant logos are arbitrary remote (possibly signed) URLs that the
          // image optimizer cannot be pointed at.
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
            {tenantInitials(publicName)}
          </span>
        )}
      </div>
      <span className="sr-only">Loading Certificate Builder for {publicName}</span>
    </div>
  );
}
