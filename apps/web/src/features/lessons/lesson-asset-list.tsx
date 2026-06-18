"use client";

import { useEffect, useState } from "react";
import { clientApi } from "../../lib/client-api";

type LessonAsset = {
  id: string;
  assetType: string;
  fileName: string | null;
  downloadUrl: string | null;
  externalUrl: string | null;
};

type LessonAssetListProps = {
  lessonId: string;
};

export function LessonAssetList({ lessonId }: LessonAssetListProps) {
  const [assets, setAssets] = useState<LessonAsset[]>([]);

  useEffect(() => {
    void clientApi
      .get<{ data: { items: LessonAsset[] } }>(`/api/v1/lessons/${lessonId}/assets`)
      .then((response) => {
        setAssets(response.data.items);
      })
      .catch(() => {
        setAssets([]);
      });
  }, [lessonId]);

  if (assets.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded border p-4">
      <h2>Resources</h2>
      <ul className="space-y-2">
        {assets.map((asset) => {
          const href = asset.downloadUrl ?? asset.externalUrl;
          return (
            <li key={asset.id}>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  {asset.fileName ?? asset.assetType}
                </a>
              ) : (
                <span>{asset.fileName ?? asset.assetType}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
