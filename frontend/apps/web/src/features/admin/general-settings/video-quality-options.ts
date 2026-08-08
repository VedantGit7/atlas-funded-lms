export const VIDEO_QUALITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "auto", label: "Auto" },
] as const;

export type VideoQualityValue = (typeof VIDEO_QUALITY_OPTIONS)[number]["value"];

export function isVideoQualityValue(value: string): value is VideoQualityValue {
  return VIDEO_QUALITY_OPTIONS.some((option) => option.value === value);
}

export function labelForVideoQuality(value: string): string {
  return VIDEO_QUALITY_OPTIONS.find((option) => option.value === value)?.label ?? "Low";
}
