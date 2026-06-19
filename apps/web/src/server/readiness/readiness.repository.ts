import { randomUUID } from "node:crypto";
import type { CtaPolicyConfig, LegalCopyConfig, ReadinessPolicyDto } from "./readiness.types";
import { READINESS_POLICY_KEY } from "./readiness.types";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type PolicyRow = {
  id: string;
  key: string;
  scoring_profile_id: string;
  cta_policy_json: CtaPolicyConfig;
  legal_copy_json: LegalCopyConfig | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

type CompositeRow = {
  id: string;
  composite_key: string;
  scoring_profile_id: string;
  score: unknown;
  band_key: string;
  calculated_at: Date;
  config_version_id: string;
};

type DimensionScoreRow = {
  dimension_id: string;
  dimension_key: string;
  score: unknown;
  band_key: string | null;
};

type BandRow = {
  key: string;
  label: string;
  min_score: string;
  max_score: string;
  sort_order: number;
};

function mapPolicy(row: PolicyRow): ReadinessPolicyDto {
  return {
    id: row.id,
    key: row.key,
    scoringProfileId: row.scoring_profile_id,
    ctaPolicy: row.cta_policy_json,
    legalCopy: row.legal_copy_json,
    status: row.status as ReadinessPolicyDto["status"],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findReadinessPolicy(args: {
  tx: Tx;
  key?: string;
}): Promise<ReadinessPolicyDto | null> {
  const key = args.key ?? READINESS_POLICY_KEY;
  const rows = await args.tx.$queryRaw<PolicyRow[]>`
    select
      id::text,
      key,
      scoring_profile_id::text,
      cta_policy_json,
      legal_copy_json,
      status::text,
      created_at,
      updated_at
    from readiness_policies
    where key = ${key}
    limit 1
  `;

  const row = rows[0];
  return row ? mapPolicy(row) : null;
}

export async function upsertReadinessPolicy(args: {
  tx: Tx;
  tenantId: string;
  scoringProfileId: string;
  ctaPolicy: CtaPolicyConfig;
  legalCopy: LegalCopyConfig;
  status?: "ACTIVE" | "INACTIVE";
}): Promise<ReadinessPolicyDto> {
  const existing = await findReadinessPolicy({ tx: args.tx });
  const status = args.status ?? "ACTIVE";

  if (existing) {
    const rows = await args.tx.$queryRaw<PolicyRow[]>`
      update readiness_policies
      set
        scoring_profile_id = ${args.scoringProfileId}::uuid,
        cta_policy_json = ${JSON.stringify(args.ctaPolicy)}::jsonb,
        legal_copy_json = ${JSON.stringify(args.legalCopy)}::jsonb,
        status = ${status}::"EntityStatus",
        updated_at = now()
      where id = ${existing.id}::uuid
      returning
        id::text,
        key,
        scoring_profile_id::text,
        cta_policy_json,
        legal_copy_json,
        status::text,
        created_at,
        updated_at
    `;

    const row = rows[0];
    if (!row) throw new Error("Failed to update readiness policy.");
    return mapPolicy(row);
  }

  const id = randomUUID();
  const rows = await args.tx.$queryRaw<PolicyRow[]>`
    insert into readiness_policies (
      id,
      tenant_id,
      key,
      scoring_profile_id,
      cta_policy_json,
      legal_copy_json,
      status,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${READINESS_POLICY_KEY},
      ${args.scoringProfileId}::uuid,
      ${JSON.stringify(args.ctaPolicy)}::jsonb,
      ${JSON.stringify(args.legalCopy)}::jsonb,
      ${status}::"EntityStatus",
      now(),
      now()
    )
    returning
      id::text,
      key,
      scoring_profile_id::text,
      cta_policy_json,
      legal_copy_json,
      status::text,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create readiness policy.");
  return mapPolicy(row);
}

export async function scoringProfileExists(args: { tx: Tx; profileId: string }): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from scoring_profiles
    where id = ${args.profileId}::uuid
    limit 1
  `;
  return rows.length > 0;
}

export async function listMembershipDimensionScores(args: {
  tx: Tx;
  membershipId: string;
  scoringProfileId: string;
}): Promise<
  Array<{ dimensionId: string; dimensionKey: string; score: number; bandKey: string | null }>
> {
  const rows = await args.tx.$queryRaw<DimensionScoreRow[]>`
    select
      cs.dimension_id::text,
      cd.key as dimension_key,
      cs.score,
      cs.band_key
    from competency_scores cs
    inner join competency_dimensions cd on cd.id = cs.dimension_id
    where cs.membership_id = ${args.membershipId}::uuid
      and cs.scoring_profile_id = ${args.scoringProfileId}::uuid
    order by cd.key asc
  `;

  return rows.map((row) => ({
    dimensionId: row.dimension_id,
    dimensionKey: row.dimension_key,
    score: Number(row.score),
    bandKey: row.band_key,
  }));
}

export async function listBandsForProfile(args: {
  tx: Tx;
  profileId: string;
}): Promise<
  Array<{ key: string; label: string; minScore: number; maxScore: number; sortOrder: number }>
> {
  const rows = await args.tx.$queryRaw<BandRow[]>`
    select key, label, min_score::text, max_score::text, sort_order
    from competency_bands
    where scoring_profile_id = ${args.profileId}::uuid
    order by sort_order asc, key asc
  `;

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    minScore: Number(row.min_score),
    maxScore: Number(row.max_score),
    sortOrder: row.sort_order,
  }));
}

