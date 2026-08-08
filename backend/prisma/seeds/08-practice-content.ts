import { withPlatformScope } from "@atlas/db";
import { stableSeedId } from "./ids";
import { emptySeedResult, type SeedModule, type SeedResult } from "./types";

const SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID = "018f0000-0000-7000-8000-000000000099";

/**
 * Demo practice content: one card of every practisable type, plus a published
 * deck that holds them. This is what makes the Swipe, Flashcards, Match, Learn
 * and Test engines exercisable in a fresh environment.
 *
 * Answer keys carry an `explanation`, which the flashcards engine shows as the
 * card back and the graded engines return as feedback.
 */
type SeedItem = {
  key: string;
  itemTypeKey: "swipe" | "matching" | "mcq_single" | "true_false";
  stem: string;
  answerKey: Record<string, unknown>;
  options?: Array<{ key: string; label: string; isCorrect: boolean }>;
};

const ITEMS: SeedItem[] = [
  {
    key: "swipe-alpha",
    itemTypeKey: "swipe",
    stem: "Alpha measures return above a benchmark.",
    answerKey: {
      direction: "right",
      explanation: "Alpha is the excess return of an investment relative to its benchmark.",
    },
  },
  {
    key: "swipe-beta",
    itemTypeKey: "swipe",
    stem: "A beta of 1.0 means the asset is uncorrelated with the market.",
    answerKey: {
      direction: "left",
      explanation: "A beta of 1.0 means it moves with the market. Zero beta implies no correlation.",
    },
  },
  {
    key: "swipe-liquidity",
    itemTypeKey: "swipe",
    stem: "A wider bid-ask spread generally signals lower liquidity.",
    answerKey: {
      direction: "right",
      explanation: "Wider spreads mean fewer willing counterparties, so the asset is less liquid.",
    },
  },
  {
    key: "match-risk-metrics",
    itemTypeKey: "matching",
    stem: "Match each risk metric to what it measures.",
    answerKey: {
      pairs: { alpha: "excess", beta: "market", sharpe: "riskadj" },
      leftItems: { alpha: "Alpha", beta: "Beta", sharpe: "Sharpe ratio" },
      rightItems: {
        excess: "Return above the benchmark",
        market: "Sensitivity to market moves",
        riskadj: "Return per unit of risk",
      },
      explanation: "Alpha is excess return, beta is market sensitivity, Sharpe is risk-adjusted return.",
    },
  },
  {
    key: "mcq-diversification",
    itemTypeKey: "mcq_single",
    stem: "What is the main purpose of diversification?",
    answerKey: {
      explanation: "Diversification reduces unsystematic (asset-specific) risk. Market risk remains.",
    },
    options: [
      { key: "a", label: "To reduce unsystematic risk", isCorrect: true },
      { key: "b", label: "To guarantee a positive return", isCorrect: false },
      { key: "c", label: "To eliminate all market risk", isCorrect: false },
      { key: "d", label: "To increase leverage", isCorrect: false },
    ],
  },
  {
    key: "mcq-sharpe",
    itemTypeKey: "mcq_single",
    stem: "A higher Sharpe ratio indicates what?",
    answerKey: {
      explanation: "The Sharpe ratio is return per unit of volatility, so higher is better.",
    },
    options: [
      { key: "a", label: "Better return per unit of risk", isCorrect: true },
      { key: "b", label: "Higher absolute return", isCorrect: false },
      { key: "c", label: "Lower trading costs", isCorrect: false },
    ],
  },
  {
    key: "tf-compounding",
    itemTypeKey: "true_false",
    stem: "Compounding means returns are earned on prior returns as well as principal.",
    answerKey: {
      value: true,
      explanation: "Compounding reinvests gains, so later returns are earned on a larger base.",
    },
  },
  {
    key: "tf-bonds",
    itemTypeKey: "true_false",
    stem: "Bond prices rise when interest rates rise.",
    answerKey: {
      value: false,
      explanation: "Bond prices move inversely to rates: when rates rise, existing bonds fall in price.",
    },
  },
];

const DECK_KEY = "starter-practice";
const DECK_TITLE = "Financial foundations";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

