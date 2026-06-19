"use client";

import Link from "next/link";
import type { ItemDto, ItemTypeDto } from "../api";

type ItemBankTableProps = {
  items: ItemDto[];
  itemTypes: ItemTypeDto[];
};

export function ItemBankTable({ items, itemTypes }: ItemBankTableProps) {
  const typeNameByKey = new Map(itemTypes.map((type) => [type.key, type.name]));

  return (
    <div className="overflow-x-auto rounded border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-3">Stem</th>
            <th className="p-3">Type</th>
            <th className="p-3">Status</th>
            <th className="p-3">Tags</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const stemValue = (item.contentJson as { stem?: unknown }).stem;
            const stem =
              typeof stemValue === "string"
                ? stemValue
                : typeof stemValue === "number"
                  ? String(stemValue)
                  : "";

            return (
              <tr key={item.id} className="border-b">
                <td className="p-3">{stem || item.id.slice(0, 8)}</td>
                <td className="p-3">{typeNameByKey.get(item.itemTypeKey) ?? item.itemTypeKey}</td>
                <td className="p-3">{item.status}</td>
                <td className="p-3">{item.tags.join(", ") || "—"}</td>
                <td className="p-3">
                  <Link href={`/studio/items/${item.id}`}>Edit</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
