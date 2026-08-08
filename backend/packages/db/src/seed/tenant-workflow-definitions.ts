export type TenantWorkflowDefinition = {
  key: string;
  name: string;
  definitionJson: Record<string, unknown>;
};

export const DEFAULT_TENANT_WORKFLOW_DEFINITIONS: readonly TenantWorkflowDefinition[] = [
  {
    key: "course.publish",
    name: "Course publish review",
    definitionJson: {
      targetType: "course",
      fromState: "DRAFT",
      reviewState: "REVIEW",
      approvedState: "PUBLISHED",
      rejectedState: "DRAFT",
      actions: ["approve", "reject", "return"],
    },
  },
  {
    key: "assessment.publish",
    name: "Assessment publish review",
    definitionJson: {
      targetType: "assessment",
      fromState: "DRAFT",
      reviewState: "REVIEW",
      approvedState: "PUBLISHED",
      rejectedState: "DRAFT",
      actions: ["approve", "reject", "return"],
    },
  },
  {
    key: "learning_path.publish",
    name: "Learning path publish review",
    definitionJson: {
      targetType: "learning_path",
      fromState: "DRAFT",
      reviewState: "REVIEW",
      approvedState: "PUBLISHED",
      rejectedState: "DRAFT",
      actions: ["approve", "reject", "return"],
    },
  },
  {
    key: "certificate_template.publish",
    name: "Certificate template publish review",
    definitionJson: {
      targetType: "certificate_template",
      fromState: "DRAFT",
      reviewState: "REVIEW",
      approvedState: "PUBLISHED",
      rejectedState: "DRAFT",
      requiresReview: false,
      actions: ["approve", "reject", "return"],
    },
  },
  {
    key: "certificate.issue",
    name: "Certificate issuance review",
    definitionJson: {
      targetType: "certificate",
      fromState: "DRAFT",
      reviewState: "REVIEW",
      approvedState: "PUBLISHED",
      rejectedState: "DRAFT",
      requiresReview: false,
      actions: ["approve", "reject", "return"],
    },
  },
] as const;

type Db = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export async function seedTenantDefaultWorkflowDefinitions(args: {
  tx: Db;
  tenantId: string;
}): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const definition of DEFAULT_TENANT_WORKFLOW_DEFINITIONS) {
    const existing = await args.tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from workflow_definitions
      where tenant_id = ${args.tenantId}::uuid
        and key = ${definition.key}
      limit 1
    `;

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await args.tx.$executeRaw`
      insert into workflow_definitions (
        id,
        tenant_id,
        key,
        name,
        definition_json,
        status,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        ${args.tenantId}::uuid,
        ${definition.key},
        ${definition.name},
        ${JSON.stringify(definition.definitionJson)}::jsonb,
        'ACTIVE',
        now(),
        now()
      )
    `;

    inserted += 1;
  }

  return { inserted, skipped };
}