export async function findCompositeReadinessState(args: {
  tx: Tx;
  membershipId: string;
  scoringProfileId: string;
  compositeKey: string;
}): Promise<{
  id: string;
  score: number;
  bandKey: string;
  calculatedAt: string;
  configVersionId: string;
} | null> {
  const rows = await args.tx.$queryRaw<CompositeRow[]>`
    select
      id::text,
      composite_key,
      scoring_profile_id::text,
      score,
      band_key,
      calculated_at,
      config_version_id::text
    from composite_readiness_state
    where membership_id = ${args.membershipId}::uuid
      and scoring_profile_id = ${args.scoringProfileId}::uuid
      and composite_key = ${args.compositeKey}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    score: Number(row.score),
    bandKey: row.band_key,
    calculatedAt: row.calculated_at.toISOString(),
    configVersionId: row.config_version_id,
  };
}

export async function upsertCompositeReadinessState(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  scoringProfileId: string;
  compositeKey: string;
  score: number;
  bandKey: string;
  configVersionId: string;
}): Promise<{ id: string; previousBandKey: string | null }> {
  const existing = await findCompositeReadinessState({
    tx: args.tx,
    membershipId: args.membershipId,
    scoringProfileId: args.scoringProfileId,
    compositeKey: args.compositeKey,
  });

  if (existing) {
    await args.tx.$executeRaw`
      update composite_readiness_state
      set
        score = ${args.score},
        band_key = ${args.bandKey},
        config_version_id = ${args.configVersionId}::uuid,
        calculated_at = now()
      where id = ${existing.id}::uuid
    `;

    return { id: existing.id, previousBandKey: existing.bandKey };
  }

  const id = randomUUID();
  await args.tx.$executeRaw`
    insert into composite_readiness_state (
      id,
      tenant_id,
      membership_id,
      scoring_profile_id,
      composite_key,
      score,
      band_key,
      hard_gates_json,
      calculated_at,
      config_version_id
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.scoringProfileId}::uuid,
      ${args.compositeKey},
      ${args.score},
      ${args.bandKey},
      null,
      now(),
      ${args.configVersionId}::uuid
    )
  `;

  return { id, previousBandKey: null };
}

export async function getActiveConfigVersionId(args: {
  tx: Tx;
  profileId: string;
}): Promise<string | null> {
  const rows = await args.tx.$queryRaw<Array<{ active_config_version_id: string | null }>>`
    select active_config_version_id::text
    from scoring_profiles
    where id = ${args.profileId}::uuid
    limit 1
  `;

  return rows[0]?.active_config_version_id ?? null;
}

export async function insertAttributionToken(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  tokenHash: string;
  destinationUrl: string;
  sourceSurface: string;
  readinessBandKey: string | null;
  metadataJson: Record<string, unknown>;
  expiresAt: Date;
}): Promise<{ id: string }> {
  const id = randomUUID();
  await args.tx.$executeRaw`
    insert into attribution_tokens (
      id,
      tenant_id,
      membership_id,
      anonymous_id,
      token_hash,
      destination_url,
      source_surface,
      readiness_band_key,
      metadata_json,
      created_at,
      expires_at,
      consumed_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      null,
      ${args.tokenHash},
      ${args.destinationUrl},
      ${args.sourceSurface},
      ${args.readinessBandKey},
      ${JSON.stringify(args.metadataJson)}::jsonb,
      now(),
      ${args.expiresAt},
      null
    )
  `;

  return { id };
}
