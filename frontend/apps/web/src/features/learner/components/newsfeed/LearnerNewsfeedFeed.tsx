"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClientApiError, clientApi, toast } from "@/lib/client-api";
import type { PublicNewsfeedPostDto } from "@/features/admin/grow/newsfeed-shared";

type FeedResponse = {
  data: {
    enabled: boolean;
    articles: PublicNewsfeedPostDto[];
    promos: PublicNewsfeedPostDto[];
    tags: string[];
    categories: string[];
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LearnerNewsfeedFeed() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [articles, setArticles] = useState<PublicNewsfeedPostDto[]>([]);
  const [promos, setPromos] = useState<PublicNewsfeedPostDto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [promoIndex, setPromoIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tag) params.set("tag", tag);
      if (category) params.set("category", category);
      const qs = params.toString();
      const response = await clientApi.get<FeedResponse>(
        `/api/v1/public/marketing/newsfeeds${qs ? `?${qs}` : ""}`,
        "learner-newsfeed-feed",
      );
      setEnabled(response.data.enabled);
      setArticles(response.data.articles);
      setPromos(response.data.promos);
      setTags(response.data.tags);
      setCategories(response.data.categories);
      setPromoIndex(0);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load newsfeed.");
      setEnabled(false);
      setArticles([]);
      setPromos([]);
    } finally {
      setLoading(false);
    }
  }, [tag, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePromo = useMemo(() => {
    if (promos.length === 0) return null;
    return promos[promoIndex % promos.length] ?? null;
  }, [promos, promoIndex]);

  if (loading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Loading newsfeed…</p>;
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Newsfeed is not enabled</h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Your academy has not turned on Newsfeed yet. Check back later for updates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {promos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Promos
            </h2>
            {promos.length > 1 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                  onClick={() => {
                    setPromoIndex((index) => (index - 1 + promos.length) % promos.length);
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
                  onClick={() => {
                    setPromoIndex((index) => (index + 1) % promos.length);
                  }}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
          {activePromo ? (
            <Link
              href={
                activePromo.productId
                  ? `/courses/${activePromo.productId}`
                  : `/newsfeed/${activePromo.slug}`
              }
              prefetch={false}
              className="block overflow-hidden rounded-xl border border-[var(--border)] bg-card"
            >
              {activePromo.coverImageUrl ? (
                <img
                  src={activePromo.coverImageUrl}
                  alt=""
                  className="h-48 w-full object-cover sm:h-64"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-[var(--muted)] sm:h-64">
                  <span className="text-sm text-[var(--muted-foreground)]">Promo</span>
                </div>
              )}
              <div className="space-y-1 p-4">
                <p className="font-semibold text-[var(--foreground)]">{activePromo.title}</p>
                {activePromo.productTitle ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    View {activePromo.productTitle}
                  </p>
                ) : null}
              </div>
            </Link>
          ) : null}
          {promos.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {promos.map((promo, index) => (
                <button
                  key={promo.id}
                  type="button"
                  onClick={() => {
                    setPromoIndex(index);
                  }}
                  className={[
                    "h-14 w-20 shrink-0 overflow-hidden rounded-md border",
                    index === promoIndex
                      ? "border-[var(--foreground)]"
                      : "border-[var(--border)] opacity-70",
                  ].join(" ")}
                  aria-label={`Show promo ${promo.title}`}
                >
                  {promo.coverImageUrl ? (
                    <img src={promo.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {(tags.length > 0 || categories.length > 0) && (
        <section className="space-y-3">
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory(null);
                }}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  category == null
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)]",
                ].join(" ")}
              >
                All categories
              </button>
              {categories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    setCategory(entry);
                  }}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    category === entry
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)]",
                  ].join(" ")}
                >
                  {entry}
                </button>
              ))}
            </div>
          ) : null}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setTag(null);
                }}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  tag == null
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)]",
                ].join(" ")}
              >
                All tags
              </button>
              {tags.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => {
                    setTag(entry);
                  }}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    tag === entry
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)]",
                  ].join(" ")}
                >
                  {entry}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          Articles
        </h2>
        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">
            No articles published yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/newsfeed/${article.slug}`}
                prefetch={false}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-card transition-colors hover:border-[var(--foreground)]/30"
              >
                {article.coverImageUrl ? (
                  <img src={article.coverImageUrl} alt="" className="h-40 w-full object-cover" />
                ) : null}
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    {article.pinned ? (
                      <span className="font-semibold uppercase tracking-wide">Pinned</span>
                    ) : null}
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    {article.title}
                  </h3>
                  {article.authorName ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      By {article.authorName}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
