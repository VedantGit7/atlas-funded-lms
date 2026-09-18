"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BatteryFull,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Filter,
  Globe,
  Info,
  Layers,
  Laptop,
  Loader2,
  Phone,
  Rocket,
  Signal,
  Smartphone,
  Users,
  Wifi,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { fetchBatches, type Batch } from "../domain/admin-domain-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  manageDangerButtonClassName,
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  formatCompactCount,
  formatPushDateTime,
  PUSH_LIST_HREF,
  pushMessageHref,
  recipientInitials,
  resolveWizardStep,
  type PushAudienceEstimate,
  type PushMessageDto,
  type PushRecipient,
  type WizardStep,
} from "./push-message-shared";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import {
  MESSENGER_WIZARD_FIELD_CLASS,
  MESSENGER_WIZARD_LABEL_CLASS,
  PUSH_WIZARD_STEPS,
  MessengerWizardCard,
  MessengerWizardFooter,
  MessengerWizardStepper,
} from "./push-wizard-chrome";
import { cancellationFlag } from "@/lib/effect-cancellation";

type MessageResponse = { data: PushMessageDto };
type RecipientsResponse = { data: { totalCount: number; items: PushRecipient[] } };
type EstimateResponse = { data: PushAudienceEstimate };
type MeResponse = {
  data: {
    identity: { email: string | null };
    profile: { displayName: string | null } | null;
  };
};

type PreviewDevice = "ios" | "android" | "web";
type DeliveryMode = "now" | "schedule";

const META_LABEL_CLASS =
  "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

type PushMessageWizardPanelProps = {
  messageId?: string;
  /** Tenant public name for notification preview chrome. */
  appLabel?: string;
};