async function seedTenant(
  tx: Tx,
  tenantId: string,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const item of ITEMS) {
    const itemId = stableSeedId("practice_item", `${tenantId}:${item.key}`);

    const existing = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from items where id = ${itemId}::uuid limit 1
    `;

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await tx.$executeRaw`
      insert into items (
        id, tenant_id, item_type_key, stem_json, explanation_json, status, tags, created_at, updated_at
      )
      values (
        ${itemId}::uuid,
        ${tenantId}::uuid,
        ${item.itemTypeKey},
        ${JSON.stringify({ stem: item.stem })}::jsonb,
        ${JSON.stringify({ answerKey: item.answerKey, metadata: {} })}::jsonb,
        'PUBLISHED'::"PublishStatus",
        ARRAY[]::text[],
        now(),
        now()
      )
    `;
    inserted += 1;

    for (const [index, option] of (item.options ?? []).entries()) {
      const optionId = stableSeedId("practice_option", `${tenantId}:${item.key}:${option.key}`);
      await tx.$executeRaw`
        insert into item_options (id, tenant_id, item_id, option_json, is_correct, position, created_at, updated_at)
        values (
          ${optionId}::uuid,
          ${tenantId}::uuid,
          ${itemId}::uuid,
          ${JSON.stringify({ label: option.label })}::jsonb,
          ${option.isCorrect},
          ${index},
          now(),
          now()
        )
      `;
    }
  }

  // Tenant-authored deck: created_by_membership_id stays NULL so every learner sees it.
  const deckId = stableSeedId("practice_deck", `${tenantId}:${DECK_KEY}`);
  const deckExists = await tx.$queryRaw<Array<{ id: string }>>`
    select id::text from item_collections where id = ${deckId}::uuid limit 1
  `;

  if (deckExists.length === 0) {
    await tx.$executeRaw`
      insert into item_collections (
        id, tenant_id, slug, title, collection_type, status, metadata_json, created_at, updated_at
      )
      values (
        ${deckId}::uuid,
        ${tenantId}::uuid,
        ${DECK_KEY},
        ${DECK_TITLE},
        'deck',
        'PUBLISHED'::"PublishStatus",
        ${JSON.stringify({ category: "Foundations" })}::jsonb,
        now(),
        now()
      )
    `;
    inserted += 1;
  } else {
    skipped += 1;
  }

  for (const [index, item] of ITEMS.entries()) {
    const itemId = stableSeedId("practice_item", `${tenantId}:${item.key}`);
    const linkId = stableSeedId("practice_deck_item", `${tenantId}:${DECK_KEY}:${item.key}`);
    const linkExists = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text from item_collection_items where id = ${linkId}::uuid limit 1
    `;

    if (linkExists.length > 0) {
      skipped += 1;
      continue;
    }

    await tx.$executeRaw`
      insert into item_collection_items (id, tenant_id, collection_id, item_id, position, created_at)
      values (
        ${linkId}::uuid,
        ${tenantId}::uuid,
        ${deckId}::uuid,
        ${itemId}::uuid,
        ${index + 1},
        now()
      )
    `;
    inserted += 1;
  }

  return { inserted, skipped };
}

async function seedPracticeContent(log: (message: string) => void): Promise<SeedResult> {
  let inserted = 0;
  let skipped = 0;
  let tenantCount = 0;

  await withPlatformScope(
    {
      principalId: SYSTEM_CATALOGUE_SEED_PRINCIPAL_ID,
      requestId: "seed_practice_content",
      requiredPermission: "platform.catalog.manage",
      platformPermissions: ["platform.catalog.manage"],
    },
    "Seeding demo practice content",
    async (tx) => {
      const tenants = await tx.$queryRaw<Array<{ id: string }>>`
        select id::text from tenants where deleted_at is null
      `;

      for (const tenant of tenants) {
        tenantCount += 1;
        log(`[08-practice-content] seeding practice content for ${tenant.id}`);
        const result = await seedTenant(tx, tenant.id);
        inserted += result.inserted;
        skipped += result.skipped;
      }
    },
  );

  return {
    name: "08-practice-content",
    planned: tenantCount * (ITEMS.length * 2 + 1),
    inserted,
    updated: 0,
    skipped,
  };
}

export const practiceContentSeed: SeedModule = {
  name: "08-practice-content",
  groups: ["all", "tenants"],
  async run(ctx): Promise<SeedResult> {
    if (ctx.mode === "dry-run") {
      ctx.log("[08-practice-content] dry-run only; no rows inserted");
      return emptySeedResult("08-practice-content");
    }

    return await seedPracticeContent(ctx.log);
  },
};
