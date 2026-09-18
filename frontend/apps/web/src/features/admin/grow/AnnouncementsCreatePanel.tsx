"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BatteryFull,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Info,
  Loader2,
  Megaphone,
  Send,
  Signal,
  Wifi,
  X,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { fetchBatches, type Batch } from "../domain/admin-domain-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { inlineExpandClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { managePageTitleClassName } from "../manage/manage-ui-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  ANNOUNCEMENT_IMAGE_MAX_HEIGHT,
  ANNOUNCEMENT_IMAGE_MAX_WIDTH,
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  ANNOUNCEMENTS_LIST_HREF,
  fileToJpegDataUrl,
  type AnnouncementDto,
} from "./announcements-shared";

type AudienceMode = "all" | "batch";

type FieldErrors = {
  title?: string;
  message?: string;
  deeplink?: string;
  image?: string;
  batch?: string;
};

type CreateResponse = { data: AnnouncementDto };

function clearFieldError(previous: FieldErrors, key: keyof FieldErrors): FieldErrors {
  if (!(key in previous)) return previous;
  const { [key]: _removed, ...next } = previous;
  return next;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    image.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${Math.round(bytes / 1024)}KB`;
}

function validateDeepLink(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Enter a URL starting with http:// or https://, or an internal path starting with /.";
    }
    return undefined;
  } catch {
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return undefined;
    return "Enter a URL starting with http:// or https://, or an internal path starting with /.";
  }
}

export function AnnouncementsCreatePanel() {
  const router = useRouter();
  const titleId = useId();
  const messageId = useId();
  const deeplinkId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    void fetchBatches()
      .then((response) => {
        setBatches(response.data.items);
      })
      .catch(() => {
        setBatches([]);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const batchOptions = useMemo(
    () =>
      batches.map((entry) => ({
        value: entry.id,
        label: entry.name,
      })),
    [batches],
  );

  const previewTitle = title.trim() || "Announcement title";
  const previewMessage =
    message.trim() || "Your announcement message will appear here for learners.";
  const previewCta = deeplink.trim() ? "Check it out" : "Got it";
  const selectedBatchName = batches.find((entry) => entry.id === batchId)?.name;

  async function validateImage(file: File): Promise<string | null> {
    const isJpeg =
      file.type === "image/jpeg" || file.type === "image/jpg" || /\.jpe?g$/i.test(file.name);
    if (!isJpeg) return "Image must be JPEG (.jpg or .jpeg).";
    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
      return `File too large (${formatBytes(file.size)}). Max ${formatBytes(ANNOUNCEMENT_IMAGE_MAX_BYTES)}.`;
    }
    try {
      const { width, height } = await readImageDimensions(file);
      if (width > ANNOUNCEMENT_IMAGE_MAX_WIDTH || height > ANNOUNCEMENT_IMAGE_MAX_HEIGHT) {
        return `Image must be ${ANNOUNCEMENT_IMAGE_MAX_WIDTH}×${ANNOUNCEMENT_IMAGE_MAX_HEIGHT}px or smaller (got ${width}×${height}).`;
      }
    } catch {
      return "Could not read the selected image.";
    }
    return null;
  }

  async function onPickImage(file: File | null) {
    if (!file) {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(null);
      setErrors((previous) => clearFieldError(previous, "image"));
      return;
    }
    const imageError = await validateImage(file);
    if (imageError) {
      setErrors((previous) => ({ ...previous, image: imageError }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.error(imageError);
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setErrors((previous) => clearFieldError(previous, "image"));
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) setDragActive(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (busy) return;
    const file = event.dataTransfer.files[0] ?? null;
    void onPickImage(file);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();

    if (!trimmedTitle) next.title = "Announcement title is required.";
    else if (trimmedTitle.length > ANNOUNCEMENT_TITLE_MAX) {
      next.title = `Title must be ${ANNOUNCEMENT_TITLE_MAX} characters or fewer.`;
    }

    if (!trimmedMessage) next.message = "Message is required.";
    else if (trimmedMessage.length > ANNOUNCEMENT_MESSAGE_MAX) {
      next.message = `Message must be ${ANNOUNCEMENT_MESSAGE_MAX} characters or fewer.`;
    }

    const linkError = validateDeepLink(deeplink);
    if (linkError) next.deeplink = linkError;

    if (audienceMode === "batch" && !batchId) {
      next.batch = "Select a batch for this announcement.";
    }

    if (errors.image) next.image = errors.image;

    return next;
  }

  async function buildPayload() {
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await fileToJpegDataUrl(imageFile);
    }
    return {
      title: title.trim(),
      message: message.trim(),
      deepLink: deeplink.trim() || null,
      imageUrl,
      batchId: audienceMode === "batch" ? batchId || null : null,
    };
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }

    setBusy(true);
    try {
      await clientApi.post<CreateResponse>(
        "/api/v1/marketing/announcements",
        await buildPayload(),
        "announcement-create-send",
        { successMessage: "Announcement sent." },
      );
      router.push(ANNOUNCEMENTS_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not send announcement. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSendTest() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Fix the highlighted fields before sending a test.");
      return;
    }

    setTestBusy(true);
    try {
      await clientApi.post(
        "/api/v1/marketing/announcements/test",
        await buildPayload(),
        "announcement-test-self",
        { silent: true },
      );
      toast.success("Test announcement sent to your in-app inbox.");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not send test announcement.",
      );
    } finally {
      setTestBusy(false);
    }
  }

  const locked = busy || testBusy;
  const imageZoneError = Boolean(errors.image);

  return (
    <div className="relative space-y-6 pb-8">
      <div
        className="pointer-events-none absolute -right-10 top-10 h-56 w-56 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] opacity-40 blur-[90px] motion-reduce:hidden"
        aria-hidden="true"
      />

      <Link
        href={ANNOUNCEMENTS_LIST_HREF}
        prefetch={false}
        className={generalSettingsBackLinkClassName}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Announcements
      </Link>

      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--admin-on-surface-variant)]"
      >
        <Link
          href={ANNOUNCEMENTS_LIST_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Announcements
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-on-surface)]">New</span>
      </nav>

      <form id="create-announcement-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          {/* Form column */}
          <div className="min-w-0 flex-1 space-y-6">
            <header>
              <h1 className={managePageTitleClassName}>Create Announcement</h1>
            </header>

            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <label htmlFor={titleId} className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Announcement title
                  </label>
                  <span
                    className={[
                      "text-[11px] font-medium tabular-nums",
                      title.length >= ANNOUNCEMENT_TITLE_MAX
                        ? "text-[var(--admin-danger)]"
                        : "text-[var(--admin-on-surface-variant)]",
                    ].join(" ")}
                  >
                    {title.length}/{ANNOUNCEMENT_TITLE_MAX}
                  </span>
                </div>
                <input
                  id={titleId}
                  type="text"
                  value={title}
                  maxLength={ANNOUNCEMENT_TITLE_MAX}
                  disabled={locked}
                  placeholder="e.g. New portfolio feature now live"
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? `${titleId}-error` : undefined}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    if (errors.title) setErrors((previous) => clearFieldError(previous, "title"));
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-12`}
                />
                {errors.title ? (
                  <p
                    id={`${titleId}-error`}
                    className="mt-1.5 text-[11px] font-semibold text-[var(--admin-danger)]"
                  >
                    {errors.title}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <label htmlFor={messageId} className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Message
                  </label>
                  <span
                    className={[
                      "text-[11px] font-medium tabular-nums",
                      message.length >= ANNOUNCEMENT_MESSAGE_MAX
                        ? "text-[var(--admin-danger)]"
                        : "text-[var(--admin-on-surface-variant)]",
                    ].join(" ")}
                  >
                    {message.length}/{ANNOUNCEMENT_MESSAGE_MAX}
                  </span>
                </div>
                <textarea
                  id={messageId}
                  value={message}
                  maxLength={ANNOUNCEMENT_MESSAGE_MAX}
                  disabled={locked}
                  rows={4}
                  placeholder="Write your announcement details here…"
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? `${messageId}-error` : undefined}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (errors.message) {
                      setErrors((previous) => clearFieldError(previous, "message"));
                    }
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[7rem] resize-none`}
                />
                {errors.message ? (
                  <p
                    id={`${messageId}-error`}
                    className="mt-1.5 text-[11px] font-semibold text-[var(--admin-danger)]"
                  >
                    {errors.message}
                  </p>
                ) : null}
              </div>

              <div>
                <p className={MESSENGER_WIZARD_LABEL_CLASS}>Image banner</p>
                <div
                  className={[
                    "relative rounded-xl border-2 border-dashed p-4 transition-colors",
                    imageZoneError
                      ? "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))]"
                      : dragActive
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface-low))]",
                  ].join(" ")}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                >
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Announcement banner preview"
                        className="max-h-36 w-full rounded-lg object-contain"
                      />
                      <p className="truncate text-[13px] text-[var(--admin-on-surface)]">
                        {imageFile?.name}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => void onPickImage(null)}
                          className="rounded-lg px-4 py-2 text-[12px] font-bold text-[var(--admin-danger)] transition-colors hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-2 py-6 text-center disabled:opacity-50"
                    >
                      <CloudUpload
                        className={[
                          "h-7 w-7",
                          imageZoneError
                            ? "text-[var(--admin-danger)]"
                            : "text-[var(--admin-primary)]",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                      <p
                        className={[
                          "text-[12px] font-bold",
                          imageZoneError
                            ? "text-[var(--admin-danger)]"
                            : "text-[var(--admin-on-surface)]",
                        ].join(" ")}
                      >
                        Drop your image here or <span className="underline">browse</span>
                      </p>
                      <p
                        className={[
                          "text-[10px]",
                          imageZoneError
                            ? "text-[var(--admin-danger)]"
                            : "text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        JPEG only, max {formatBytes(ANNOUNCEMENT_IMAGE_MAX_BYTES)},{" "}
                        {ANNOUNCEMENT_IMAGE_MAX_WIDTH}×{ANNOUNCEMENT_IMAGE_MAX_HEIGHT}px
                      </p>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,.jpg,.jpeg"
                    className="sr-only"
                    disabled={locked}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      void onPickImage(file);
                    }}
                  />
                </div>
                {errors.image ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-danger)]">
                    <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {errors.image}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor={deeplinkId} className={MESSENGER_WIZARD_LABEL_CLASS}>
                  Deep link URL
                </label>
                <input
                  id={deeplinkId}
                  type="text"
                  value={deeplink}
                  disabled={locked}
                  placeholder="https://… or /courses/…"
                  aria-invalid={Boolean(errors.deeplink)}
                  aria-describedby={`${deeplinkId}-hint${errors.deeplink ? ` ${deeplinkId}-error` : ""}`}
                  onChange={(event) => {
                    setDeeplink(event.target.value);
                    if (errors.deeplink) {
                      setErrors((previous) => clearFieldError(previous, "deeplink"));
                    }
                  }}
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-12`}
                />
                {errors.deeplink ? (
                  <p
                    id={`${deeplinkId}-error`}
                    className="mt-1.5 text-[11px] font-semibold text-[var(--admin-danger)]"
                  >
                    {errors.deeplink}
                  </p>
                ) : (
                  <p
                    id={`${deeplinkId}-hint`}
                    className="mt-1.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)]"
                  >
                    Optional. Use http(s) or an internal path starting with /.
                  </p>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <p className="block text-[12px] font-bold tracking-[0.02em] text-[var(--admin-on-surface)]">
                  Target audience
                </p>
                <div
                  className="flex flex-wrap gap-6"
                  role="radiogroup"
                  aria-label="Target audience"
                >
                  <label className="group inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="announcement-audience"
                      checked={audienceMode === "all"}
                      disabled={locked}
                      onChange={() => {
                        setAudienceMode("all");
                        setBatchId("");
                        setErrors((previous) => clearFieldError(previous, "batch"));
                      }}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                      All learners
                    </span>
                  </label>
                  <label className="group inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="announcement-audience"
                      checked={audienceMode === "batch"}
                      disabled={locked}
                      onChange={() => {
                        setAudienceMode("batch");
                      }}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                    />
                    <span className="text-sm text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                      Specific batch
                    </span>
                  </label>
                </div>

                {audienceMode === "batch" ? (
                  <div className={inlineExpandClassName}>
                    <AdminSelectDropdown
                      id="announcement-batch"
                      label={null}
                      ariaLabel="Select a batch"
                      value={batchId}
                      disabled={locked || batches.length === 0}
                      options={
                        batchOptions.length > 0
                          ? batchOptions
                          : [{ value: "", label: "No batches available" }]
                      }
                      onChange={(value) => {
                        setBatchId(value);
                        setErrors((previous) => clearFieldError(previous, "batch"));
                      }}
                    />
                    {errors.batch ? (
                      <p className="mt-1.5 text-[11px] font-semibold text-[var(--admin-danger)]">
                        {errors.batch}
                      </p>
                    ) : batches.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                        Create a batch first to target a specific group.
                      </p>
                    ) : selectedBatchName ? (
                      <p className="mt-1.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                        Sending to {selectedBatchName}.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Live preview */}
          <aside className="w-full shrink-0 xl:sticky xl:top-6 xl:w-[380px]">
            <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)] xl:min-h-[640px]">
              <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
                <h2 className="text-[12px] font-bold tracking-[0.02em] text-[var(--admin-on-surface)]">
                  In-app preview
                </h2>
                <div className="flex gap-1" aria-hidden="true">
                  <span className="h-2 w-2 rounded-full bg-[var(--admin-outline)]" />
                  <span className="h-2 w-2 rounded-full bg-[var(--admin-outline)]" />
                  <span className="h-2 w-2 rounded-full bg-[var(--admin-outline)]" />
                </div>
              </div>

              <div className="flex flex-1 items-center justify-center bg-[var(--admin-surface-low)] p-6">
                <div className="relative flex h-[520px] w-full max-w-[300px] flex-col overflow-hidden rounded-[2.5rem] border-[8px] border-[var(--admin-on-surface-variant)] bg-[var(--admin-surface)] shadow-2xl">
                  <div className="flex h-7 items-center justify-between px-5 pt-2">
                    <span className="text-[10px] font-bold text-[var(--admin-on-surface)]">
                      9:41
                    </span>
                    <div className="flex items-center gap-1 text-[var(--admin-on-surface)]">
                      <Signal className="h-2.5 w-2.5" aria-hidden="true" />
                      <Wifi className="h-2.5 w-2.5" aria-hidden="true" />
                      <BatteryFull className="h-2.5 w-2.5" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="pointer-events-none space-y-4 opacity-20" aria-hidden="true">
                      <div className="h-4 w-1/2 rounded-full bg-[var(--admin-on-surface-variant)]" />
                      <div className="h-24 w-full rounded-xl bg-[var(--admin-on-surface-variant)]" />
                      <div className="space-y-2">
                        <div className="h-3 w-full rounded-full bg-[var(--admin-on-surface-variant)]" />
                        <div className="h-3 w-full rounded-full bg-[var(--admin-on-surface-variant)]" />
                        <div className="h-3 w-2/3 rounded-full bg-[var(--admin-on-surface-variant)]" />
                      </div>
                    </div>

                    <div className="relative mt-8 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[var(--admin-surface)] shadow-xl motion-safe:animate-[admin-dropdown-in_0.35s_cubic-bezier(0.16,1,0.3,1)]">
                      <div className="relative h-28 w-full overflow-hidden bg-[var(--admin-surface-high)]">
                        {imagePreview ? (
                          <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[var(--admin-on-surface-variant)]">
                            <Megaphone className="h-8 w-8" aria-hidden="true" />
                          </div>
                        )}
                        <span
                          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] text-[var(--admin-on-surface)]"
                          aria-hidden="true"
                        >
                          <X className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="space-y-2 p-4">
                        <h3 className="text-[15px] font-bold leading-tight text-[var(--admin-on-surface)]">
                          {previewTitle}
                        </h3>
                        <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                          {previewMessage}
                        </p>
                        <div className="pt-2">
                          <span className="flex w-full items-center justify-center rounded-lg bg-[var(--admin-primary)] py-2 text-[13px] font-bold text-[var(--admin-on-primary)]">
                            {previewCta}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mx-auto mb-2 h-1.5 w-24 rounded-full bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_20%,transparent)]"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-center">
                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                  Live preview of the in-app announcement card
                </p>
              </div>
            </div>
          </aside>
        </div>
      </form>

      <footer className="flex flex-col gap-4 border-t border-[var(--admin-border)] pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={locked}
            onClick={() => void onSendTest()}
            className="text-[12px] font-bold text-[var(--admin-primary-strong)] transition-colors hover:underline disabled:opacity-50 sm:mr-auto"
          >
            {testBusy ? "Sending test…" : "Send test to myself"}
          </button>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                router.push(ANNOUNCEMENTS_LIST_HREF);
              }}
              className="rounded-xl border border-[var(--admin-border)] px-6 py-2.5 text-[12px] font-bold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-announcement-form"
              disabled={locked}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-8 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] shadow-[0_8px_20px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-colors hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Create & send
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2 text-[var(--admin-on-surface-variant)] sm:justify-end">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed sm:max-w-xl sm:text-right">
            {audienceMode === "batch"
              ? "This will be sent immediately to the selected batch - there is no schedule or draft option."
              : "This will be sent immediately to all learners - there is no schedule or draft option."}
          </p>
        </div>
      </footer>
    </div>
  );
}
