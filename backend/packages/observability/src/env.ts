import { z } from "zod";

const optionalNonEmpty = z.string().trim().min(1).optional();

export const observabilityEnvSchema = z.object({
  APP_ENV: optionalNonEmpty,
  RELEASE_ENV: optionalNonEmpty,
  RELEASE_SHA: optionalNonEmpty,
  RELEASE_VERSION: optionalNonEmpty,
  OBSERVABILITY_HASH_SALT: optionalNonEmpty,
  NEXT_PUBLIC_SENTRY_DSN: optionalNonEmpty,
  SENTRY_TRACES_SAMPLE_RATE: optionalNonEmpty,
  NEXT_PUBLIC_POSTHOG_KEY: optionalNonEmpty,
  NEXT_PUBLIC_POSTHOG_HOST: optionalNonEmpty,
  POSTHOG_SERVER_KEY: optionalNonEmpty,
  POSTHOG_SERVER_HOST: optionalNonEmpty,
  BETTER_STACK_WORKER_HEARTBEAT_URL: optionalNonEmpty,
  RELEASE_HEALTH_BASE_URL: optionalNonEmpty,
  RELEASE_HEALTH_EXPECTED_RELEASE: optionalNonEmpty,
  OBSERVABILITY_SMOKE_ENABLED: z.enum(["true", "false"]).optional(),
});

export type ObservabilityEnv = z.infer<typeof observabilityEnvSchema>;

export function parseObservabilityEnv(
  env: Record<string, string | undefined> = process.env,
): ObservabilityEnv {
  return observabilityEnvSchema.parse(env);
}

export function validateProductionObservabilityEnv(
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; errors: string[] } {
  const parsed = observabilityEnvSchema.safeParse(env);
  const errors: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { ok: false, errors };
  }

  const deploymentEnv =
    env["RELEASE_ENV"]?.trim() || env["APP_ENV"]?.trim() || env["NODE_ENV"]?.trim();

  if (deploymentEnv === "production" && !env["OBSERVABILITY_HASH_SALT"]?.trim()) {
    errors.push("OBSERVABILITY_HASH_SALT is required in production.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
