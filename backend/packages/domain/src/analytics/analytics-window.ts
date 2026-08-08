import type { ItemStatisticsWindowKey } from "./analytics-definition-registry";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function itemStatisticWindowCutoff(
  windowKey: ItemStatisticsWindowKey,
  now = new Date(),
): Date | null {
  if (windowKey === "all_time") {
    return null;
  }

  const days = windowKey === "rolling_30d" ? 30 : 90;
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/**
 * Live projection writes only `all_time`. Rolling windows are derived on read
 * (or via explicit recompute) so counters do not permanently inflate.
 */
export function liveItemStatisticWindowKeys(): readonly ItemStatisticsWindowKey[] {
  return ["all_time"];
}

export function isRollingItemStatisticWindow(
  windowKey: string,
): windowKey is Exclude<ItemStatisticsWindowKey, "all_time"> {
  return windowKey === "rolling_30d" || windowKey === "rolling_90d";
}
