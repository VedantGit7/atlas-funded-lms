"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchInsightSettings } from "./admin-insights-api";
import { ADMIN_INSIGHTS_DEFAULT_HREF, adminInsightHref } from "./admin-insights-catalog";

export function AdminInsightsHomeRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetchInsightSettings("dashboard")
      .then((response) => {
        if (cancelled) return;
        const slug = response.data.settings.defaultSection;
        router.replace(adminInsightHref(slug));
      })
      .catch(() => {
        if (!cancelled) router.replace(ADMIN_INSIGHTS_DEFAULT_HREF);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <p className="text-sm text-[var(--admin-on-surface-variant)]">
      Opening your default insights section...
    </p>
  );
}
