import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type {
  ActiveScoringProfile,
  CompetencyScoreDto,
  CompetencySignalDto,
  CompetencySnapshotDto,
  CompositeReadinessDto,
} from "./competency-projection.types";

type Tx = TenantTx;

export function buildSignalIdempotencyKey(args: {
  sourceEventId: string;
  membershipId: string;
  dimensionId: string;
  itemId: string;
  signalSourceKey: string;
}): string {
  return `${args.sourceEventId}:${args.membershipId}:${args.dimensionId}:${args.signalSourceKey}:${args.itemId}`;
}

export async function insertCompetencySignal(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  dimensionId: string;
  signalSourceKey: string;
  sourceEventId: string;
  rawScore: number;
  weight: number;
  idempotencyKey: string;
  metadataJson?: Record<string, unknown>;
}): Promise<{ id: string; inserted: boolean }> {
  const existing = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from competency_signals
    where tenant_id = ${args.tenantId}::uuid
      and idempotency_key = ${args.idempotencyKey}
    limit 1
  `;

  if (existing[0]) {
    return { id: existing[0].id, inserted: false };
  }

  const id = randomUUID();
  await args.tx.$executeRaw`
    insert into competency_signals (
      id,
      tenant_id,
      membership_id,
      dimension_id,
      signal_source_key,
      source_event_id,
      raw_score,
      weight,
      metadata_json,
      occurred_at,
      idempotency_key
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.dimensionId}::uuid,
      ${args.signalSourceKey},
      ${args.sourceEventId}::uuid,
      ${args.rawScore},
      ${args.weight},
      ${args.metadataJson != null ? JSON.stringify(args.metadataJson) : null}::jsonb,
      now(),
      ${args.idempotencyKey}
    )
  `;

  return { id, inserted: true };
}

export async function listSignalsForProjection(args: {
  tx: Tx;
  membershipId: string;
  dimensionId: string;
}): Promise<Array<{ rawScore: number; weight: number }>> {
  const rows = await args.tx.$queryRaw<Array<{ raw_score: unknown; weight: unknown }>>`
    select raw_score, weight
    from competency_signals
    where membership_id = ${args.membershipId}::uuid
      and dimension_id = ${args.dimensionId}::uuid
    order by occurred_at asc
  `;

  return rows.map((row) => ({
    rawScore: Number(row.raw_score),
    weight: Number(row.weight),
  }));
}

export async function listActiveScoringProfiles(args: { tx: Tx }): Promise<ActiveScoringProfile[]> {
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; key: string; active_config_version_id: string }>
  >`
    select
      id::text,
      key,
      active_config_version_id::text
    from scoring_profiles
    where status = 'ACTIVE'::"EntityStatus"
      and active_config_version_id is not null
    order by key asc
  `;

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    activeConfigVersionId: row.active_config_version_id,
  }));
}

export async function listBandsForProfile(args: {
  tx: Tx;
  profileId: string;
}): Promise<
  Array<{ key: string; label: string; minScore: number; maxScore: number; sortOrder: number }>
> {
  const rows = await args.tx.$queryRaw<
    Array<{
      key: string;
      label: string;
      min_score: unknown;
      max_score: unknown;
      sort_order: number;
    }>
  >`
    select key, label, min_score, max_score, sort_order
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

export async function findExistingScore(args: {
  tx: Tx;
  membershipId: string;
  dimensionId: string;
  scoringProfileId: string;
}): Promise<{ score: number; bandKey: string | null } | null> {
  const rows = await args.tx.$queryRaw<Array<{ score: unknown; band_key: string | null }>>`
    select score, band_key
    from competency_scores
    where membership_id = ${args.membershipId}::uuid
      and dimension_id = ${args.dimensionId}::uuid
      and scoring_profile_id = ${args.scoringProfileId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  return { score: Number(row.score), bandKey: row.band_key };
}

export async function upsertCompetencyScore(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  dimensionId: string;
  scoringProfileId: string;
  score: number;
  bandKey: string | null;
  configVersionId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into competency_scores (
      id,
      tenant_id,
      membership_id,
      dimension_id,
      scoring_profile_id,
      score,
      band_key,
      calculated_at,
      config_version_id
    )
    values (
      ${randomUUID()}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.dimensionId}::uuid,
      ${args.scoringProfileId}::uuid,
      ${args.score},
      ${args.bandKey},
      now(),
      ${args.configVersionId}::uuid
    )
    on conflict (tenant_id, membership_id, dimension_id, scoring_profile_id)
    do update set
      score = excluded.score,
      band_key = excluded.band_key,
      calculated_at = excluded.calculated_at,
      config_version_id = excluded.config_version_id
  `;
}

