/** Recognize only the reviewed whole expression emitted by pg_get_expr. */
export function isCanonicalTenantSettingPolicy(expression: string | null): boolean {
  // Exact equality is deliberate. A substring/token search would also accept
  // an unrelated OR branch that makes this tenant condition ineffective.
  // Unknown equivalent spellings fail conservatively and require review.
  return (
    expression ===
    "(tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::uuid)"
  );
}
