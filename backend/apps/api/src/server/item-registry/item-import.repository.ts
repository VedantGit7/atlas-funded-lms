import type { TenantTx } from "@atlas/db";

/**
 * Storage for importing questions from a spreadsheet (migration 133).
 *
 * A question's fingerprint is its wording with case and runs of spaces
 * ignored, hashed. It is always computed here, in SQL, with the expression
 * of the `items_stem_fingerprint_idx` index, so the questions being imported
 * and those in the bank are reduced by exactly the same rules.
 */

export type ImportBatchRow = {
  id: string;
  tenant_id: string;
  item_type_key: string;
  file_name: string;
  template_version: string;
  status: "importing" | "completed" | "undone";
  rows_in_file: number;
  rows_with_errors: number;
  rows_to_import: number;
  imported_count: number;
  duplicate_count: number;
  rejected_count: number;
  skip_duplicates: boolean;
  extra_tags: string[];
  created_by_membership_id: string;
  created_at: Date;
  completed_at: Date | null;
  undone_at: Date | null;
};

/** A batch in the history, with what is left of it in the bank today. */
export type ImportBatchHistoryRow = ImportBatchRow & {
  live_count: number;
  published_count: number;
};

export type ImportItemInsert = {
  id: string;
  /** The question's own type (a mixed import has several, S3.4b). */
  itemTypeKey: string;
  rowNumber: number;
  stemJson: unknown;
  explanationJson: unknown;
  tags: string[];
  reference: string | null;
  options: Array<{ id: string; optionJson: unknown; isCorrect: boolean | null; position: number }>;
  weights: Array<{ id: string; dimensionId: string; weight: number }>;
};

const BATCH_COLUMNS = `
  id::text, tenant_id::text, item_type_key, file_name, template_version, status,
  rows_in_file, rows_with_errors, rows_to_import, imported_count, duplicate_count,
  rejected_count, skip_duplicates, extra_tags, created_by_membership_id::text,
  created_at, completed_at, undone_at
`;