export async function insertScoreSnapshot(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
  scoringProfileId: string;
  snapshotJson: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  await args.tx.$executeRaw`
    insert into competency_score_snapshots (
      id,
      tenant_id,
      membership_id,
      scoring_profile_id,
      snapshot_json,
      occurred_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.membershipId}::uuid,
      ${args.scoringProfileId}::uuid,
      ${JSON.stringify(args.snapshotJson)}::jsonb,
      now()
    )
  `;
  return id;
}

export async function listDimensionsForProfile(args: {
  tx: Tx;
}): Promise<Array<{ id: string; key: string; name: string }>> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; key: string; name: string }>>`
    select id::text, key, name
    from competency_dimensions
    order by key asc
  `;
  return rows;
}

export async function loadAttemptAnswerRows(args: { tx: Tx; attemptId: string }): Promise<
  Array<{
    itemId: string;
    pointsAwarded: number | null;
    isCorrect: boolean | null;
    maxPoints: number;
  }>
> {
  const rows = await args.tx.$queryRaw<
    Array<{
      item_id: string;
      points_awarded: unknown;
      is_correct: boolean | null;
      max_points: unknown;
    }>
  >`
    select
      ai.item_id::text,
      aa.points_awarded,
      aa.is_correct,
      ai.points as max_points
    from attempt_answers aa
    inner join assessment_items ai
      on ai.id = aa.assessment_item_id
    where aa.attempt_id = ${args.attemptId}::uuid
  `;

  return rows.map((row) => ({
    itemId: row.item_id,
    pointsAwarded: row.points_awarded != null ? Number(row.points_awarded) : null,
    isCorrect: row.is_correct,
    maxPoints: Number(row.max_points),
  }));
}

export async function loadPracticeResponseRows(args: {
  tx: Tx;
  practiceSessionId: string;
}): Promise<
  Array<{
    itemId: string;
    isCorrect: boolean | null;
  }>
> {
  const rows = await args.tx.$queryRaw<Array<{ item_id: string; is_correct: boolean | null }>>`
    select item_id::text, is_correct
    from practice_responses
    where practice_session_id = ${args.practiceSessionId}::uuid
  `;

  return rows.map((row) => ({
    itemId: row.item_id,
    isCorrect: row.is_correct,
  }));
}

export async function loadItemDimensionWeights(args: {
  tx: Tx;
  itemId: string;
}): Promise<Array<{ dimensionId: string; weight: number }>> {
  const rows = await args.tx.$queryRaw<Array<{ dimension_id: string; weight: unknown }>>`
    select dimension_id::text, weight
    from item_dimension_weights
    where item_id = ${args.itemId}::uuid
  `;

  return rows.map((row) => ({
    dimensionId: row.dimension_id,
    weight: Number(row.weight),
  }));
}

export async function listMembershipScores(args: {
  tx: Tx;
  membershipId: string;
}): Promise<CompetencyScoreDto[]> {
  const rows = await args.tx.$queryRaw<
    Array<{
      dimension_id: string;
      dimension_key: string;
      dimension_name: string;
      scoring_profile_id: string;
      scoring_profile_key: string;
      score: unknown;
      band_key: string | null;
      band_label: string | null;
      calculated_at: Date;
      config_version_id: string;
    }>
  >`
    select
      cs.dimension_id::text,
      cd.key as dimension_key,
      cd.name as dimension_name,
      cs.scoring_profile_id::text,
      sp.key as scoring_profile_key,
      cs.score,
      cs.band_key,
      cb.label as band_label,
      cs.calculated_at,
      cs.config_version_id::text
    from competency_scores cs
    inner join competency_dimensions cd on cd.id = cs.dimension_id
    inner join scoring_profiles sp on sp.id = cs.scoring_profile_id
    left join competency_bands cb
      on cb.scoring_profile_id = cs.scoring_profile_id
      and cb.key = cs.band_key
    where cs.membership_id = ${args.membershipId}::uuid
    order by sp.key asc, cd.key asc
  `;

  return rows.map((row) => ({
    dimensionId: row.dimension_id,
    dimensionKey: row.dimension_key,
    dimensionName: row.dimension_name,
    scoringProfileId: row.scoring_profile_id,
    scoringProfileKey: row.scoring_profile_key,
    score: Number(row.score),
    bandKey: row.band_key,
    bandLabel: row.band_label,
    calculatedAt: row.calculated_at.toISOString(),
    configVersionId: row.config_version_id,
  }));
}

export async function listCompositeReadiness(args: {
  tx: Tx;
  membershipId: string;
}): Promise<CompositeReadinessDto[]> {
  const rows = await args.tx.$queryRaw<
    Array<{
      composite_key: string;
      score: unknown;
      band_key: string;
      calculated_at: Date;
      scoring_profile_id: string;
    }>
  >`
    select composite_key, score, band_key, calculated_at, scoring_profile_id::text
    from composite_readiness_state
    where membership_id = ${args.membershipId}::uuid
    order by composite_key asc
  `;

  return rows.map((row) => ({
    compositeKey: row.composite_key,
    score: Number(row.score),
    bandKey: row.band_key,
    calculatedAt: row.calculated_at.toISOString(),
    scoringProfileId: row.scoring_profile_id,
  }));
}

