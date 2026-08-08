"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClientApiError, clientApi, toast } from "../../../../lib/client-api";
import type { PublicNewsfeedPostDto } from "../../../admin/grow/newsfeed-shared";

type PostResponse = { data: PublicNewsfeedPostDto };
type SaveResponse = { data: { postId: string; saved: boolean } };

export function LearnerNewsfeedArticle({ slug }: { slug: string }) {
  const [post, setPost] = useState<PublicNewsfeedPostDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<PostResponse>(
        `/api/v1/public/marketing/newsfeeds/by-slug/${encodeURIComponent(slug)}`,
        "learner-newsfeed-article",
      );
      setPost(response.data);
    } catch (caught) {
      setPost(null);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load article.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSave() {
    if (!post) return;
    setSaveBusy(true);
    try {
      if (post.saved) {
        const response = await clientApi.delete<SaveResponse>(
          `/api/v1/me/newsfeeds/${post.id}/save`,
          "learner-newsfeed-unsave",
        );
        setPost({ ...post, saved: response.data.saved });
        toast.success("Removed from saved.");
      } else {
        const response = await clientApi.post<SaveResponse>(
          `/api/v1/me/newsfeeds/${post.id}/save`,
          {},
          "learner-newsfeed-save",
        );
        setPost({ ...post, saved: response.data.saved });
        toast.success("Saved for later.");
      }
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not update saved state.",
      );
    } finally {
      setSaveBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted-foreground)]">Loading article…</p>;
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <Link href="/newsfeed" prefetch={false} className="text-sm underline underline-offset-4">
          Back to Newsfeed
        </Link>
        <p className="text-sm text-[var(--muted-foreground)]">Article not found.</p>
      </div>
    );
  }

  if (post.postType === "PROMO") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/newsfeed" prefetch={false} className="text-sm underline underline-offset-4">
          Back to Newsfeed
        </Link>
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImageUrl} alt="" className="w-full rounded-xl object-cover" />
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {post.title}
        </h1>
        {post.productId ? (
          <Link
            href={`/courses/${post.productId}`}
            prefetch={false}
            className="inline-flex rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]"
          >
            View {post.productTitle ?? "product"}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/newsfeed" prefetch={false} className="text-sm underline underline-offset-4">
          Back to Newsfeed
        </Link>
        <button
          type="button"
          disabled={saveBusy}
          onClick={() => void toggleSave()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          {saveBusy ? "Saving…" : post.saved ? "Unsave" : "Save"}
        </button>
      </div>
      {post.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt=""
          className="max-h-[28rem] w-full rounded-xl object-cover"
        />
      ) : null}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {post.seoTitle || post.title}
        </h1>
        <div className="flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
          {post.authorName ? <span>By {post.authorName}</span> : null}
          {post.publishedAt ? (
            <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
          ) : null}
        </div>
        {post.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--muted-foreground)]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <div
        className="prose prose-neutral max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml || "<p></p>" }}
      />
    </article>
  );
}
