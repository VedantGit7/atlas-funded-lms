"use client";

import { useEffect, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import { clientApi } from "../../lib/client-api";

type PlatformPricing = {
  enabled: boolean;
  productId: string | null;
  displayPriceLabel: string | null;
  priceTierHintCents: number | null;
};

type StorePricing = {
  courseId: string;
  ios: PlatformPricing;
  android: PlatformPricing;
};

/**
 * In-app purchase availability for a course.
 *
 * `GET /api/v1/courses/[id]/store-pricing` had no caller, so a course could be
 * configured and priced for the App Store and Play Store with nothing on the
 * web telling a learner it was purchasable there at all. The IAP verification
 * route exists and is exercised by the mobile client, which made this the one
 * missing half of that flow.
 *
 * Renders nothing when neither store is enabled — an academy that sells only on
 * the web should not see an empty "also available on" panel.
 */
export function CourseStorePricing({ courseId }: { courseId: string }) {
  const [pricing, setPricing] = useState<StorePricing | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await clientApi.get<{ data: StorePricing }>(
          `/api/v1/courses/${encodeURIComponent(courseId)}/store-pricing`,
        );
        setPricing(response.data);
      } catch {
        // Non-fatal and deliberately silent: store pricing is supplementary, and
        // a course page must not surface an error because IAP is unconfigured.
      }
    })();
  }, [courseId]);

  const platforms = [
    { key: "ios" as const, label: "App Store", Icon: Apple },
    { key: "android" as const, label: "Google Play", Icon: Smartphone },
  ].filter((platform) => pricing?.[platform.key].enabled === true);

  if (pricing === null || platforms.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">Also available in our mobile app</h3>
      <ul className="mt-3 space-y-2">
        {platforms.map(({ key, label, Icon }) => {
          const platform = pricing[key];
          return (
            <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-foreground">{label}</span>
              {platform.displayPriceLabel === null ? null : (
                <span className="font-semibold text-foreground">{platform.displayPriceLabel}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
