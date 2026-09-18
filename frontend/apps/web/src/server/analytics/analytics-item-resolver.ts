// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import type { TenantTx } from "@atlas/db";
import { assessmentsRepository } from "../assessments/assessments.repository";
import { itemRegistryRepository } from "../item-registry/item-registry.repository";

export async function resolveAssessmentItemIds(
  tx: TenantTx,
  assessmentId: string,
): Promise<string[]> {
  const rows = await assessmentsRepository.listAssessmentItems(tx, assessmentId);
  return rows.map((row) => row.item_id);
}

export async function resolveItemReferences(
  tx: TenantTx,
  itemIds: string[],
): Promise<Map<string, { label: string }>> {
  const references = new Map<string, { label: string }>();

  for (const itemId of itemIds) {
    const item = await itemRegistryRepository.findItemById(tx, itemId);
    if (!item) {
      continue;
    }

    references.set(itemId, {
      label: extractItemLabel(item),
    });
  }

  return references;
}

function extractItemLabel(item: { stem_json: unknown; item_type_key: string }): string {
  if (item.stem_json && typeof item.stem_json === "object") {
    const stem = item.stem_json as { text?: unknown; title?: unknown };
    if (typeof stem.text === "string" && stem.text.trim().length > 0) {
      return stem.text.trim().slice(0, 120);
    }
    if (typeof stem.title === "string" && stem.title.trim().length > 0) {
      return stem.title.trim().slice(0, 120);
    }
  }

  return `${item.item_type_key} item`;
}
