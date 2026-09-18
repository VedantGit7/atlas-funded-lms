import { withPlatformScope } from "@atlas/db";
import { stableSeedId } from "./ids";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID = "018f0000-0000-7000-8000-000000000099";

const ITEM_TYPE_SCHEMAS: Record<
  string,
  {
    fields: string[];
    answerKeyShape: string;
    responseShape: string;
    requiresOptions: boolean;
    gradingMode: "auto" | "manual";
  }
> = {
  mcq_single: {
    fields: ["stem"],
    answerKeyShape: "{ correctOptionId: string }",
    responseShape: "{ selectedOptionId: string }",
    requiresOptions: true,
    gradingMode: "auto",
  },
  mcq_multi: {
    fields: ["stem"],
    answerKeyShape: "{ correctOptionIds: string[] }",
    responseShape: "{ selectedOptionIds: string[] }",
    requiresOptions: true,
    gradingMode: "auto",
  },
  true_false: {
    fields: ["stem"],
    answerKeyShape: "{ value: boolean }",
    responseShape: "{ value: boolean }",
    requiresOptions: false,
    gradingMode: "auto",
  },
  fill_blank: {
    fields: ["stem"],
    answerKeyShape: "{ acceptedValues: string[] }",
    responseShape: "{ value: string }",
    requiresOptions: false,
    gradingMode: "auto",
  },
  short_answer: {
    fields: ["stem"],
    answerKeyShape: "{ rubric?: string, modelAnswer?: string }",
    responseShape: "{ value: string }",
    requiresOptions: false,
    gradingMode: "manual",
  },
  long_answer: {
    fields: ["stem"],
    answerKeyShape: "{ rubric?: string, modelAnswer?: string }",
    responseShape: "{ value: string }",
    requiresOptions: false,
    gradingMode: "manual",
  },
  matching: {
    fields: ["stem"],
    answerKeyShape:
      "{ pairs: Record<string, string>, leftItems?: Record<string, string>, rightItems?: Record<string, string> }",
    responseShape: "{ pairs: Record<string, string> }",
    requiresOptions: false,
    gradingMode: "auto",
  },
  ordering: {
    fields: ["stem"],
    answerKeyShape: "{ order: string[], items?: Record<string, string> }",
    responseShape: "{ order: string[] }",
    requiresOptions: false,
    gradingMode: "auto",
  },
  file_upload: {
    fields: ["stem"],
    answerKeyShape: "{ rubric?: string, acceptedFileTypes?: string[] }",
    responseShape: "{ fileName: string }",
    requiresOptions: false,
    gradingMode: "manual",
  },
  swipe: {
    fields: ["stem"],
    answerKeyShape: '{ direction: "left" | "right" }',
    responseShape: '{ action: "known" | "unknown" }',
    requiresOptions: false,
    gradingMode: "auto",
  },
};

const ITEM_TYPES = [
  { key: "mcq_single", name: "Multiple choice (single)", rendererKey: "mcq_single" },
  { key: "mcq_multi", name: "Multiple choice (multi)", rendererKey: "mcq_multi" },
  { key: "true_false", name: "True / False", rendererKey: "true_false" },
  { key: "fill_blank", name: "Fill in the blank", rendererKey: "fill_blank" },
  { key: "short_answer", name: "Short answer", rendererKey: "short_answer" },
  { key: "long_answer", name: "Long answer", rendererKey: "long_answer" },
  { key: "matching", name: "Matching", rendererKey: "matching" },
  { key: "ordering", name: "Ordering", rendererKey: "ordering" },
  { key: "file_upload", name: "File upload", rendererKey: "file_upload" },
  { key: "swipe", name: "Swipe card", rendererKey: "swipe" },
] as const;

async function seedItemTypes(): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;

  await withPlatformScope(
    {
      principalId: SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID,
      requestId: "seed_item_types",
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Seeding global item types catalogue",
    async (tx) => {
      for (const itemType of ITEM_TYPES) {
        const id = stableSeedId("item_type", itemType.key);
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          select id::text from item_types where key = ${itemType.key} limit 1
        `;

        if (existing.length > 0) {
          skipped += 1;
          continue;
        }

        await tx.$executeRaw`
          insert into item_types (
            id,
            key,
            name,
            schema_json,
            grading_json,
            renderer_key,
            is_builtin,
            created_at,
            updated_at
          )
          values (
            ${id}::uuid,
            ${itemType.key},
            ${itemType.name},
            ${JSON.stringify(ITEM_TYPE_SCHEMAS[itemType.key] ?? { fields: ["stem"] })}::jsonb,
            null,
            ${itemType.rendererKey},
            true,
            now(),
            now()
          )
        `;

        inserted += 1;
      }
    },
  );

  return {
    name: "04-item-types",
    planned: ITEM_TYPES.length,
    inserted,
    updated: 0,
    skipped,
  };
}

export const itemTypesSeed: SeedModule = {
  name: "04-item-types",
  groups: ["all", "catalogues"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[04-item-types] dry-run only; no rows inserted");
      return emptySeedResult("04-item-types");
    }

    ctx.log(`[04-item-types] seeding ${String(ITEM_TYPES.length)} item types`);
    return seedItemTypes();
  },
};
