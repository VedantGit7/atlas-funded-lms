"use client";

import { useEffect } from "react";
import { initPostHogBrowser } from "./posthog-browser";

type PostHogProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    initPostHogBrowser();
  }, []);

  return children;
}
