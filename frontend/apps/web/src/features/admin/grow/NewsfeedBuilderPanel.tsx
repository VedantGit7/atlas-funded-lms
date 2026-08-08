"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  Edit3,
  Eye,
  Info,
  Pin,
  Rocket,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  NEWSFEED_LIST_HREF,
  formatNewsfeedCount,
  formatNewsfeedDate,
  newsfeedStatusLabel,
  newsfeedTypeLabel,
  parseCsvList,
  type NewsfeedPostDto,
} from "./newsfeed-shared";

type Tab = "compose" | "settings" | "publish";

type CourseListItem = { id: string; title: string };

function StatusPill({ status }: { status: NewsfeedPostDto["status"] }) {
  const live = status === "LIVE";
  const unpublished = status === "UNPUBLISHED";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        live
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : unpublished
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          live
            ? "bg-[var(--admin-success)] motion-safe:animate-pulse"
            : unpublished
              ? "bg-[var(--admin-warning)]"
              : "bg-[var(--admin-on-surface-variant)]",
        ].join(" ")}
        aria-hidden="true"
      />
      {newsfeedStatusLabel(status)}
    </span>
  );
}

export function NewsfeedBuilderPanel({ postId }: { postId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("compose");
  const [post, setPost] = useState<NewsfeedPostDto | null>(null);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState("");
  const [pinned, setPinned] = useState(false);
  const [productId, setProductId] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const live = post?.status === "LIVE";
  const isPromo = post?.postType === "PROMO";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: NewsfeedPostDto }>(
        `/api/v1/marketing/newsfeeds/${postId}`,
      );
      const data = response.data;
      setPost(data);
      setTitle(data.title);
      setBodyHtml(data.bodyHtml ?? "");
      setCoverImageUrl(data.coverImageUrl ?? "");
      setSlug(data.slug);
      setSeoTitle(data.seoTitle ?? "");
      setSeoDescription(data.seoDescription ?? "");
      setAuthorName(data.authorName ?? "");
      setTags(data.tags.join(", "));
      setCategories(data.categories.join(", "));
      setPinned(data.pinned);
      setProductId(data.productId ?? "");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load post.",
      );
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadCourses = useCallback(async () => {
    try {
      const response = await clientApi.get<{
        data: { items: Array<{ id: string; title: string }> };
      }>("/api/v1/courses?view=studio&limit=100");
      setCourses(response.data.items.map((item) => ({ id: item.id, title: item.title })));
    } catch {
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isPromo) void loadCourses();
  }, [isPromo, loadCourses]);

  const courseOptions = useMemo(
    () => [
      { value: "", label: "Select a course / product" },
      ...courses.map((course) => ({ value: course.id, label: course.title })),
    ],
    [courses],
  );

  const seoTitleLen = seoTitle.trim().length;
  const seoDescLen = seoDescription.trim().length;
  const previewHost =
    typeof window !== "undefined" ? window.location.host : "your-school.example";

  async function saveDetails() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.patch<{ data: NewsfeedPostDto }>(
        `/api/v1/marketing/newsfeeds/${postId}`,
        {
          title: title.trim(),
          slug: slug.trim() || null,
          bodyHtml: bodyHtml.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
          authorName: authorName.trim() || null,
          tags: parseCsvList(tags),
          categories: parseCsvList(categories),
          pinned,
          productId: productId || null,
          productTitle: null,
        },
        "marketing-newsfeed-update",
        { successMessage: "Post saved." },
      );
      setPost(response.data);
      setSlug(response.data.slug);
      setProductId(response.data.productId ?? "");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: NewsfeedPostDto }>(
        `/api/v1/marketing/newsfeeds/${postId}/publish`,
        {},
        "marketing-newsfeed-publish",
        { successMessage: "Post is live." },
      );
      setPost(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: NewsfeedPostDto }>(
        `/api/v1/marketing/newsfeeds/${postId}/unpublish`,
        {},
        "marketing-newsfeed-unpublish",
        { successMessage: "Post unpublished." },
      );
      setPost(response.data);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Unpublish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!post) return;
    if (deleteConfirm.trim() !== post.title.trim()) {
      toast.error("Type the post title to confirm delete.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/newsfeeds/${postId}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "marketing-newsfeed-delete",
        { successMessage: "Post deleted." },
      );
      router.push(NEWSFEED_LIST_HREF);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-40 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="space-y-4">
        <Link href={NEWSFEED_LIST_HREF} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Post not found.</p>
      </div>
    );
  }

  const tabs: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Edit3 }> = [
    { id: "compose", label: "Compose", Icon: Edit3 },
    { id: "settings", label: "Settings", Icon: Settings2 },
    { id: "publish", label: "Publish & Analytics", Icon: Rocket },
  ];

  return (
    <div className="space-y-6">
      <Link href={NEWSFEED_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" />
        Back to newsfeed
      </Link>

      {live ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-warning)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-start gap-2 text-[var(--admin-warning)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              This post is live. Unpublish before editing compose or settings.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] px-3 py-1.5 text-xs font-semibold text-[var(--admin-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))]"
            disabled={busy}
            onClick={() => void unpublish()}
          >
            Unpublish to edit
          </button>
        </div>
      ) : null}

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-bold tracking-[-0.01em] text-[var(--admin-on-surface)] md:text-[28px]">
              {post.title}
            </h1>
            {post.pinned ? (
              <Pin
                className="h-5 w-5 fill-[var(--admin-primary)] text-[var(--admin-primary)]"
                aria-label="Pinned"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              {newsfeedTypeLabel(post.postType)}
            </span>
            <StatusPill status={post.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--admin-border)] px-4 py-2 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-surface-high)]"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          {!live ? (
            <button
              type="button"
              className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
              disabled={busy}
              onClick={() => void publish()}
            >
              Publish
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex gap-6 border-b border-[var(--admin-border)]" role="tablist">
        {tabs.map((entry) => {
          const active = tab === entry.id;
          const Icon = entry.Icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={[
                "relative -mb-px inline-flex items-center gap-2 pb-3 text-xs font-semibold tracking-wide transition-colors",
                active
                  ? "text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {entry.label}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--admin-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "compose" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-6">
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Post title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} border-none bg-transparent px-0 text-[18px] font-bold shadow-none focus:ring-0`}
                  disabled={live}
                  maxLength={200}
                />
              </div>
              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>
                  {isPromo ? "Cover image URL (required)" : "Cover image URL"}
                </label>
                <input
                  value={coverImageUrl}
                  onChange={(event) => setCoverImageUrl(event.target.value)}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                  disabled={live}
                  placeholder="https://"
                />
                <div className="relative mt-3 flex h-48 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)]">
                  {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      Cover preview appears here
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              {!isPromo ? (
                <div className="p-6">
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Body (HTML)</label>
                  <textarea
                    value={bodyHtml}
                    onChange={(event) => setBodyHtml(event.target.value)}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[320px] font-mono text-xs leading-relaxed`}
                    disabled={live}
                    placeholder="<p>Write your update...</p>"
                  />
                </div>
              ) : (
                <div className="space-y-4 p-6">
                  <AdminSelectDropdown
                    id="newsfeed-product"
                    label="Embed product (required)"
                    ariaLabel="Embedded product"
                    value={productId}
                    options={courseOptions}
                    disabled={live}
                    onChange={setProductId}
                  />
                  {post.productTitle ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      Linked: {post.productTitle}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || live}
                onClick={() => void saveDetails()}
              >
                {busy ? "Saving..." : "Save compose"}
              </button>
            </div>
          </div>

          <aside className="space-y-6 xl:col-span-4">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <h2 className="mb-4 text-[18px] font-semibold text-[var(--admin-on-surface)]">
                Post properties
              </h2>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Type is set at creation ({newsfeedTypeLabel(post.postType)}).
              </p>
              {isPromo ? (
                <div className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                  <p className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                    Promo card
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                    Select a product above to attach a course card to this post.
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 opacity-70">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                      Promo preview
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[var(--admin-primary)]">
                      Locked
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                    Switch to a Promo post type at creation to attach a product card.
                  </p>
                </div>
              )}
            </section>

            <section className="relative overflow-hidden rounded-xl bg-[var(--admin-primary)] p-5 text-[var(--admin-on-primary)]">
              <h3 className="text-[18px] font-semibold">Ready to go?</h3>
              <p className="mt-2 text-[13px] opacity-90">
                Save your changes, preview for learners, then publish from the Publish tab.
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-[var(--admin-surface)] py-2.5 text-sm font-bold text-[var(--admin-primary)]"
                onClick={() => setPreviewOpen(true)}
              >
                Open preview
              </button>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-6 text-[18px] font-semibold text-[var(--admin-on-surface)]">
                General settings & SEO
              </h2>
              <div className="space-y-5">
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>URL slug</label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                      /news/
                    </span>
                    <input
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      className={`${MESSENGER_WIZARD_FIELD_CLASS} rounded-l-none`}
                      disabled={live}
                    />
                  </div>
                </div>
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>SEO title</label>
                  <input
                    value={seoTitle}
                    onChange={(event) => setSeoTitle(event.target.value)}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    disabled={live}
                    maxLength={200}
                  />
                  <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    {seoTitleLen} of 60 characters recommended
                  </p>
                </div>
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Meta description</label>
                  <textarea
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-24`}
                    disabled={live}
                    maxLength={500}
                  />
                  <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    {seoDescLen} of 160 characters recommended
                    {seoDescLen > 160 ? " (slightly long)" : ""}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Search results preview
              </h3>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
                  {previewHost} › news › {slug || "slug"}
                </p>
                <p className="mt-1 text-[18px] font-medium text-[var(--admin-primary)]">
                  {seoTitle.trim() || title.trim() || post.title}
                </p>
                <p className="mt-1 text-[14px] leading-snug text-[var(--admin-on-surface-variant)]">
                  {seoDescription.trim() ||
                    "Add a meta description to control how this post appears in search snippets."}
                </p>
              </div>
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <h2 className="mb-6 text-[18px] font-semibold text-[var(--admin-on-surface)]">
                Metadata
              </h2>
              <div className="space-y-5">
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Author</label>
                  <input
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    disabled={live}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Categories (comma-separated)
                  </label>
                  <input
                    value={categories}
                    onChange={(event) => setCategories(event.target.value)}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    disabled={live}
                    placeholder="updates, launches"
                  />
                </div>
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Tags (comma-separated)</label>
                  <input
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    disabled={live}
                    placeholder="announcements, exams"
                  />
                  <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    Maximum of 30 tags per post.
                  </p>
                </div>
                <label
                  className={[
                    "flex items-start gap-3 border-t border-[var(--admin-border)] pt-4",
                    live ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(event) => setPinned(event.target.checked)}
                    disabled={live}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                      Pin this post
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[var(--admin-on-surface-variant)]">
                      Pinned posts stay at the top of the learner newsfeed.
                    </span>
                  </span>
                </label>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || live}
                onClick={() => void saveDetails()}
              >
                {busy ? "Saving..." : "Save settings"}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "publish" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Post status
                </h2>
                <StatusPill status={post.status} />
              </div>
              <div className="space-y-3 text-sm">
                <p className="text-[var(--admin-on-surface)]">
                  {post.publishedAt
                    ? `Published ${formatNewsfeedDate(post.publishedAt)}`
                    : "Not published yet"}
                </p>
                <p className="text-[var(--admin-on-surface-variant)]">
                  Updated {formatNewsfeedDate(post.updatedAt)}
                </p>
              </div>
              <div className="mt-6 space-y-3">
                {live ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] py-3 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void unpublish()}
                  >
                    Unpublish
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] py-3 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void publish()}
                  >
                    Publish now
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] py-3 text-xs font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] disabled:opacity-50"
                  disabled={busy || live}
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteConfirm("");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </button>
              </div>
              {isPromo ? (
                <p className="mt-4 text-[12px] text-[var(--admin-on-surface-variant)]">
                  Promo posts need a cover image and embedded product before publishing.
                </p>
              ) : null}
            </section>
          </div>

          <div className="space-y-6 lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <p className="mb-2 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                  Learner saves
                </p>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                    {formatNewsfeedCount(post.saveCount)}
                  </p>
                  <Bookmark className="mb-1 h-4 w-4 text-[var(--admin-primary)]" />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <p className="mb-2 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                  Status
                </p>
                <p className="text-[20px] font-bold text-[var(--admin-on-surface)]">
                  {newsfeedStatusLabel(post.status)}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <p className="mb-2 text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
                  Type
                </p>
                <p className="text-[20px] font-bold text-[var(--admin-on-surface)]">
                  {newsfeedTypeLabel(post.postType)}
                </p>
              </div>
            </div>

            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
              <div className="mb-3 flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]" />
                <div>
                  <h3 className="text-[18px] font-semibold text-[var(--admin-on-surface)]">
                    Analytics note
                  </h3>
                  <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                    Views, clicks, and conversion charts are not tracked yet. Only learner bookmark
                    saves are available, so this tab shows that metric instead of invented
                    engagement numbers.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))] p-6">
              <h3 className="text-[18px] font-semibold text-[var(--admin-danger)]">Danger zone</h3>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Deleting permanently removes this post and its saves. Unpublish first if the post
                is live.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--admin-danger)] px-4 py-2.5 text-xs font-bold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || live}
                onClick={() => {
                  setDeleteOpen(true);
                  setDeleteConfirm("");
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete post
              </button>
            </section>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsfeed-preview-title"
            className={`admin-theme max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id="newsfeed-preview-title"
                className="text-lg font-semibold text-[var(--admin-on-surface)]"
              >
                Preview
              </h2>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-[var(--admin-surface-high)]"
                aria-label="Close preview"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt=""
                className="mb-4 max-h-64 w-full rounded-xl object-cover"
              />
            ) : null}
            <h3 className="text-xl font-semibold text-[var(--admin-on-surface)]">
              {title || post.title}
            </h3>
            {authorName ? (
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                By {authorName}
              </p>
            ) : null}
            {isPromo ? (
              <p className="mt-4 text-sm text-[var(--admin-on-surface)]">
                Opens product: {post.productTitle || "Select a product"}
              </p>
            ) : (
              <div
                className="prose prose-sm mt-4 max-w-none text-[var(--admin-on-surface)]"
                dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>(empty)</p>" }}
              />
            )}
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
          onClick={() => {
            if (!busy) setDeleteOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsfeed-builder-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="newsfeed-builder-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete post
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{post.title}</span> to
              confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              disabled={busy}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold"
                disabled={busy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || deleteConfirm.trim() !== post.title.trim()}
                onClick={() => void onDelete()}
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
