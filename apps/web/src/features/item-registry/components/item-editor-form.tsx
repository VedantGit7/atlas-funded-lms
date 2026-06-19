"use client";

import { useState } from "react";
import { itemRegistryApi, type ItemDto, type ItemTypeDto } from "../api";

type DimensionWeight = {
  id: string;
  dimensionId: string;
  weight: string;
};

type Props = {
  itemId: string | null;
  item: ItemDto | null;
  itemTypes: ItemTypeDto[];
  dimensionWeights: DimensionWeight[];
};

export function ItemEditorForm({ itemId, item, itemTypes, dimensionWeights }: Props) {
  const [itemTypeKey, setItemTypeKey] = useState(item?.itemTypeKey ?? itemTypes[0]?.key ?? "");
  const [stem, setStem] = useState(
    typeof item?.contentJson === "object" &&
      item.contentJson !== null &&
      "stem" in item.contentJson &&
      typeof item.contentJson.stem === "string"
      ? item.contentJson.stem
      : "",
  );
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [answerKey, setAnswerKey] = useState(JSON.stringify(item?.answerKeyJson ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setPending(true);
    setError(null);

    try {
      const body = {
        itemTypeKey,
        contentJson: { stem },
        answerKeyJson: JSON.parse(answerKey || "{}") as Record<string, unknown>,
        tags: tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean),
        options: [],
      };

      if (itemId) {
        await itemRegistryApi.updateItem(itemId, {
          contentJson: body.contentJson,
          answerKeyJson: body.answerKeyJson,
          tags: body.tags,
          options: body.options,
        });
      } else {
        await itemRegistryApi.createItem(body);
      }

      window.location.href = "/studio/items";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save item");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4 rounded-lg border p-4">
        {error ? (
          <div role="alert" className="rounded-md border p-3 text-sm">
            {error}
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium">Item type</span>
          <select
            value={itemTypeKey}
            onChange={(event) => {
              setItemTypeKey(event.target.value);
            }}
            disabled={Boolean(itemId)}
            className="w-full rounded-md border p-2"
          >
            {itemTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.name || type.key}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Stem / Prompt</span>
          <textarea
            value={stem}
            onChange={(event) => {
              setStem(event.target.value);
            }}
            rows={8}
            className="w-full rounded-md border p-2"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Answer key JSON</span>
          <textarea
            value={answerKey}
            onChange={(event) => {
              setAnswerKey(event.target.value);
            }}
            rows={6}
            className="w-full rounded-md border p-2 font-mono text-sm"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">Tags</span>
          <input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
            }}
            className="w-full rounded-md border p-2"
            placeholder="risk, psychology, beginner"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            void onSubmit();
          }}
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Saving..." : "Save item"}
        </button>
      </div>

      <aside className="space-y-4 rounded-lg border p-4">
        <h2 className="font-medium">Dimension weights</h2>
        {dimensionWeights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dimension weights configured yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dimensionWeights.map((weight) => (
              <li key={weight.id} className="flex justify-between">
                <span>{weight.dimensionId}</span>
                <span>{weight.weight}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </section>
  );
}