export function PushMessageWizardPanel({
  messageId,
  appLabel = "Academy",
}: PushMessageWizardPanelProps) {
  const router = useRouter();
  const [message, setMessage] = useState<PushMessageDto | null>(null);
  const [step, setStep] = useState<WizardStep>(messageId ? "audience" : "title");
  const [loading, setLoading] = useState(Boolean(messageId));
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [audienceType, setAudienceType] = useState<"ALL" | "GROUP">("ALL");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipients, setRecipients] = useState<PushRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [allLearnersEstimate, setAllLearnersEstimate] = useState<number | null>(null);
  const [groupEstimate, setGroupEstimate] = useState<number | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [actorLabel, setActorLabel] = useState<string | null>(null);
  const [actorInitials, setActorInitials] = useState("AD");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [channelAndroid, setChannelAndroid] = useState(true);
  const [channelIos, setChannelIos] = useState(true);
  const [channelWeb, setChannelWeb] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("ios");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");

  const [scheduleLocal, setScheduleLocal] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");

  const hydrateFromMessage = useCallback(
    (next: PushMessageDto, options?: { keepStep?: boolean }) => {
      setMessage(next);
      setTitle(next.title);
      setSettingsTitle(next.title);
      if (next.audienceType) setAudienceType(next.audienceType);
      if (next.audienceBatchId) setBatchId(next.audienceBatchId);
      setSubject(next.subject ?? "");
      setBody(next.body ?? "");
      setDeepLink(next.deepLink ?? "");
      setImageUrl(next.imageUrl ?? "");
      setChannelAndroid(next.channels.android);
      setChannelIos(next.channels.ios);
      setChannelWeb(next.channels.web);
      if (next.scheduledAt) {
        const date = new Date(next.scheduledAt);
        if (!Number.isNaN(date.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          setScheduleLocal(
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
          );
          setDeliveryMode("schedule");
        }
      }
      if (!options?.keepStep) {
        setStep(resolveWizardStep(next));
      }
    },
    [],
  );

  useEffect(() => {
    if (!messageId) return;
    const effect = cancellationFlag();
    setLoading(true);
    void (async () => {
      try {
        const response = await clientApi.get<MessageResponse>(
          `/api/v1/marketing/push-messages/${messageId}`,
        );
        if (effect.isCancelled()) return;
        hydrateFromMessage(response.data);
      } catch (caught) {
        if (!effect.isCancelled()) {
          toast.error(
            caught instanceof ClientApiError ? caught.message : "Could not load push message.",
          );
          router.replace(PUSH_LIST_HREF);
        }
      } finally {
        if (!effect.isCancelled()) setLoading(false);
      }
    })();
    return () => {
      effect.cancel();
    };
  }, [messageId, hydrateFromMessage, router]);

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
    const effect = cancellationFlag();
    void clientApi
      .get<MeResponse>("/api/v1/me")
      .then((me) => {
        if (effect.isCancelled()) return;
        const name = me.data.profile?.displayName?.trim() || me.data.identity.email || "Admin";
        setActorLabel(name);
        setActorInitials(
          recipientInitials(me.data.profile?.displayName ?? null, me.data.identity.email),
        );
      })
      .catch(() => {
        if (!effect.isCancelled()) {
          setActorLabel(null);
          setActorInitials("AD");
        }
      });
    return () => {
      effect.cancel();
    };
  }, []);

  useEffect(() => {
    if (step !== "audience") return;
    const effect = cancellationFlag();
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>(`/api/v1/marketing/push-messages-audience-estimate?audienceType=ALL`)
      .then((response) => {
        if (!effect.isCancelled()) setAllLearnersEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!effect.isCancelled()) setAllLearnersEstimate(null);
      })
      .finally(() => {
        if (!effect.isCancelled()) setEstimateBusy(false);
      });
    return () => {
      effect.cancel();
    };
  }, [step]);

  useEffect(() => {
    if (step !== "audience" || audienceType !== "GROUP" || !batchId) {
      setGroupEstimate(null);
      return;
    }
    const effect = cancellationFlag();
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>(
        `/api/v1/marketing/push-messages-audience-estimate?audienceType=GROUP&audienceBatchId=${encodeURIComponent(batchId)}`,
      )
      .then((response) => {
        if (!effect.isCancelled()) setGroupEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!effect.isCancelled()) setGroupEstimate(null);
      })
      .finally(() => {
        if (!effect.isCancelled()) setEstimateBusy(false);
      });
    return () => {
      effect.cancel();
    };
  }, [step, audienceType, batchId]);

  const progressSteps = useMemo(() => {
    if (step === "settings") return [];
    return PUSH_WIZARD_STEPS;
  }, [step]);

  async function loadRecipients(id: string) {
    const response = await clientApi.get<RecipientsResponse>(
      `/api/v1/marketing/push-messages/${id}/recipients`,
    );
    setRecipients(response.data.items);
    setRecipientTotal(response.data.totalCount);
  }

  async function saveTitleAndNext() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a title for this push message.");
      return;
    }
    setBusy(true);
    try {
      if (!message) {
        const response = await clientApi.post<MessageResponse>(
          "/api/v1/marketing/push-messages",
          { title: trimmed },
          "push-message-create",
          { silent: true },
        );
        toast.success("Draft created.");
        router.replace(pushMessageHref(response.data.id));
        return;
      }
      const response = await clientApi.patch<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}`,
        { title: trimmed },
        `push-message-title-${message.id}`,
        { silent: true },
      );
      hydrateFromMessage(response.data);
      setStep(response.data.audienceType ? "recipients" : "audience");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save title.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTitleDraftOnly() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a title for this push message.");
      return;
    }
    setBusy(true);
    try {
      if (!message) {
        const response = await clientApi.post<MessageResponse>(
          "/api/v1/marketing/push-messages",
          { title: trimmed },
          "push-message-create-draft",
          { silent: true },
        );
        toast.success("Draft saved.");
        router.replace(pushMessageHref(response.data.id));
        return;
      }
      await clientApi.patch<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}`,
        { title: trimmed },
        `push-message-title-draft-${message.id}`,
        { silent: true },
      );
      toast.success("Draft saved.");
      router.push(PUSH_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAudienceAndNext() {
    if (!message) return;
    if (audienceType === "GROUP" && !batchId) {
      toast.error("Select a group (batch) for recipients.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}/audience`,
        {
          audienceType,
          ...(audienceType === "GROUP" ? { audienceBatchId: batchId } : {}),
        },
        `push-message-audience-${message.id}`,
        { silent: true },
      );
      hydrateFromMessage(response.data);
      await loadRecipients(response.data.id);
      setStep("recipients");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save recipients.");
    } finally {
      setBusy(false);
    }
  }

  async function goToCompose() {
    if (!message) return;
    setBusy(true);
    try {
      if (recipients.length === 0 && recipientTotal === 0) {
        await loadRecipients(message.id);
      }
      setStep("compose");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load recipients.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCompose(nextStep: WizardStep | null) {
    if (!message) return;
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message body are required.");
      return;
    }
    if (!channelAndroid && !channelIos && !channelWeb) {
      toast.error("Select at least one delivery channel.");
      return;
    }
    const trimmedImage = imageUrl.trim();
    if (trimmedImage) {
      try {
        new URL(trimmedImage);
      } catch {
        toast.error("Image URL must be a valid absolute URL.");
        return;
      }
    }

    setBusy(true);
    try {
      const response = await clientApi.post<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}/compose`,
        {
          subject: subject.trim(),
          body: body.trim(),
          deepLink: deepLink.trim() || null,
          imageUrl: trimmedImage || null,
          channels: {
            android: channelAndroid,
            ios: channelIos,
            web: channelWeb,
          },
        },
        `push-message-compose-${message.id}`,
        { silent: true },
      );
      hydrateFromMessage(response.data, { keepStep: Boolean(nextStep) });
      if (nextStep) {
        setStep(nextStep);
      } else {
        toast.success("Draft saved.");
        router.push(PUSH_LIST_HREF);
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save message.");
    } finally {
      setBusy(false);
    }
  }

  async function composeThenSend(mode: "now" | "schedule") {
    if (!message) return;
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message body are required.");
      return;
    }
    if (!channelAndroid && !channelIos && !channelWeb) {
      toast.error("Select at least one delivery channel.");
      return;
    }
    if (mode === "schedule" && !scheduleLocal) {
      toast.error("Pick a schedule date and time.");
      return;
    }

    const trimmedImage = imageUrl.trim();
    if (trimmedImage) {
      try {
        new URL(trimmedImage);
      } catch {
        toast.error("Image URL must be a valid absolute URL.");
        return;
      }
    }

    setBusy(true);
    try {
      await clientApi.post<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}/compose`,
        {
          subject: subject.trim(),
          body: body.trim(),
          deepLink: deepLink.trim() || null,
          imageUrl: trimmedImage || null,
          channels: {
            android: channelAndroid,
            ios: channelIos,
            web: channelWeb,
          },
        },
        `push-message-compose-${message.id}`,
        { silent: true },
      );

      const bodyPayload =
        mode === "now"
          ? { mode: "now" as const }
          : {
              mode: "schedule" as const,
              scheduledAt: new Date(scheduleLocal).toISOString(),
            };

      const response = await clientApi.post<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}/send`,
        bodyPayload,
        `push-message-send-${message.id}`,
        { silent: true },
      );
      toast.success(
        mode === "now"
          ? `Sent to ${response.data.recipientCount} learner(s) (in-app).`
          : `Scheduled for ${formatPushDateTime(response.data.scheduledAt)}.`,
      );
      router.push(PUSH_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not send message.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettingsTitle() {
    if (!message) return;
    const trimmed = settingsTitle.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.patch<MessageResponse>(
        `/api/v1/marketing/push-messages/${message.id}`,
        { title: trimmed },
        `push-message-title-${message.id}`,
      );
      hydrateFromMessage(response.data, { keepStep: true });
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update title.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage() {
    if (!message) return;
    if (deleteConfirm !== message.title) {
      toast.error("Type the exact title to confirm deletion.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/push-messages/${message.id}/delete`,
        { titleConfirmation: deleteConfirm },
        `push-message-delete-${message.id}`,
      );
      router.push(PUSH_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete message.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!message?.audienceType || (step !== "recipients" && step !== "compose")) return;
    if (recipients.length > 0 || recipientTotal > 0) return;
    void loadRecipients(message.id).catch(() => {
      /* toast on explicit actions */
    });
  }, [message, step, recipients.length, recipientTotal]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === batchId) ?? null,
    [batches, batchId],
  );

  const batchOptions = useMemo(
    () => batches.map((batch) => ({ value: batch.id, label: batch.name })),
    [batches],
  );

  const previewTitle = subject.trim() || "Your campaign title";
  const previewBody =
    body.trim() || "Your push message body will appear here as you type in the editor.";
  const previewAppLabel = appLabel.trim() || "Academy";

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href={PUSH_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to campaign list
        </Link>
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
          <div className="h-20 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
          <div className="h-64 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 bottom-0 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] opacity-50 blur-[90px] motion-reduce:hidden"
        aria-hidden="true"
      />

      <Link href={PUSH_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to campaign list
      </Link>

      <header className="space-y-2">
        <h1 className={managePageTitleClassName}>
          {message ? message.title : "Create push campaign"}
        </h1>
        <p className={`${managePageDescClassName} max-w-2xl`}>
          {step === "settings"
            ? "Edit message settings or delete this push message."
            : "Name the campaign, lock an audience, compose the notification, then send or schedule. Delivery today is in-app."}
        </p>
        {message?.status === "SENT" || message?.status === "SCHEDULED" ? (
          <button
            type="button"
            className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
            onClick={() => {
              setStep("settings");
            }}
          >
            Open settings
          </button>
        ) : null}
      </header>

      {progressSteps.length > 0 ? (
        <MessengerWizardStepper steps={progressSteps} current={step} />
      ) : null}

      {step === "title" ? (
        <div className="flex justify-center pt-2">
          <MessengerWizardCard className="w-full max-w-2xl">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-5">
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                Campaign identity
              </h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Start with a clear internal name so your team can find this draft later.
              </p>
            </div>
            <div className="space-y-6 px-6 py-6">
              <label className="block">
                <span className={MESSENGER_WIZARD_LABEL_CLASS}>Internal campaign name</span>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="e.g. Q3 reactivation - North America"
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                />
              </label>
              <div className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  This name is for internal reference and will not be visible to learners.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 border-t border-[var(--admin-border)] pt-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className={META_LABEL_CLASS}>Campaign type</span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-on-surface)]">
                    <Bell className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    Push message
                  </div>
                </div>
                <div className="space-y-1">
                  <span className={META_LABEL_CLASS}>Created by</span>
                  <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] text-[10px] font-bold text-[var(--admin-primary)]">
                      {actorInitials}
                    </span>
                    {actorLabel ?? "You"}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-4">
              <button
                type="button"
                disabled={busy}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  void saveTitleDraftOnly();
                }}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy}
                className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                onClick={() => {
                  void saveTitleAndNext();
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save & next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </MessengerWizardCard>
        </div>
      ) : null}

      {step === "audience" && message ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(message.audienceType)}
              onClick={() => {
                setAudienceType("ALL");
              }}
              className={[
                "flex flex-col rounded-xl border-2 p-7 text-left transition-[border-color,background-color,box-shadow] disabled:cursor-not-allowed",
                audienceType === "ALL"
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-border))]",
              ].join(" ")}
            >
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)] transition-transform group-hover:scale-105">
                <Globe className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">All learners</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Broadcast to every active learner. Best for critical updates and platform-wide
                announcements.
              </p>
              <div className="mt-8 flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em]">
                  {estimateBusy && audienceType === "ALL"
                    ? "Estimating reach..."
                    : allLearnersEstimate != null
                      ? `Estimated reach: ${formatCompactCount(allLearnersEstimate)} users`
                      : "Estimated reach: active learners"}
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={Boolean(message.audienceType)}
              onClick={() => {
                setAudienceType("GROUP");
              }}
              className={[
                "flex flex-col rounded-xl border-2 p-7 text-left transition-[border-color,background-color,box-shadow] disabled:cursor-not-allowed",
                audienceType === "GROUP"
                  ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--admin-primary)_12%,transparent)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-border))]",
              ].join(" ")}
            >
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]">
                <Filter className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">Specific groups</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Target a single batch or cohort. Precision targeting for higher relevance.
              </p>
              <div className="mt-8 flex items-center gap-2 text-[var(--admin-on-surface-variant)]">
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em]">
                  Batch / group selection
                </span>
              </div>
            </button>
          </div>

          {audienceType === "GROUP" ? (
            <MessengerWizardCard>
              <div className="space-y-3 px-6 py-5">
                <AdminSelectDropdown
                  id="push-audience-batch"
                  label="Group (batch)"
                  ariaLabel="Group (batch)"
                  value={batchId}
                  disabled={Boolean(message.audienceType)}
                  options={batchOptions}
                  onChange={setBatchId}
                />
                {batchId ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    {estimateBusy
                      ? "Estimating group reach..."
                      : groupEstimate != null
                        ? `Estimated reach: ${formatCompactCount(groupEstimate)} active learners in ${selectedBatch?.name ?? "this group"}.`
                        : "Select a batch to estimate reach."}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    Choose a batch to estimate reach before locking the audience.
                  </p>
                )}
              </div>
            </MessengerWizardCard>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] p-4 text-[var(--admin-warning)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm leading-relaxed">
              Audience selection locks permanently once saved. Confirm targeting before continuing
              to content.
            </p>
          </div>

          <MessengerWizardFooter
            left={
              <button
                type="button"
                disabled={busy}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  setStep("title");
                }}
              >
                Back
              </button>
            }
            right={
              message.audienceType ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await loadRecipients(message.id);
                        setStep("recipients");
                      } catch (caught) {
                        toast.error(
                          caught instanceof ClientApiError
                            ? caught.message
                            : "Could not load recipients.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Continue to preview
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                  onClick={() => {
                    void saveAudienceAndNext();
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Save & next
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )
            }
          />
        </div>
      ) : null}

      {step === "recipients" && message ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] text-[var(--admin-primary)]">
                <Users className="h-8 w-8" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
                  Target audience
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-[var(--admin-primary)]">
                  {formatCompactCount(recipientTotal || message.recipientCount)}
                </p>
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                  Total estimated recipients
                </p>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold text-[var(--admin-success)]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Audience locked
              </span>
              <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                Segment:{" "}
                <span className="font-bold text-[var(--admin-on-surface)]">
                  {message.audienceLabel ?? "Audience"}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <MessengerWizardCard className="lg:col-span-8">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
                <div>
                  <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Recipient preview
                  </h3>
                  <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                    Showing first {recipients.length || 0}
                    {recipientTotal > recipients.length ? ` of ${recipientTotal}` : ""} matching
                    records
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                        Name
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {recipients.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-5 py-8 text-center text-[var(--admin-on-surface-variant)]"
                        >
                          No active learners in this audience.
                        </td>
                      </tr>
                    ) : (
                      recipients.map((row) => (
                        <tr
                          key={row.membershipId}
                          className="transition-colors hover:bg-[var(--admin-surface-high)]"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[10px] font-bold text-[var(--admin-primary)]">
                                {recipientInitials(row.displayName, row.email)}
                              </span>
                              <span className="font-semibold text-[var(--admin-on-surface)]">
                                {row.displayName ?? "Unnamed learner"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-[var(--admin-on-surface-variant)]">
                            {row.email ?? "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </MessengerWizardCard>

            <div className="space-y-4 lg:col-span-4">
              <MessengerWizardCard>
                <div className="space-y-3 px-5 py-5">
                  <h3 className="text-base font-bold text-[var(--admin-on-surface)]">
                    Delivery notes
                  </h3>
                  <ul className="space-y-3 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                    <li className="rounded-lg border border-[var(--admin-border)] p-3">
                      <p className="font-semibold text-[var(--admin-on-surface)]">In-app inbox</p>
                      <p className="mt-1">
                        Messages deliver to learner notifications today. Native push adapters can be
                        enabled later without changing this audience.
                      </p>
                    </li>
                    <li className="rounded-lg border border-[var(--admin-border)] p-3">
                      <p className="font-semibold text-[var(--admin-on-surface)]">Active only</p>
                      <p className="mt-1">
                        Archived and inactive memberships are excluded from the recipient count
                        automatically.
                      </p>
                    </li>
                  </ul>
                </div>
              </MessengerWizardCard>
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-5">
                <div className="mb-2 flex items-center gap-2 text-[var(--admin-primary)]">
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Tip</span>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Smaller, relevant cohorts usually outperform broad blasts. Prefer a batch when the
                  message is role or course specific.
                </p>
              </div>
            </div>
          </div>

          <MessengerWizardFooter
            left={
              <button
                type="button"
                disabled={busy}
                className={`${manageSecondaryButtonClassName} inline-flex items-center gap-2`}
                onClick={() => {
                  setStep("audience");
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
            }
            right={
              <button
                type="button"
                disabled={busy}
                className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                onClick={() => {
                  void goToCompose();
                }}
              >
                Compose message
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      ) : null}

      {step === "compose" && message ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <MessengerWizardCard>
              <div className="space-y-5 px-6 py-6">
                <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                  Message details
                </h3>
                <label className="block">
                  <span className={MESSENGER_WIZARD_LABEL_CLASS}>Notification subject / title</span>
                  <input
                    type="text"
                    value={subject}
                    maxLength={200}
                    onChange={(event) => {
                      setSubject(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    placeholder="New funding available!"
                  />
                </label>
                <label className="block">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS + " mb-0"}>Message body</span>
                    <span className="text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                      {body.length} / 4000
                    </span>
                  </div>
                  <textarea
                    value={body}
                    maxLength={4000}
                    rows={5}
                    onChange={(event) => {
                      setBody(event.target.value);
                    }}
                    className={MESSENGER_WIZARD_FIELD_CLASS}
                    placeholder="A new round has been opened for your sector. Explore now."
                  />
                </label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Deep link (optional)</span>
                    <input
                      type="text"
                      value={deepLink}
                      maxLength={1000}
                      onChange={(event) => {
                        setDeepLink(event.target.value);
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                      placeholder="/courses or absolute URL"
                    />
                  </label>
                  <label className="block">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Image URL (optional)</span>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(event) => {
                        setImageUrl(event.target.value);
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                      placeholder="https://cdn.example.com/promo.jpg"
                    />
                    <span className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--admin-warning)]">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      Rich media has limited support on some platforms; delivery today is in-app.
                    </span>
                  </label>
                </div>
                <fieldset>
                  <legend className={MESSENGER_WIZARD_LABEL_CLASS}>Target channels</legend>
                  <div className="flex flex-wrap gap-5">
                    {(
                      [
                        ["android", channelAndroid, setChannelAndroid, "Android push"],
                        ["ios", channelIos, setChannelIos, "iOS push"],
                        ["web", channelWeb, setChannelWeb, "Web browser"],
                      ] as const
                    ).map(([key, checked, setter, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 text-sm text-[var(--admin-on-surface)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setter(event.target.checked);
                          }}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </MessengerWizardCard>

            <MessengerWizardFooter
              left={
                <button
                  type="button"
                  disabled={busy}
                  className={`${manageSecondaryButtonClassName} inline-flex items-center gap-2`}
                  onClick={() => {
                    setStep("recipients");
                  }}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              }
              right={
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className={manageSecondaryButtonClassName}
                    onClick={() => {
                      void saveCompose(null);
                    }}
                  >
                    Save as draft
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                    onClick={() => {
                      void saveCompose("delivery");
                    }}
                  >
                    Save & next: Delivery
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </>
              }
            />
          </div>

          <aside className="lg:col-span-5">
            <div className="sticky top-24 flex flex-col items-center">
              <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
                Live{" "}
                {previewDevice === "ios" ? "iOS" : previewDevice === "android" ? "Android" : "Web"}{" "}
                preview
              </p>
              <div className="relative h-[560px] w-[280px] overflow-hidden rounded-[42px] border-[7px] border-[color-mix(in_srgb,var(--admin-on-surface)_88%,transparent)] bg-[var(--admin-on-surface)] p-2.5 shadow-2xl">
                <div
                  className="relative h-full w-full overflow-hidden rounded-[32px]"
                  style={{
                    background:
                      "linear-gradient(160deg, color-mix(in srgb, var(--admin-primary) 42%, var(--admin-on-surface)) 0%, color-mix(in srgb, var(--admin-primary) 18%, var(--admin-surface-low)) 48%, var(--admin-on-surface) 100%)",
                  }}
                >
                  <div className="flex items-center justify-between px-6 pt-6 text-[var(--admin-on-primary)]">
                    <span className="text-[11px] font-bold">9:41</span>
                    <div className="flex items-center gap-1 opacity-90">
                      <Signal className="h-3.5 w-3.5" aria-hidden="true" />
                      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                      <BatteryFull className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="mt-8 text-center text-[var(--admin-on-primary)]">
                    <p className="text-5xl font-thin leading-none">09:41</p>
                    <p className="mt-1 text-sm opacity-90">Lock screen</p>
                  </div>
                  <div className="mt-16 px-3">
                    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-outline)_45%,transparent)] bg-[color-mix(in_srgb,var(--admin-surface)_88%,transparent)] p-3.5 text-[var(--admin-on-surface)] shadow-lg backdrop-blur-md transition-transform motion-safe:duration-200">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--admin-primary)] text-[var(--admin-on-primary)]">
                          <Bell className="h-3 w-3" aria-hidden="true" />
                        </span>
                        <span className="truncate text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                          {previewAppLabel}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-[var(--admin-on-surface-variant)]">
                          now
                        </span>
                      </div>
                      <p className="text-[13px] font-bold leading-tight text-[var(--admin-on-surface)]">
                        {previewTitle}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-[var(--admin-on-surface-variant)]">
                        {previewBody}
                      </p>
                      {imageUrl.trim() ? (
                        <img
                          src={imageUrl.trim()}
                          alt=""
                          className="mt-2 max-h-24 w-full rounded-lg object-cover"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-1/2 h-1.5 w-28 -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--admin-on-primary)_40%,transparent)]" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                {(
                  [
                    ["ios", Phone, "iOS"],
                    ["android", Smartphone, "Android"],
                    ["web", Laptop, "Web"],
                  ] as const
                ).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`${label} preview`}
                    aria-pressed={previewDevice === id}
                    onClick={() => {
                      setPreviewDevice(id);
                    }}
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                      previewDevice === id
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-primary)]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[12px] text-[var(--admin-on-surface-variant)]">
                Audience: {message.audienceLabel ?? "-"} (
                {formatCompactCount(message.recipientCount || recipientTotal)})
              </p>
            </div>
          </aside>
        </div>
      ) : null}

      {step === "delivery" && message ? (
        <div className="space-y-6 pb-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <MessengerWizardCard>
                <div className="space-y-4 px-6 py-6">
                  <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Schedule delivery
                  </h3>
                  <label
                    className={[
                      "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
                      deliveryMode === "now"
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:border-[var(--admin-outline)]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="delivery_type"
                      checked={deliveryMode === "now"}
                      onChange={() => {
                        setDeliveryMode("now");
                      }}
                      className="mt-1 accent-[var(--admin-primary)]"
                    />
                    <div>
                      <span className="block text-base font-bold text-[var(--admin-on-surface)]">
                        Send now
                      </span>
                      <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                        Process immediately after you confirm. Learners see the notification in
                        their in-app inbox.
                      </p>
                    </div>
                  </label>
                  <label
                    className={[
                      "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
                      deliveryMode === "schedule"
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:border-[var(--admin-outline)]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="delivery_type"
                      checked={deliveryMode === "schedule"}
                      onChange={() => {
                        setDeliveryMode("schedule");
                      }}
                      className="mt-1 accent-[var(--admin-primary)]"
                    />
                    <div className="flex-1">
                      <span className="block text-base font-bold text-[var(--admin-on-surface)]">
                        Schedule for later
                      </span>
                      <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                        Pick a date and time for this campaign to go live.
                      </p>
                      <div
                        className={[
                          "mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2",
                          deliveryMode === "schedule" ? "" : "pointer-events-none opacity-50",
                        ].join(" ")}
                      >
                        <label className="block">
                          <span className={MESSENGER_WIZARD_LABEL_CLASS}>Date & time</span>
                          <input
                            type="datetime-local"
                            value={scheduleLocal}
                            onChange={(event) => {
                              setScheduleLocal(event.target.value);
                            }}
                            className={MESSENGER_WIZARD_FIELD_CLASS}
                          />
                        </label>
                      </div>
                    </div>
                  </label>
                  <div className="rounded-lg border-l-4 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] p-4">
                    <div className="flex gap-3">
                      <Info
                        className="h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      <div className="text-[13px] text-[var(--admin-on-surface-variant)]">
                        <p className="font-bold text-[var(--admin-on-surface)]">Delivery note</p>
                        <p className="mt-1">
                          Channel checkboxes store future FCM / APNs / web-push preferences. Sending
                          today creates in-app notifications for the locked audience.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </MessengerWizardCard>
            </div>

            <div className="lg:col-span-5">
              <MessengerWizardCard className="h-full">
                <div className="border-b border-[var(--admin-border)] px-6 py-5">
                  <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Campaign review
                  </h3>
                </div>
                <div className="space-y-5 px-6 py-5">
                  <div>
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Target audience</span>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--admin-surface-high)] p-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                        <span className="text-sm font-bold text-[var(--admin-on-surface)]">
                          {message.audienceLabel ?? "Audience"}
                        </span>
                      </div>
                      <span className="rounded bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] px-2 py-1 font-mono text-[11px] font-bold text-[var(--admin-primary)]">
                        {formatCompactCount(message.recipientCount || recipientTotal)} recipients
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Message content</span>
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Subject
                      </p>
                      <p className="mt-1 text-sm text-[var(--admin-on-surface)]">
                        {subject.trim() || "-"}
                      </p>
                      <p className="mt-3 line-clamp-3 text-[13px] text-[var(--admin-on-surface-variant)]">
                        {body.trim() || "-"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Active channels</span>
                    <div className="flex flex-wrap gap-2">
                      {channelAndroid ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold text-[var(--admin-success)]">
                          Android
                        </span>
                      ) : null}
                      {channelIos ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold text-[var(--admin-success)]">
                          iOS
                        </span>
                      ) : null}
                      {channelWeb ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] px-3 py-1 text-[11px] font-bold text-[var(--admin-success)]">
                          Web
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="h-1 bg-gradient-to-r from-[var(--admin-primary)] to-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-surface-high))]" />
              </MessengerWizardCard>
            </div>
          </div>

          <MessengerWizardFooter
            left={
              <button
                type="button"
                disabled={busy}
                className={`${manageSecondaryButtonClassName} inline-flex items-center gap-2`}
                onClick={() => {
                  setStep("compose");
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to compose
              </button>
            }
            right={
              <>
                <button
                  type="button"
                  disabled={busy}
                  className={manageSecondaryButtonClassName}
                  onClick={() => {
                    void saveCompose(null);
                  }}
                >
                  Save as draft
                </button>
                {deliveryMode === "schedule" ? (
                  <button
                    type="button"
                    disabled={busy || !scheduleLocal}
                    className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                    onClick={() => {
                      void composeThenSend("schedule");
                    }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Schedule
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    className={`${managePrimaryButtonClassName} inline-flex items-center gap-2 shadow-[0_10px_24px_color-mix(in_srgb,var(--admin-primary)_22%,transparent)]`}
                    onClick={() => {
                      void composeThenSend("now");
                    }}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Rocket className="h-4 w-4" aria-hidden="true" />
                    )}
                    Send now
                  </button>
                )}
              </>
            }
          />
        </div>
      ) : null}

      {step === "settings" && message ? (
        <section className="max-w-xl space-y-6">
          <MessengerWizardCard>
            <div className="space-y-4 px-6 py-6">
              <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Edit title</h2>
              <label className="block">
                <span className={MESSENGER_WIZARD_LABEL_CLASS}>Title</span>
                <input
                  type="text"
                  value={settingsTitle}
                  maxLength={200}
                  onChange={(event) => {
                    setSettingsTitle(event.target.value);
                  }}
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  void saveSettingsTitle();
                }}
              >
                Save title
              </button>
              {message.status !== "SENT" ? (
                <button
                  type="button"
                  className={`${manageSecondaryButtonClassName} ml-2`}
                  onClick={() => {
                    if (!message.audienceType) setStep("audience");
                    else if (!message.subject || !message.body) setStep("recipients");
                    else setStep("compose");
                  }}
                >
                  Continue editing
                </button>
              ) : null}
            </div>
          </MessengerWizardCard>

          <div className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[var(--admin-surface)] p-6 shadow-sm">
            <h2 className="text-base font-bold text-[var(--admin-danger)]">Delete push message</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{message.title}</span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              placeholder="Exact title"
            />
            <button
              type="button"
              disabled={busy || deleteConfirm !== message.title}
              className={manageDangerButtonClassName}
              onClick={() => {
                void deleteMessage();
              }}
            >
              Delete permanently
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
