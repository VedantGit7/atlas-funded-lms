import {
  DeploymentConfigurationError,
  validateDeploymentConfiguration,
  type DeploymentService,
} from "@atlas/core/config/deployment-contract";
import { validateRateLimitConfiguration } from "./rate-limit-store";
import { parseStorageEnv } from "@atlas/storage/schemas/storage-env";

export function validateDeploymentStartup(
  service: DeploymentService,
  env: NodeJS.ProcessEnv = process.env,
) {
  // Keep F04's strict shared-counter and trusted-proxy contract intact.
  validateRateLimitConfiguration(env);
  const result = validateDeploymentConfiguration(env, service);
  if (result.deployed) {
    try {
      parseStorageEnv(env);
    } catch (error) {
      // Never propagate schema input values or raw provider exceptions at boot.
      const details = error as { issues?: Array<{ path?: unknown[] }> };
      const fields = details.issues?.map((issue) => {
        const field = issue.path?.[0];
        return typeof field === "string" ? field : "STORAGE_PROVIDER";
      }) ?? ["STORAGE_PROVIDER"];
      throw new DeploymentConfigurationError(
        [...new Set(fields)].map((field) => `${field} failed storage configuration validation`),
      );
    }
  }
  return result;
}
