"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
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

/** sessionStorage has no change events within a tab worth listening to here. */
function subscribeToNothing(): () => void {
  return () => {};
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
  // Read through useSyncExternalStore so the first browser render matches the
  // server's (which can't see sessionStorage) and React then switches over,
  // instead of a hydration error on every visit after the first.
  const seenThisSession = useSyncExternalStore(subscribeToNothing, splashAlreadyDone, () => false);
  const [finished, setFinished] = useState(false);
  const bootDone = seenThisSession || finished;

  const handleFinished = useCallback(() => {
    markSplashDone();
    setFinished(true);
  }, []);

  if (!bootDone) {
    return <CertificateBuilderSplash publicName={publicName} onFinished={handleFinished} />;
  }

  return <>{children}</>;
}
