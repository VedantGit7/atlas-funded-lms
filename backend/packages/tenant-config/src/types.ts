import type { z } from "zod";
import type { tenantManifestSchema } from "./schema";

export type TenantManifest = z.infer<typeof tenantManifestSchema>;

export type ApplyPlanStep = {
  phase: string;
  action: string;
  detail: string;
  mutates: boolean;
};

export type ApplyPlan = {
  tenantSlug: string;
  environment: string;
  manifestVersion: string;
  steps: ApplyPlanStep[];
  warnings: string[];
};

export type VerifyExpectation = {
  key: string;
  expected: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
};

export type VerifyReport = {
  tenantSlug: string;
  environment: string;
  expectations: VerifyExpectation[];
  passed: boolean;
};

export type ValidationIssue = {
  path: string;
  message: string;
};
