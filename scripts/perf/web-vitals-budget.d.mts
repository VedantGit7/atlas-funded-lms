export type WebVitalsMetric = "lcpMs" | "cls" | "tbtMs" | "fcpMs" | "ttfbMs";

export type WebVitalsBudget = { limit: number; severity: "error" | "warn"; label: string };

export type WebVitalsResult = {
  route: string;
  metric: WebVitalsMetric;
  label: string;
  severity: "error" | "warn";
  limit: number;
  median: number | null;
  runs: number;
  status: "pass" | "over" | "missing";
};

export declare const WEB_VITALS_ROUTES: readonly string[];
export declare const WEB_VITALS_BUDGETS: Record<WebVitalsMetric, WebVitalsBudget>;
export declare const DESKTOP_PROFILE: {
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  cpuSlowdown: number;
  latencyMs: number;
  downloadBytesPerSecond: number;
  uploadBytesPerSecond: number;
};

export declare function median(values: ReadonlyArray<number | null>): number | null;
export declare function evaluateWebVitals(
  samples: ReadonlyArray<{ route: string } & Partial<Record<WebVitalsMetric, number | null>>>,
  budgets?: Record<WebVitalsMetric, WebVitalsBudget>,
): {
  results: WebVitalsResult[];
  failures: WebVitalsResult[];
  warnings: WebVitalsResult[];
  passed: boolean;
};
export declare function describeResult(result: WebVitalsResult): string;
export declare function assertProductionBuild(html: string): void;
