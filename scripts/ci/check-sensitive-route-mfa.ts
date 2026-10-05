import {
  STEP_UP_MFA_OPERATIONS,
  STEP_UP_MFA_PERMISSIONS,
  STEP_UP_MFA_ROUTE_RULES,
  matchesStepUpRouteRule,
} from "../../backend/packages/authorization/src/step-up-mfa-policy";
import {
  MUTATIONS,
  isPlatformRoute,
  isPublicRoute,
  routeBindings,
  type RouteBinding,
} from "./lib/route-metadata-bindings";

/**
 * Step-up MFA must be declared wherever the policy says it is due (audit H4).
 *
 * For every tenant API route and HTTP method, find the metadata object the
 * handler is built with, following imports, and read its `permission` and
 * `mfa`. Then:
 *
 * - a mutation declaring a permission in STEP_UP_MFA_PERMISSIONS must require MFA;
 * - every route/method in STEP_UP_MFA_OPERATIONS must exist and require MFA;
 * - every route/method matching STEP_UP_MFA_ROUTE_RULES (report exports) must
 *   require MFA, and every rule must match at least one route, so a renamed
 *   path cannot quietly leave a rule checking nothing.
 *
 * Bindings come from the TypeScript-AST resolver shared with the audit guard
 * (scripts/ci/lib/route-metadata-bindings.ts).
 */

type Metadata = { permission: string | null; mfa: string | null };
type Binding = RouteBinding & { metadata: Metadata | null };

// Not tenant step-up territory: anonymous routes, and the platform plane,
// where assertPlatformMfa already requires MFA for every operation.
function bindings(): Binding[] {
  return routeBindings()
    .filter((binding) => !isPublicRoute(binding.route) && !isPlatformRoute(binding.route))
    .map((binding) => ({
      ...binding,
      metadata: binding.metadata
        ? {
            permission: binding.metadata["permission"] ?? null,
            mfa: binding.metadata["mfa"] ?? null,
          }
        : null,
    }));
}

const all = bindings();
const resolved = all.filter((binding) => binding.metadata?.permission);
const violations: string[] = [];
const where = (binding: Binding) => `${binding.method} ${binding.route}`;

for (const binding of resolved) {
  const permission = binding.metadata?.permission ?? "";
  if (!MUTATIONS.has(binding.method) || !(permission in STEP_UP_MFA_PERMISSIONS)) continue;
  if (binding.metadata?.mfa !== "required")
    violations.push(
      `${where(binding)}: ${permission} is a step-up permission; declare mfa: "required"`,
    );
}

for (const operation of STEP_UP_MFA_OPERATIONS) {
  const binding = all.find((b) => b.route === operation.route && b.method === operation.method);
  if (!binding) {
    violations.push(
      `${operation.method} ${operation.route}: listed in STEP_UP_MFA_OPERATIONS but no such route`,
    );
  } else if (!binding.metadata) {
    violations.push(
      `${where(binding)}: listed for step-up MFA but its metadata could not be resolved`,
    );
  } else if (binding.metadata.mfa !== "required") {
    violations.push(`${where(binding)}: ${operation.reason} Declare mfa: "required"`);
  }
}

for (const rule of STEP_UP_MFA_ROUTE_RULES) {
  const covered = all.filter(
    (binding) =>
      (rule.methods as readonly string[]).includes(binding.method) &&
      rule.pattern.test(binding.route),
  );
  if (covered.length === 0) {
    violations.push(`${rule.pattern.source}: route rule matches no route; update or remove it`);
  }
}

for (const binding of all) {
  const rule = matchesStepUpRouteRule(binding.route, binding.method);
  if (!rule) continue;
  if (!binding.metadata) {
    violations.push(
      `${where(binding)}: matches a report export rule but its metadata could not be resolved`,
    );
  } else if (binding.metadata.mfa !== "required") {
    violations.push(`${where(binding)}: ${rule.reason} Declare mfa: "required"`);
  }
}

// Vacuity guard: a scan that resolves nothing proves nothing.
if (all.length < 600 || resolved.length / all.length < 0.9) {
  console.error(
    `\nBlocked CI: resolved metadata for ${String(resolved.length)} of ${String(all.length)} ` +
      "tenant route methods; the route layout or metadata shape has changed and this guard is no longer checking.\n",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nBlocked CI: sensitive operations must require step-up MFA (audit H4).\n");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    "\nPolicy: backend/packages/authorization/src/step-up-mfa-policy.ts. Routes declare it in metadata.\n",
  );
  process.exit(1);
}

console.log(
  `Step-up MFA: ${String(resolved.length)}/${String(all.length)} tenant route methods resolved; policy satisfied.`,
);
