import { auditMetadataViolations } from "./lib/audit-metadata-policy";
import { MUTATIONS, routeBindings } from "./lib/route-metadata-bindings";

/**
 * Every mutation is on the audit record unless it has a stated reason not to
 * be (audit M7).
 *
 * This guard used to check only a list of sensitive permission prefixes, so
 * answer-key edits, assessment changes, notification templates, automation
 * rules, locales and a config path all shipped with `audit: "none"`. It now
 * covers every write:
 *
 * - a tenant mutation declares `audit: "required"`, or `audit: "none"` with an
 *   `auditExempt` reason (see AuditExemption in route-metadata.ts);
 * - a sensitive permission can never be exempt;
 * - a platform mutation declares "required" or "platform_scope";
 * - a mutating handler whose metadata cannot be resolved fails, unless it is
 *   listed in NON_METADATA_MUTATIONS (lib/audit-metadata-policy.ts).
 *
 * Bindings come from the TypeScript-AST resolver shared with the MFA guard.
 * The regex scan it replaced had five blind spots (first match only,
 * case-sensitive names, missing scan roots, verb-keyed objects judged by their
 * first verb, aliased re-exports collapsed together), each of which let real
 * routes go unchecked.
 */

const all = routeBindings();
const mutations = all.filter((binding) => MUTATIONS.has(binding.method));
const violations = auditMetadataViolations(all);

// Vacuity guard: a scan that resolves nothing proves nothing.
const resolved = all.filter((binding) => binding.metadata?.["permission"]).length;
if (mutations.length < 400 || resolved / all.length < 0.9) {
  console.error(
    `\nBlocked CI: ${String(mutations.length)} mutations found and ${String(resolved)} of ` +
      `${String(all.length)} route methods resolved; the route layout or metadata shape has ` +
      "changed and this guard is no longer checking.\n",
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nBlocked CI: every mutation must be audited or say why not (audit M7).\n");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    '\nDeclare audit: "required", or audit: "none" with an auditExempt reason ' +
      "(backend/packages/api/src/route-metadata.ts).\n",
  );
  process.exit(1);
}

console.log(
  `Audit metadata: ${String(mutations.length)} mutations checked; ` +
    `${String(resolved)}/${String(all.length)} route methods resolved.`,
);
