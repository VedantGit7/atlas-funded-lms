"use client";

import { useEffect, useRef } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { toast } from "../../../lib/feedback/toast";

const BASELINE_STORAGE_KEY = "atlas:gamification:achievement-baseline";

type AchievementBaseline = {
  levelKey: string | null;
  awardedBadgeKeys: string[];
};

function readBaseline(): AchievementBaseline | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BASELINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AchievementBaseline;
    if (!parsed || !Array.isArray(parsed.awardedBadgeKeys)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBaseline(baseline: AchievementBaseline) {
  sessionStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
}

function formatLevelLabel(levelKey: string | null): string {
  if (!levelKey) return "a new level";
  return levelKey.replace(/[_-]/g, " ");
}

export function AchievementToastListener() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function checkAchievements() {
      try {
        const [profileResponse, progressResponse] = await Promise.all([
          clientApi.get<{
            data: { levelKey: string | null };
          }>("/api/v1/me/gamification"),
          clientApi.get<{
            data: {
              items: Array<{ key: string; name: string; awarded?: boolean }>;
            };
          }>("/api/v1/me/badges/progress"),
        ]);

        const currentLevelKey = profileResponse.data.levelKey;
        const awardedBadges = progressResponse.data.items.filter((badge) => badge.awarded);
        const currentBadgeKeys = awardedBadges.map((badge) => badge.key);

        const previous = readBaseline();
        if (previous) {
          if (previous.levelKey !== currentLevelKey && currentLevelKey) {
            toast.success(`Level up! You reached ${formatLevelLabel(currentLevelKey)}.`);
          }

          const previousKeys = new Set(previous.awardedBadgeKeys);
          for (const badge of awardedBadges) {
            if (!previousKeys.has(badge.key)) {
              toast.success(`Badge earned: ${badge.name}`);
            }
          }
        }

        writeBaseline({
          levelKey: currentLevelKey,
          awardedBadgeKeys: currentBadgeKeys,
        });
      } catch (error) {
        if (error instanceof ClientApiError && error.code === "ENTITLEMENT_REQUIRED") {
          return;
        }
      }
    }

    void checkAchievements();
  }, []);

  return null;
}
