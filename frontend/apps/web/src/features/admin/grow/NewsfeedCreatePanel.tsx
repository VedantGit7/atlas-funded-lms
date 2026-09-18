"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, FileText, Lightbulb, Tag } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  NEWSFEED_LIST_HREF,
  newsfeedHref,
  type NewsfeedPostDto,
  type NewsfeedPostType,
} from "./newsfeed-shared";

const TYPES: ReadonlyArray<{
  id: NewsfeedPostType;
  label: string;
  hint: string;
  Icon: typeof FileText;
}> = [
  {
    id: "ARTICLE",
    label: "Article",
    hint: "A written update with rich text, images, and embedded media.",
    Icon: FileText,
  },
  {
    id: "PROMO",
    label: "Promo",
    hint: "A promotional post designed to highlight a course or product.",
    Icon: Tag,
  },
];

export function NewsfeedCreatePanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [postType, setPostType] = useState<NewsfeedPostType>("ARTICLE");
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<{ data: NewsfeedPostDto }>(
        "/api/v1/marketing/newsfeeds",
        { title: title.trim(), postType },
        "marketing-newsfeed-create",
        { successMessage: "Post created." },
      );
      router.push(newsfeedHref(response.data.id));
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create post.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[720px] flex-col justify-center space-y-6 motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
      <Link href={NEWSFEED_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" />
        Back to newsfeed
      </Link>

      <header className="text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Create a new post
        </h1>
        <p className="mt-2 text-[16px] text-[var(--admin-on-surface-variant)]">
          Choose a format for your message to learners.
        </p>
      </header>

      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
        <div className="space-y-6">
          <div>
            <label htmlFor="newsfeed-create-title" className={MESSENGER_WIZARD_LABEL_CLASS}>
              Post title
            </label>
            <input
              id="newsfeed-create-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} h-12`}
              placeholder="Enter a title for your post..."
              maxLength={200}
              disabled={busy}
            />
          </div>

          <fieldset>
            <legend className={`${MESSENGER_WIZARD_LABEL_CLASS} mb-3`}>Select post type</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TYPES.map((entry) => {
                const active = postType === entry.id;
                const Icon = entry.Icon;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setPostType(entry.id);
                    }}
                    className={[
                      "flex h-full flex-col items-start rounded-xl border p-6 text-left transition-all motion-safe:hover:-translate-y-0.5",
                      active
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] shadow-[0_0_0_1px_var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)]",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <span
                      className={[
                        "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg",
                        entry.id === "ARTICLE"
                          ? "bg-[var(--admin-primary-container)] text-[var(--admin-primary)]"
                          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[18px] font-semibold text-[var(--admin-on-surface)]">
                      {entry.label}
                    </span>
                    <span className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                      {entry.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="border-t border-[var(--admin-border)] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] text-[18px] font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
            >
              {busy ? "Setting up builder..." : "Create & continue to builder"}
              {!busy ? <ArrowRight className="h-5 w-5" /> : null}
            </button>
            <p className="mt-3 text-center text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
              You can change these settings later in the builder.
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-center justify-center gap-2 text-[13px] text-[var(--admin-on-surface-variant)] opacity-80">
        <Lightbulb className="h-4 w-4" />
        Tip: Clear cover images help posts stand out in the learner feed.
      </p>
    </div>
  );
}
