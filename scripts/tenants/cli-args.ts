import type { ApplyEnvironment } from "@atlas/tenant-config";

export type TenantCliArgs = {
  tenant: string;
  environment?: ApplyEnvironment;
  configsRoot?: string;
  ownerEmail?: string;
  ownerDisplayName?: string;
  platformPrincipalId?: string;
  productionPlanOnly?: boolean;
};

export function parseTenantCliArgs(argv: readonly string[]): TenantCliArgs {
  const args: TenantCliArgs = { tenant: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--tenant") {
      args.tenant = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (token === "--environment") {
      const value = argv[index + 1];
      if (
        value === "development" ||
        value === "test" ||
        value === "staging" ||
        value === "production"
      ) {
        args.environment = value;
      }
      index += 1;
      continue;
    }

    if (token === "--configs-root") {
      args.configsRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--owner-email") {
      args.ownerEmail = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--owner-display-name") {
      args.ownerDisplayName = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--platform-principal-id") {
      args.platformPrincipalId = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--production-plan-only") {
      args.productionPlanOnly = true;
    }
  }

  if (!args.tenant) {
    throw new Error("Missing required --tenant <slug> argument.");
  }

  return args;
}

export function resolveEnvironment(args: TenantCliArgs): ApplyEnvironment {
  return args.environment ?? "development";
}
