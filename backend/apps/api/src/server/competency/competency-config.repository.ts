import { randomUUID } from "node:crypto";
import type {
  CompetencyBandDto,
  CompetencyDimensionDto,
  ScoringConfigSnapshot,
  ScoringProfileDto,
} from "./competency-config.types";
import type { BandInput } from "./competency-config.schemas";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type DimensionRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

type ProfileRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  active_config_version_id: string | null;
  active_version: number | null;
  created_at: Date;
  updated_at: Date;
};

type BandRow = {
  id: string;
  key: string;
  label: string;
  min_score: string;
  max_score: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

type SignalSourceRow = {
  id: string;
  key: string;
  source_context: string;
  config_json: Record<string, unknown> | null;
};

function mapDimension(row: DimensionRow): CompetencyDimensionDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapProfile(row: ProfileRow): ScoringProfileDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    status: row.status as ScoringProfileDto["status"],
    activeConfigVersionId: row.active_config_version_id,
    activeVersion: row.active_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapBand(row: BandRow): CompetencyBandDto {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    minScore: Number(row.min_score),
    maxScore: Number(row.max_score),
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listDimensions(args: { tx: Tx }): Promise<CompetencyDimensionDto[]> {
  const rows = await args.tx.$queryRaw<DimensionRow[]>`
    select
      id::text,
      key,
      name,
      description,
      created_at,
      updated_at
    from competency_dimensions
    order by key asc
  `;

  return rows.map(mapDimension);
}

export async function findDimensionById(args: {
  tx: Tx;
  dimensionId: string;
}): Promise<CompetencyDimensionDto | null> {
  const rows = await args.tx.$queryRaw<DimensionRow[]>`
    select
      id::text,
      key,
      name,
      description,
      created_at,
      updated_at
    from competency_dimensions
    where id = ${args.dimensionId}::uuid
    limit 1
  `;

  const row = rows[0];
  return row ? mapDimension(row) : null;
}

export async function findDimensionByKey(args: {
  tx: Tx;
  key: string;
}): Promise<CompetencyDimensionDto | null> {
  const rows = await args.tx.$queryRaw<DimensionRow[]>`
    select
      id::text,
      key,
      name,
      description,
      created_at,
      updated_at
    from competency_dimensions
    where key = ${args.key}
    limit 1
  `;

  const row = rows[0];
  return row ? mapDimension(row) : null;
}

export async function insertDimension(args: {
  tx: Tx;
  tenantId: string;
  key: string;
  name: string;
  description: string | null;
}): Promise<CompetencyDimensionDto> {
  const id = randomUUID();
  const rows = await args.tx.$queryRaw<DimensionRow[]>`
    insert into competency_dimensions (
      id,
      tenant_id,
      key,
      name,
      description,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.key},
      ${args.name},
      ${args.description},
      now(),
      now()
    )
    returning
      id::text,
      key,
      name,
      description,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create competency dimension.");
  return mapDimension(row);
}

export async function updateDimensionRecord(args: {
  tx: Tx;
  dimensionId: string;
  name?: string;
  description?: string | null;
}): Promise<CompetencyDimensionDto | null> {
  const existing = await findDimensionById({ tx: args.tx, dimensionId: args.dimensionId });
  if (!existing) return null;

  const rows = await args.tx.$queryRaw<DimensionRow[]>`
    update competency_dimensions
    set
      name = ${args.name ?? existing.name},
      description = ${args.description !== undefined ? args.description : existing.description},
      updated_at = now()
    where id = ${args.dimensionId}::uuid
    returning
      id::text,
      key,
      name,
      description,
      created_at,
      updated_at
  `;

  const row = rows[0];
  return row ? mapDimension(row) : null;
}

export async function deleteDimensionRecord(args: {
  tx: Tx;
  dimensionId: string;
}): Promise<boolean> {
  // Only reached for a dimension with no signals or scores (see
  // countDimensionReferences), so its item weights have never counted.
  await args.tx.$executeRaw`
    delete from item_dimension_weights
    where dimension_id = ${args.dimensionId}::uuid
  `;
  const count = await args.tx.$executeRaw`
    delete from competency_dimensions
    where id = ${args.dimensionId}::uuid
  `;

  return Number(count) > 0;
}

export async function countDimensionReferences(args: {
  tx: Tx;
  dimensionId: string;
}): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select
      (
        select count(*)::bigint
        from competency_signals
        where dimension_id = ${args.dimensionId}::uuid
      )
      +
      (
        select count(*)::bigint
        from competency_scores
        where dimension_id = ${args.dimensionId}::uuid
      ) as count
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function listScoringProfiles(args: { tx: Tx }): Promise<ScoringProfileDto[]> {
  const rows = await args.tx.$queryRaw<ProfileRow[]>`
    select
      sp.id::text,
      sp.key,
      sp.name,
      sp.status::text,
      sp.active_config_version_id::text,
      scv.version as active_version,
      sp.created_at,
      sp.updated_at
    from scoring_profiles sp
    left join scoring_config_versions scv
      on scv.id = sp.active_config_version_id
    order by sp.key asc
  `;

  return rows.map(mapProfile);
}

export async function findScoringProfileById(args: {
  tx: Tx;
  profileId: string;
}): Promise<ScoringProfileDto | null> {
  const rows = await args.tx.$queryRaw<ProfileRow[]>`
    select
      sp.id::text,
      sp.key,
      sp.name,
      sp.status::text,
      sp.active_config_version_id::text,
      scv.version as active_version,
      sp.created_at,
      sp.updated_at
    from scoring_profiles sp
    left join scoring_config_versions scv
      on scv.id = sp.active_config_version_id
    where sp.id = ${args.profileId}::uuid
    limit 1
  `;

  const row = rows[0];
  return row ? mapProfile(row) : null;
}

export async function findScoringProfileByKey(args: {
  tx: Tx;
  key: string;
}): Promise<ScoringProfileDto | null> {
  const rows = await args.tx.$queryRaw<ProfileRow[]>`
    select
      sp.id::text,
      sp.key,
      sp.name,
      sp.status::text,
      sp.active_config_version_id::text,
      scv.version as active_version,
      sp.created_at,
      sp.updated_at
    from scoring_profiles sp
    left join scoring_config_versions scv
      on scv.id = sp.active_config_version_id
    where sp.key = ${args.key}
    limit 1
  `;

  const row = rows[0];
  return row ? mapProfile(row) : null;
}

export async function insertScoringProfile(args: {
  tx: Tx;
  tenantId: string;
  key: string;
  name: string;
  status: string;
}): Promise<ScoringProfileDto> {
  const id = randomUUID();
  const rows = await args.tx.$queryRaw<ProfileRow[]>`
    insert into scoring_profiles (
      id,
      tenant_id,
      key,
      name,
      status,
      created_at,
      updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.key},
      ${args.name},
      ${args.status}::"EntityStatus",
      now(),
      now()
    )
    returning
      id::text,
      key,
      name,
      status::text,
      null::text as active_config_version_id,
      null::int as active_version,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create scoring profile.");
  return mapProfile(row);
}

export async function updateScoringProfileRecord(args: {
  tx: Tx;
  profileId: string;
  name?: string;
  status?: string;
}): Promise<ScoringProfileDto | null> {
  const existing = await findScoringProfileById({ tx: args.tx, profileId: args.profileId });
  if (!existing) return null;

  const rows = await args.tx.$queryRaw<ProfileRow[]>`
    update scoring_profiles
    set
      name = ${args.name ?? existing.name},
      status = ${args.status ?? existing.status}::"EntityStatus",
      updated_at = now()
    where id = ${args.profileId}::uuid
    returning
      id::text,
      key,
      name,
      status::text,
      active_config_version_id::text,
      null::int as active_version,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) return null;

  return findScoringProfileById({ tx: args.tx, profileId: args.profileId });
}

export async function listBandsForProfile(args: {
  tx: Tx;
  profileId: string;
}): Promise<CompetencyBandDto[]> {
  const rows = await args.tx.$queryRaw<BandRow[]>`
    select
      id::text,
      key,
      label,
      min_score::text,
      max_score::text,
      sort_order,
      created_at,
      updated_at
    from competency_bands
    where scoring_profile_id = ${args.profileId}::uuid
    order by sort_order asc, key asc
  `;

  return rows.map(mapBand);
}

export async function replaceBandsForProfile(args: {
  tx: Tx;
  tenantId: string;
  profileId: string;
  bands: BandInput[];
}): Promise<CompetencyBandDto[]> {
  await args.tx.$executeRaw`
    delete from competency_bands
    where scoring_profile_id = ${args.profileId}::uuid
  `;

  for (const band of args.bands) {
    await args.tx.$executeRaw`
      insert into competency_bands (
        id,
        tenant_id,
        scoring_profile_id,
        key,
        label,
        min_score,
        max_score,
        sort_order,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.profileId}::uuid,
        ${band.key},
        ${band.label},
        ${band.minScore},
        ${band.maxScore},
        ${band.sortOrder},
        now(),
        now()
      )
    `;
  }

  return listBandsForProfile({ tx: args.tx, profileId: args.profileId });
}

export async function listSignalSources(args: { tx: Tx }): Promise<SignalSourceRow[]> {
  return args.tx.$queryRaw<SignalSourceRow[]>`
    select
      id::text,
      key,
      source_context,
      config_json
    from signal_sources
    order by key asc
  `;
}

export async function getNextConfigVersion(args: { tx: Tx; profileId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ max_version: number | null }>>`
    select max(version) as max_version
    from scoring_config_versions
    where scoring_profile_id = ${args.profileId}::uuid
  `;

  return (rows[0]?.max_version ?? 0) + 1;
}

export async function insertScoringConfigVersion(args: {
  tx: Tx;
  tenantId: string;
  profileId: string;
  version: number;
  configJson: ScoringConfigSnapshot;
  createdByMembershipId: string;
}): Promise<{ id: string; version: number; activatedAt: Date }> {
  const id = randomUUID();
  const rows = await args.tx.$queryRaw<Array<{ id: string; version: number; activated_at: Date }>>`
    insert into scoring_config_versions (
      id,
      tenant_id,
      scoring_profile_id,
      version,
      config_json,
      activated_at,
      created_by_membership_id,
      created_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.profileId}::uuid,
      ${args.version},
      ${JSON.stringify(args.configJson)}::jsonb,
      now(),
      ${args.createdByMembershipId}::uuid,
      now()
    )
    returning id::text, version, activated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create scoring config version.");
  return { id: row.id, version: row.version, activatedAt: row.activated_at };
}

export async function setActiveConfigVersion(args: {
  tx: Tx;
  profileId: string;
  configVersionId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    update scoring_profiles
    set
      active_config_version_id = ${args.configVersionId}::uuid,
      updated_at = now()
    where id = ${args.profileId}::uuid
  `;
}

export async function buildConfigSnapshot(args: {
  tx: Tx;
  profile: ScoringProfileDto;
}): Promise<ScoringConfigSnapshot> {
  const [dimensions, bands, signalSources] = await Promise.all([
    listDimensions({ tx: args.tx }),
    listBandsForProfile({ tx: args.tx, profileId: args.profile.id }),
    listSignalSources({ tx: args.tx }),
  ]);

  return {
    profile: {
      id: args.profile.id,
      key: args.profile.key,
      name: args.profile.name,
      status: args.profile.status,
    },
    dimensions,
    bands,
    signalSources: signalSources.map((source) => ({
      id: source.id,
      key: source.key,
      sourceContext: source.source_context,
      configJson: source.config_json,
    })),
    rulesJson: {},
  };
}
