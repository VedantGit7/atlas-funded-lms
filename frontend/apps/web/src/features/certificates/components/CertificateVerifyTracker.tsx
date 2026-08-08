"use client";

import { useEffect } from "react";
import { captureProductEvent } from "../../../observability/capture-product-event";

type CertificateVerifyTrackerProps = {
  credentialId: string;
  verified: boolean;
};

export function CertificateVerifyTracker({ credentialId, verified }: CertificateVerifyTrackerProps) {
  useEffect(() => {
    if (!verified) return;
    captureProductEvent("certificate_verified", {
      routeGroup: "public",
      source: "verify_page",
      contentType: credentialId,
      outcome: "verified",
    });
  }, [credentialId, verified]);

  return null;
}
