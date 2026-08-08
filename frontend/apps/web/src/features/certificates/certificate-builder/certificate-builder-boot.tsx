"use client";

import { useCallback, useState } from "react";
import { CertificateBuilderSplash } from "./certificate-builder-splash";

const SPLASH_SESSION_KEY = "certificate-studio:splash-done";

function splashAlreadyDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashDone(): void {
  try {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

type CertificateBuilderBootProps = {
  publicName: string;
  children: React.ReactNode;
};

/**
 * Shows the boot splash once per browser tab session, then renders children.
 * Nested Studio routes share this so navigating home ↔ studio does not re-splash.
 */
export function CertificateBuilderBoot({ publicName, children }: CertificateBuilderBootProps) {
  const [bootDone, setBootDone] = useState(() => splashAlreadyDone());

  const handleFinished = useCallback(() => {
    markSplashDone();
    setBootDone(true);
  }, []);

  if (!bootDone) {
    return <CertificateBuilderSplash publicName={publicName} onFinished={handleFinished} />;
  }

  return <>{children}</>;
}