export async function listScoreSnapshots(args: {
  tx: Tx;
  membershipId: string;
  scoringProfileId?: string;
  cursor?: string;
  limit: number;
}): Promise<{ items: CompetencySnapshotDto[]; hasNextPage: boolean }> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      scoring_profile_id: string;
      scoring_profile_key: string;
      occurred_at: Date;
      snapshot_json: { scores?: CompetencySnapshotDto["scores"] } | null;
    }>
  >`
    select
      css.id::text,
      css.scoring_profile_id::text,
      sp.key as scoring_profile_key,
      css.occurred_at,
      css.snapshot_json
    from competency_score_snapshots css
    inner join scoring_profiles sp on sp.id = css.scoring_profile_id
    where css.membership_id = ${args.membershipId}::uuid
      and (${args.scoringProfileId ?? null}::uuid is null or css.scoring_profile_id = ${args.scoringProfileId ?? null}::uuid)
      and (${args.cursor ?? null}::uuid is null or css.id < ${args.cursor ?? null}::uuid)
    order by css.occurred_at desc, css.id desc
    limit ${args.limit + 1}
  `;

  const hasNextPage = rows.length > args.limit;
  const pageRows = hasNextPage ? rows.slice(0, args.limit) : rows;

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      scoringProfileId: row.scoring_profile_id,
      scoringProfileKey: row.scoring_profile_key,
      occurredAt: row.occurred_at.toISOString(),
      scores: row.snapshot_json?.scores ?? [],
    })),
    hasNextPage,
  };
}

export async function listCompetencySignals(args: {
  tx: Tx;
  membershipId?: string;
  dimensionId?: string;
  signalSourceKey?: string;
  cursor?: string;
  limit: number;
}): Promise<{ items: CompetencySignalDto[]; hasNextPage: boolean }> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      membership_id: string;
      dimension_id: string;
      dimension_key: string;
      signal_source_key: string;
      source_event_id: string | null;
      raw_score: unknown;
      weight: unknown;
      occurred_at: Date;
    }>
  >`
    select
      cs.id::text,
      cs.membership_id::text,
      cs.dimension_id::text,
      cd.key as dimension_key,
      cs.signal_source_key,
      cs.source_event_id::text,
      cs.raw_score,
      cs.weight,
      cs.occurred_at
    from competency_signals cs
    inner join competency_dimensions cd on cd.id = cs.dimension_id
    where (${args.membershipId ?? null}::uuid is null or cs.membership_id = ${args.membershipId ?? null}::uuid)
      and (${args.dimensionId ?? null}::uuid is null or cs.dimension_id = ${args.dimensionId ?? null}::uuid)
      and (${args.signalSourceKey ?? null}::text is null or cs.signal_source_key = ${args.signalSourceKey ?? null})
      and (${args.cursor ?? null}::uuid is null or cs.id < ${args.cursor ?? null}::uuid)
    order by cs.occurred_at desc, cs.id desc
    limit ${args.limit + 1}
  `;

  const hasNextPage = rows.length > args.limit;
  const pageRows = hasNextPage ? rows.slice(0, args.limit) : rows;

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      membershipId: row.membership_id,
      dimensionId: row.dimension_id,
      dimensionKey: row.dimension_key,
      signalSourceKey: row.signal_source_key,
      sourceEventId: row.source_event_id,
      rawScore: Number(row.raw_score),
      weight: Number(row.weight),
      occurredAt: row.occurred_at.toISOString(),
    })),
    hasNextPage,
  };
}

export async function membershipExists(args: {
  tx: Tx;
  tenantId: string;
  membershipId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from memberships
    where id = ${args.membershipId}::uuid
      and tenant_id = ${args.tenantId}::uuid
    limit 1
  `;
  return rows.length > 0;
}

export async function isInstructorOfMember(args: {
  tx: Tx;
  instructorMembershipId: string;
  learnerMembershipId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ ok: boolean }>>`
    select exists (
      select 1
      from enrollments e
      inner join courses c on c.id = e.course_id
      where e.membership_id = ${args.learnerMembershipId}::uuid
        and c.created_by_membership_id = ${args.instructorMembershipId}::uuid
    ) as ok
  `;
  return rows[0]?.ok === true;
}

export async function isInstructorOfPathMember(args: {
  tx: Tx;
  instructorMembershipId: string;
  learnerMembershipId: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ ok: boolean }>>`
    select exists (
      select 1
      from path_enrollments pe
      inner join learning_paths lp on lp.id = pe.path_id
      where pe.membership_id = ${args.learnerMembershipId}::uuid
        and lp.created_by_membership_id = ${args.instructorMembershipId}::uuid
    ) as ok
  `;
  return rows[0]?.ok === true;
}