export const itemImportRepository = {
  /** Fingerprints of the given question texts, in the same order. */
  async fingerprints(tx: TenantTx, stems: string[]): Promise<string[]> {
    if (stems.length === 0) return [];
    const rows = await tx.$queryRaw<Array<{ ord: number; fingerprint: string }>>`
      select t.ord::int as ord,
             md5(lower(regexp_replace(btrim(t.stem), '\\s+', ' ', 'g'))) as fingerprint
        from unnest(${stems}::text[]) with ordinality as t(stem, ord)
       order by t.ord
    `;
    return rows.map((row) => row.fingerprint);
  },

  /** Questions of this type in the bank with any of these fingerprints. */
  async findByFingerprints(
    tx: TenantTx,
    args: { tenantId: string; itemTypeKey: string; fingerprints: string[] },
  ): Promise<Map<string, string>> {
    if (args.fingerprints.length === 0) return new Map();
    const rows = await tx.$queryRaw<Array<{ fingerprint: string; id: string }>>`
      select distinct on (fingerprint) fingerprint, id
        from (
          select md5(lower(regexp_replace(btrim(stem_json ->> 'stem'), '\\s+', ' ', 'g'))) as fingerprint,
                 id::text as id,
                 created_at
            from items
           where tenant_id = ${args.tenantId}::uuid
             and item_type_key = ${args.itemTypeKey}
             and deleted_at is null
             and md5(lower(regexp_replace(btrim(stem_json ->> 'stem'), '\\s+', ' ', 'g')))
                 = any(${args.fingerprints}::text[])
        ) matches
       order by fingerprint, created_at asc
    `;
    return new Map(rows.map((row) => [row.fingerprint, row.id]));
  },

  /** Questions in the bank (any type) that carry any of these references. */
  async findByReferences(
    tx: TenantTx,
    args: { tenantId: string; references: string[] },
  ): Promise<Map<string, string>> {
    if (args.references.length === 0) return new Map();
    const rows = await tx.$queryRaw<Array<{ reference: string; id: string }>>`
      select distinct on (import_reference) import_reference as reference, id::text as id
        from items
       where tenant_id = ${args.tenantId}::uuid
         and import_reference = any(${args.references}::text[])
         and deleted_at is null
       order by import_reference, created_at asc
    `;
    return new Map(rows.map((row) => [row.reference, row.id]));
  },

  async createBatch(
    tx: TenantTx,
    data: {
      tenantId: string;
      itemTypeKey: string;
      fileName: string;
      templateVersion: string;
      rowsInFile: number;
      rowsWithErrors: number;
      rowsToImport: number;
      skipDuplicates: boolean;
      extraTags: string[];
      createdByMembershipId: string;
    },
  ): Promise<ImportBatchRow> {
    const rows = await tx.$queryRawUnsafe<ImportBatchRow[]>(
      `insert into item_import_batches (
         tenant_id, item_type_key, file_name, template_version, rows_in_file,
         rows_with_errors, rows_to_import, skip_duplicates, extra_tags,
         created_by_membership_id
       )
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::uuid)
       returning ${BATCH_COLUMNS}`,
      data.tenantId,
      data.itemTypeKey,
      data.fileName,
      data.templateVersion,
      data.rowsInFile,
      data.rowsWithErrors,
      data.rowsToImport,
      data.skipDuplicates,
      data.extraTags,
      data.createdByMembershipId,
    );
    const batch = rows[0];
    if (!batch) throw new Error("ITEM_IMPORT_BATCH_CREATE_FAILED");
    return batch;
  },

  /** The batch, locked until the transaction ends so chunks run one at a time. */
  async lockBatch(tx: TenantTx, batchId: string): Promise<ImportBatchRow | null> {
    const rows = await tx.$queryRawUnsafe<ImportBatchRow[]>(
      `select ${BATCH_COLUMNS} from item_import_batches where id = $1::uuid for update`,
      batchId,
    );
    return rows[0] ?? null;
  },

  async addCounts(
    tx: TenantTx,
    batchId: string,
    counts: { imported: number; duplicate: number; rejected: number },
  ): Promise<ImportBatchRow> {
    const rows = await tx.$queryRawUnsafe<ImportBatchRow[]>(
      `update item_import_batches
          set imported_count = imported_count + $2,
              duplicate_count = duplicate_count + $3,
              rejected_count = rejected_count + $4,
              updated_at = now()
        where id = $1::uuid
        returning ${BATCH_COLUMNS}`,
      batchId,
      counts.imported,
      counts.duplicate,
      counts.rejected,
    );
    const batch = rows[0];
    if (!batch) throw new Error("ITEM_IMPORT_BATCH_UPDATE_FAILED");
    return batch;
  },

  async completeBatch(tx: TenantTx, batchId: string): Promise<ImportBatchRow> {
    const rows = await tx.$queryRawUnsafe<ImportBatchRow[]>(
      `update item_import_batches
          set status = 'completed', completed_at = now(), updated_at = now()
        where id = $1::uuid
        returning ${BATCH_COLUMNS}`,
      batchId,
    );
    const batch = rows[0];
    if (!batch) throw new Error("ITEM_IMPORT_BATCH_UPDATE_FAILED");
    return batch;
  },

  /**
   * The academy's imports, newest first, with how many of each batch's
   * questions are still in the bank and how many are published.
   */
  async listBatches(
    tx: TenantTx,
    args: { tenantId: string; limit: number; cursor: string | null },
  ): Promise<ImportBatchHistoryRow[]> {
    return tx.$queryRawUnsafe<ImportBatchHistoryRow[]>(
      `select ${BATCH_COLUMNS},
              coalesce(c.live_count, 0)::int as live_count,
              coalesce(c.published_count, 0)::int as published_count
         from item_import_batches b
         left join lateral (
           select count(*) filter (where i.deleted_at is null) as live_count,
                  count(*) filter (where i.deleted_at is null
                                     and i.status = 'PUBLISHED'::"PublishStatus") as published_count
             from items i
            where i.tenant_id = b.tenant_id and i.import_batch_id = b.id
         ) c on true
        where b.tenant_id = $1::uuid
          and ($2::uuid is null
               or (b.created_at, b.id) < (select p.created_at, p.id from item_import_batches p
                                           where p.id = $2::uuid))
        order by b.created_at desc, b.id desc
        limit $3`,
      args.tenantId,
      args.cursor,
      args.limit + 1,
    );
  },

  /**
   * Removes the batch's questions that nothing uses yet and closes the batch.
   * A question in a collection or deck, an assessment, or with practice
   * answers or review history stays, so no learner record loses its question.
   * Removal is the usual soft delete (deleted_at, ARCHIVED).
   */
  async undoBatch(
    tx: TenantTx,
    args: { tenantId: string; batchId: string; actorMembershipId: string },
  ): Promise<{ batch: ImportBatchRow; removed: number; kept: number }> {
    const removed = await tx.$queryRaw<Array<{ id: string }>>`
      update items i
         set deleted_at = now(), status = 'ARCHIVED'::"PublishStatus", updated_at = now()
       where i.tenant_id = ${args.tenantId}::uuid
         and i.import_batch_id = ${args.batchId}::uuid
         and i.deleted_at is null
         and not exists (select 1 from item_collection_items x
                          where x.tenant_id = i.tenant_id and x.item_id = i.id)
         and not exists (select 1 from assessment_items x
                          where x.tenant_id = i.tenant_id and x.item_id = i.id)
         and not exists (select 1 from practice_responses x
                          where x.tenant_id = i.tenant_id and x.item_id = i.id)
         and not exists (select 1 from srs_state x
                          where x.tenant_id = i.tenant_id and x.item_id = i.id)
      returning i.id::text as id
    `;
    const kept = await tx.$queryRaw<Array<{ kept: number }>>`
      select count(*)::int as kept
        from items
       where tenant_id = ${args.tenantId}::uuid
         and import_batch_id = ${args.batchId}::uuid
         and deleted_at is null
    `;
    const rows = await tx.$queryRawUnsafe<ImportBatchRow[]>(
      `update item_import_batches
          set status = 'undone', undone_at = now(), undone_by_membership_id = $2::uuid,
              updated_at = now()
        where id = $1::uuid
        returning ${BATCH_COLUMNS}`,
      args.batchId,
      args.actorMembershipId,
    );
    const batch = rows[0];
    if (!batch) throw new Error("ITEM_IMPORT_BATCH_UPDATE_FAILED");
    return { batch, removed: removed.length, kept: kept[0]?.kept ?? 0 };
  },

  /** Rows of this batch already imported, with their question ids. */
  async importedRows(
    tx: TenantTx,
    args: { tenantId: string; batchId: string; rowNumbers: number[] },
  ): Promise<Map<number, string>> {
    if (args.rowNumbers.length === 0) return new Map();
    const rows = await tx.$queryRaw<Array<{ row_number: number; id: string }>>`
      select import_row_number as row_number, id::text as id
        from items
       where tenant_id = ${args.tenantId}::uuid
         and import_batch_id = ${args.batchId}::uuid
         and import_row_number = any(${args.rowNumbers}::int[])
    `;
    return new Map(rows.map((row) => [row.row_number, row.id]));
  },

  /** New Draft questions with their options and weights, three statements in all. */
  async insertItems(
    tx: TenantTx,
    args: {
      tenantId: string;
      batchId: string;
      createdByMembershipId: string;
      items: ImportItemInsert[];
    },
  ): Promise<void> {
    if (args.items.length === 0) return;

    const items = args.items.map((item) => ({
      id: item.id,
      item_type_key: item.itemTypeKey,
      row_number: item.rowNumber,
      stem_json: item.stemJson,
      explanation_json: item.explanationJson,
      tags: item.tags,
      reference: item.reference,
    }));
    await tx.$executeRaw`
      insert into items (
        id, tenant_id, item_type_key, stem_json, explanation_json, status, tags,
        created_by_membership_id, created_at, updated_at,
        import_batch_id, import_row_number, import_reference
      )
      select r.id, ${args.tenantId}::uuid, r.item_type_key, r.stem_json,
             r.explanation_json, 'DRAFT'::"PublishStatus",
             array(select jsonb_array_elements_text(r.tags)),
             ${args.createdByMembershipId}::uuid, now(), now(),
             ${args.batchId}::uuid, r.row_number, r.reference
        from jsonb_to_recordset(${JSON.stringify(items)}::jsonb) as r(
          id uuid, item_type_key text, row_number int, stem_json jsonb, explanation_json jsonb,
          tags jsonb, reference text
        )
    `;

    const options = args.items.flatMap((item) =>
      item.options.map((option) => ({
        id: option.id,
        item_id: item.id,
        option_json: option.optionJson,
        is_correct: option.isCorrect,
        position: option.position,
      })),
    );
    if (options.length > 0) {
      await tx.$executeRaw`
        insert into item_options (
          id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at
        )
        select r.id, ${args.tenantId}::uuid, r.item_id, r.option_json, r.is_correct,
               r.position, now(), now()
          from jsonb_to_recordset(${JSON.stringify(options)}::jsonb) as r(
            id uuid, item_id uuid, option_json jsonb, is_correct boolean, position int
          )
      `;
    }

    const weights = args.items.flatMap((item) =>
      item.weights.map((weight) => ({
        id: weight.id,
        item_id: item.id,
        dimension_id: weight.dimensionId,
        weight: weight.weight,
      })),
    );
    if (weights.length > 0) {
      await tx.$executeRaw`
        insert into item_dimension_weights (id, tenant_id, item_id, dimension_id, weight, created_at)
        select r.id, ${args.tenantId}::uuid, r.item_id, r.dimension_id, r.weight, now()
          from jsonb_to_recordset(${JSON.stringify(weights)}::jsonb) as r(
            id uuid, item_id uuid, dimension_id uuid, weight numeric
          )
      `;
    }
  },
};
