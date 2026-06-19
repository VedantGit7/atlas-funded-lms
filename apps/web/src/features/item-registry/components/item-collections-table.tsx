"use client";

import { useState } from "react";
import {
  formatItemRegistryApiError,
  itemRegistryApi,
  type ItemCollectionDto,
  type ItemDto,
} from "../api";

type ItemCollectionsTableProps = {
  collections: ItemCollectionDto[];
  items: ItemDto[];
};

export function ItemCollectionsTable({ collections, items }: ItemCollectionsTableProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [collectionType, setCollectionType] = useState<"deck" | "quiz_bank" | "practice_set">(
    "deck",
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const [position, setPosition] = useState(1);

  async function onCreateCollection() {
    setPending(true);
    setError(null);

    try {
      await itemRegistryApi.createItemCollection({ slug, title, collectionType });
      window.location.reload();
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onAddItem() {
    if (!selectedCollectionId || !selectedItemId) return;

    setPending(true);
    setError(null);

    try {
      await itemRegistryApi.addItemToCollection(selectedCollectionId, {
        itemId: selectedItemId,
        position,
      });
      window.location.reload();
    } catch (err) {
      setError(formatItemRegistryApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded border p-4">
        <h2 className="font-medium">Create collection</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm">Slug</span>
            <input
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
              }}
              className="w-full rounded border p-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Title</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className="w-full rounded border p-2"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm">Type</span>
            <select
              value={collectionType}
              onChange={(event) => {
                setCollectionType(event.target.value as typeof collectionType);
              }}
              className="w-full rounded border p-2"
            >
              <option value="deck">Deck</option>
              <option value="quiz_bank">Quiz bank</option>
              <option value="practice_set">Practice set</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void onCreateCollection();
          }}
        >
          Create collection
        </button>
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="font-medium">Add item to collection</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm">Collection</span>
            <select
              value={selectedCollectionId}
              onChange={(event) => {
                setSelectedCollectionId(event.target.value);
              }}
              className="w-full rounded border p-2"
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Item</span>
            <select
              value={selectedItemId}
              onChange={(event) => {
                setSelectedItemId(event.target.value);
              }}
              className="w-full rounded border p-2"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.itemTypeKey} — {item.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Position</span>
            <input
              type="number"
              min={1}
              value={position}
              onChange={(event) => {
                setPosition(Number(event.target.value));
              }}
              className="w-full rounded border p-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void onAddItem();
          }}
        >
          Add item
        </button>
      </section>

      <section className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Title</th>
              <th className="p-3">Slug</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Items</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((collection) => (
              <tr key={collection.id} className="border-b">
                <td className="p-3">{collection.title}</td>
                <td className="p-3">{collection.slug}</td>
                <td className="p-3">{collection.collectionType}</td>
                <td className="p-3">{collection.status}</td>
                <td className="p-3">{collection.itemCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
