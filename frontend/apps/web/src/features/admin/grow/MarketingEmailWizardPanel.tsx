"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Filter,
  Globe,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  Mail,
  Monitor,
  Send,
  Smartphone,
  Users,
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
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import {
  EMAIL_CHANNEL_SETTINGS_HREF,
  EMAIL_LIST_HREF,
  emailRecipientInitials,
  formatCompactCount,
  formatEmailDateTime,
  marketingEmailHref,
  resolveEmailWizardStep,
  type EmailAudienceEstimate,
  type EmailWizardStep,
  type MarketingEmailCampaignDto,
  type MarketingEmailRecipient,
  type MarketingEmailTemplate,
} from "./marketing-email-shared";
import {
  EMAIL_WIZARD_STEPS,
  MESSENGER_WIZARD_FIELD_CLASS,
  MESSENGER_WIZARD_LABEL_CLASS,
  MessengerWizardCard,
  MessengerWizardFooter,
  MessengerWizardStepper,
} from "./push-wizard-chrome";

type CampaignResponse = { data: MarketingEmailCampaignDto };
type SendResponse = {
  data: MarketingEmailCampaignDto & {
    deliveredCount?: number;
    skippedCount?: number;
    spamDetected?: boolean;
    spamWords?: string[];
  };
};
type RecipientsResponse = { data: { totalCount: number; items: MarketingEmailRecipient[] } };
type TemplatesResponse = { data: { items: MarketingEmailTemplate[] } };
type EstimateResponse = { data: EmailAudienceEstimate };
type SpamCheckResponse = { data: { spamDetected: boolean; spamWords: string[] } };
type MeResponse = {
  data: {
    identity: { email: string | null };
    profile: { displayName: string | null } | null;
  };
};

type DeliveryMode = "now" | "schedule";
type PreviewWidth = "desktop" | "mobile";

const META_LABEL_CLASS =
  "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

const NAME_TIP_EXAMPLES = [
  "[Win-back] Inactive learners - March",
  "[Course update] Weekly digest",
  "[Announcement] Platform maintenance",
] as const;

type MarketingEmailWizardPanelProps = {
  campaignId?: string;
};

export function MarketingEmailWizardPanel({ campaignId }: MarketingEmailWizardPanelProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<MarketingEmailCampaignDto | null>(null);
  const [step, setStep] = useState<EmailWizardStep>(campaignId ? "audience" : "title");
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [audienceType, setAudienceType] = useState<"ALL" | "GROUP">("GROUP");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipients, setRecipients] = useState<MarketingEmailRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [allLearnersEstimate, setAllLearnersEstimate] = useState<number | null>(null);
  const [groupEstimate, setGroupEstimate] = useState<number | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [actorLabel, setActorLabel] = useState<string | null>(null);
  const [actorInitials, setActorInitials] = useState("AD");

  const [templates, setTemplates] = useState<MarketingEmailTemplate[]>([]);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [pickingTemplate, setPickingTemplate] = useState(true);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const [spamPreview, setSpamPreview] = useState<{
    spamDetected: boolean;
    spamWords: string[];
  } | null>(null);
  const [spamCheckBusy, setSpamCheckBusy] = useState(false);

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [spamWords, setSpamWords] = useState<string[]>([]);
  const [spamOpen, setSpamOpen] = useState(false);
  const [pendingSendMode, setPendingSendMode] = useState<"now" | "schedule" | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");

  const hydrate = useCallback((next: MarketingEmailCampaignDto, options?: { keepStep?: boolean }) => {
    setCampaign(next);
    setTitle(next.title);
    setSettingsTitle(next.title);
    if (next.audienceType) setAudienceType(next.audienceType);
    if (next.audienceBatchId) setBatchId(next.audienceBatchId);
    setSubject(next.subject ?? "");
    setBodyHtml(next.bodyHtml ?? "");
    setTemplateKey(next.templateKey);
    if (next.subject && next.bodyHtml) setPickingTemplate(false);
    if (next.scheduledAt) {
      const date = new Date(next.scheduledAt);
      if (!Number.isNaN(date.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        setScheduleLocal(
          [
            String(date.getFullYear()),
            pad(date.getMonth() + 1),
            pad(date.getDate()),
          ].join("-") +
            `T${pad(date.getHours())}:${pad(date.getMinutes())}`,
        );
        setDeliveryMode("schedule");
      }
    }
    if (!options?.keepStep) setStep(resolveEmailWizardStep(next));
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await clientApi.get<CampaignResponse>(
          `/api/v1/marketing/email-campaigns/${campaignId}`,
        );
        if (!controller.signal.aborted) hydrate(response.data);
      } catch (caught) {
        if (!controller.signal.aborted) {
          toast.error(
            caught instanceof ClientApiError ? caught.message : "Could not load campaign.",
          );
          router.replace(EMAIL_LIST_HREF);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [campaignId, hydrate, router]);

  useEffect(() => {
    void fetchBatches()
      .then((response) => {
        setBatches(response.data.items);
      })
      .catch(() => {
        setBatches([]);
      });
    void clientApi
      .get<TemplatesResponse>("/api/v1/marketing/email-campaigns/templates")
      .then((response) => {
        setTemplates(response.data.items);
      })
      .catch(() => {
        setTemplates([]);
      });
  }, []);

  useEffect(() => {
    let cancelled: boolean = false;
    void clientApi
      .get<MeResponse>("/api/v1/me")
      .then((me) => {
        if (cancelled) return;
        const name = me.data.profile?.displayName?.trim() || me.data.identity.email || "Admin";
        setActorLabel(name);
        setActorInitials(
          emailRecipientInitials(me.data.profile?.displayName ?? null, me.data.identity.email),
        );
        if (me.data.identity.email) setTestEmail(me.data.identity.email);
      })
      .catch(() => {
        if (!cancelled) {
          setActorLabel(null);
          setActorInitials("AD");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "audience") return;
    let cancelled: boolean = false;
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>(
        `/api/v1/marketing/email-campaigns-audience-estimate?audienceType=ALL`,
      )
      .then((response) => {
        if (!cancelled) setAllLearnersEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!cancelled) setAllLearnersEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step]);

  useEffect(() => {
    if (step !== "audience" || audienceType !== "GROUP" || !batchId) {
      setGroupEstimate(null);
      return;
    }
    let cancelled: boolean = false;
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>(
        `/api/v1/marketing/email-campaigns-audience-estimate?audienceType=GROUP&audienceBatchId=${encodeURIComponent(batchId)}`,
      )
      .then((response) => {
        if (!cancelled) setGroupEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!cancelled) setGroupEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimateBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, audienceType, batchId]);

  const progressSteps = useMemo(() => {
    if (step === "settings") return [];
    return EMAIL_WIZARD_STEPS;
  }, [step]);

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === batchId) ?? null,
    [batches, batchId],
  );

  const batchOptions = useMemo(
    () => batches.map((batch) => ({ value: batch.id, label: batch.name })),
    [batches],
  );

  async function loadRecipients(id: string) {
    const response = await clientApi.get<RecipientsResponse>(
      `/api/v1/marketing/email-campaigns/${id}/recipients`,
    );
    setRecipients(response.data.items);
    setRecipientTotal(response.data.totalCount);
  }

  async function saveTitleAndNext() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a campaign title.");
      return;
    }
    setBusy(true);
    try {
      if (!campaign) {
        const response = await clientApi.post<CampaignResponse>(
          "/api/v1/marketing/email-campaigns",
          { title: trimmed },
          "email-campaign-create",
          { silent: true },
        );
        toast.success("Campaign draft created.");
        router.replace(marketingEmailHref(response.data.id));
        return;
      }
      const response = await clientApi.patch<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}`,
        { title: trimmed },
        `email-campaign-title-${campaign.id}`,
        { silent: true },
      );
      hydrate(response.data);
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
      toast.error("Enter a campaign title.");
      return;
    }
    setBusy(true);
    try {
      if (!campaign) {
        const response = await clientApi.post<CampaignResponse>(
          "/api/v1/marketing/email-campaigns",
          { title: trimmed },
          "email-campaign-create",
          { silent: true },
        );
        toast.success("Draft saved.");
        router.replace(marketingEmailHref(response.data.id));
        return;
      }
      const response = await clientApi.patch<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}`,
        { title: trimmed },
        `email-campaign-title-${campaign.id}`,
        { silent: true },
      );
      hydrate(response.data, { keepStep: true });
      toast.success("Draft saved.");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAudienceAndNext() {
    if (!campaign) return;
    if (audienceType === "GROUP" && !batchId) {
      toast.error("Select a group for recipients.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}/audience`,
        {
          audienceType,
          ...(audienceType === "GROUP" ? { audienceBatchId: batchId } : {}),
        },
        `email-campaign-audience-${campaign.id}`,
        { silent: true },
      );
      hydrate(response.data, { keepStep: true });
      await loadRecipients(response.data.id);
      setStep("recipients");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not save recipients.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(template: MarketingEmailTemplate) {
    setTemplateKey(template.key);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    setPickingTemplate(false);
    setSpamPreview(null);
  }

  async function runSpamCheck() {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and email body are required to check deliverability.");
      return;
    }
    setSpamCheckBusy(true);
    try {
      const response = await clientApi.post<SpamCheckResponse>(
        "/api/v1/marketing/email-campaigns/spam-check",
        { subject: subject.trim(), bodyHtml: bodyHtml.trim() },
        "email-campaign-spam-check",
        { silent: true },
      );
      setSpamPreview(response.data);
      if (response.data.spamDetected) {
        toast.error(
          `Flagged words: ${response.data.spamWords.join(", ") || "spammy phrasing"}.`,
        );
      } else {
        toast.success("No high-risk spam phrases detected.");
      }
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not run spam check.",
      );
    } finally {
      setSpamCheckBusy(false);
    }
  }

  async function saveCompose(nextStep: EmailWizardStep | null) {
    if (!campaign) return;
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and email body are required.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}/compose`,
        {
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
          templateKey,
        },
        `email-campaign-compose-${campaign.id}`,
        { silent: true },
      );
      hydrate(response.data, { keepStep: Boolean(nextStep) });
      if (nextStep) setStep(nextStep);
      else {
        toast.success("Draft saved.");
        router.push(EMAIL_LIST_HREF);
        router.refresh();
      }
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save email.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCampaign(mode: "now" | "schedule" | "test", acknowledgeSpam = false) {
    if (!campaign) return;
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error("Subject and email body are required.");
      return;
    }
    if (mode === "schedule" && !scheduleLocal) {
      toast.error("Pick a schedule date and time.");
      return;
    }
    if (mode === "test" && !testEmail.trim()) {
      toast.error("Enter a test email address.");
      return;
    }

    setBusy(true);
    try {
      await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}/compose`,
        {
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
          templateKey,
        },
        `email-campaign-compose-${campaign.id}`,
        { silent: true },
      );

      const payload =
        mode === "now"
          ? { mode: "now" as const, acknowledgeSpam }
          : mode === "schedule"
            ? {
                mode: "schedule" as const,
                scheduledAt: new Date(scheduleLocal).toISOString(),
                acknowledgeSpam,
              }
            : { mode: "test" as const, testEmail: testEmail.trim(), acknowledgeSpam };

      const response = await clientApi.post<SendResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}/send`,
        payload,
        `email-campaign-send-${campaign.id}`,
        { silent: true },
      );

      if (response.data.spamDetected && !acknowledgeSpam && mode !== "test") {
        setSpamWords(response.data.spamWords ?? []);
        setPendingSendMode(mode);
        setSpamOpen(true);
        return;
      }

      if (mode === "test") {
        toast.success(`Test email sent to ${testEmail.trim()}.`);
        return;
      }
      if (mode === "schedule") {
        toast.success(`Scheduled for ${formatEmailDateTime(response.data.scheduledAt)}.`);
      } else {
        toast.success(
          `Sent to ${String(response.data.deliveredCount ?? response.data.recipientCount)} learner(s).`,
        );
      }
      router.push(EMAIL_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not send email.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettingsTitle() {
    if (!campaign) return;
    const trimmed = settingsTitle.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.patch<CampaignResponse>(
        `/api/v1/marketing/email-campaigns/${campaign.id}`,
        { title: trimmed },
        `email-campaign-title-${campaign.id}`,
      );
      hydrate(response.data, { keepStep: true });
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update title.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampaign() {
    if (!campaign) return;
    if (deleteConfirm !== campaign.title) {
      toast.error("Type the exact title to confirm deletion.");
      return;
    }
    setBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/email-campaigns/${campaign.id}/delete`,
        { titleConfirmation: deleteConfirm },
        `email-campaign-delete-${campaign.id}`,
      );
      router.push(EMAIL_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete campaign.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!campaign?.audienceType || step !== "recipients") return;
    if (recipients.length > 0 || recipientTotal > 0) return;
    void loadRecipients(campaign.id).catch(() => undefined);
  }, [campaign, step, recipients.length, recipientTotal]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href={EMAIL_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
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

      <Link href={EMAIL_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to campaign list
      </Link>

      <header className="space-y-2">
        <h1 className={managePageTitleClassName}>
          {campaign ? campaign.title : "Create email campaign"}
        </h1>
        <p className={`${managePageDescClassName} max-w-2xl`}>
          {step === "settings"
            ? "Edit campaign settings or delete this marketing email."
            : "Name the campaign, lock an audience, compose the message, then send or schedule."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={EMAIL_CHANNEL_SETTINGS_HREF}
            prefetch={false}
            className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
          >
            Sender settings (From name / email)
          </Link>
          {campaign?.status === "SENT" || campaign?.status === "SCHEDULED" ? (
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
        </div>
      </header>

      {progressSteps.length > 0 ? (
        <MessengerWizardStepper steps={progressSteps} current={step} />
      ) : null}

      {step === "title" ? (
        <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
          <MessengerWizardCard className="lg:col-span-8">
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-5 sm:px-8">
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Campaign identity</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Start by naming your campaign. This name helps you track and organize engagement
                efforts.
              </p>
            </div>
            <div className="space-y-6 px-6 py-6 sm:px-8">
              <label className="block">
                <span className={MESSENGER_WIZARD_LABEL_CLASS}>Internal campaign name</span>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="e.g. Q4 retention - active learners"
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                />
                <span className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--admin-on-surface-variant)]">
                  <Info className="h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
                  For your reference only - learners will not see this.
                </span>
              </label>
              <div className="grid grid-cols-1 gap-4 border-t border-[var(--admin-border)] pt-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className={META_LABEL_CLASS}>Campaign type</span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-on-surface)]">
                    <Mail className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    Marketing email
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
            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-4 sm:px-8">
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

          <div className="space-y-6 lg:col-span-4">
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-6">
              <div className="mb-4 flex items-center gap-2 text-[var(--admin-primary)]">
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.1em]">Naming tip</h3>
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                Use descriptive names that include the goal, audience, and timeframe to keep your
                list scannable.
              </p>
              <ul className="space-y-2">
                {NAME_TIP_EXAMPLES.map((example) => (
                  <li
                    key={example}
                    className="flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-success)]" />
                    {example}
                  </li>
                ))}
              </ul>
            </div>

            <MessengerWizardCard>
              <div className="relative flex h-28 items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]">
                <Mail
                  className="h-12 w-12 text-[color-mix(in_srgb,var(--admin-primary)_40%,transparent)]"
                  aria-hidden="true"
                />
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                    Draft status
                  </span>
                  <span className="rounded bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_12%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    {campaign ? campaign.status : "Not created"}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                  {campaign
                    ? "Save the title, then choose who should receive this email."
                    : "Saving creates a draft you can return to from the campaign list."}
                </p>
              </div>
            </MessengerWizardCard>
          </div>
        </div>
      ) : null}

      {step === "audience" && campaign ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(campaign.audienceType)}
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
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]">
                <Globe className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">All learners</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                Broadcast to every active learner with an email on file. Best for critical updates
                and platform-wide announcements.
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
              disabled={Boolean(campaign.audienceType)}
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
                  id="email-audience-batch"
                  label="Group (batch)"
                  ariaLabel="Group (batch)"
                  value={batchId}
                  disabled={Boolean(campaign.audienceType)}
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
              campaign.audienceType ? (
                <button
                  type="button"
                  disabled={busy}
                  className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await loadRecipients(campaign.id);
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

      {step === "recipients" && campaign ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_22%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] text-[var(--admin-primary)]">
                <Users className="h-8 w-8" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]">
                  Recipient verification
                </p>
                <p className="text-3xl font-extrabold tracking-tight text-[var(--admin-primary)]">
                  {formatCompactCount(recipientTotal || campaign.recipientCount)}
                </p>
                <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                  Total recipients with email on file
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
                  {campaign.audienceLabel ?? "Audience"}
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
                    {recipientTotal > recipients.length
                      ? ` of ${String(recipientTotal)}`
                      : ""} matching
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
                          No active learners with email in this audience.
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
                                {emailRecipientInitials(row.displayName, row.email)}
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
                      <p className="font-semibold text-[var(--admin-on-surface)]">Email channel</p>
                      <p className="mt-1">
                        Messages send through your configured marketing email provider and From
                        address.
                      </p>
                    </li>
                    <li className="rounded-lg border border-[var(--admin-border)] p-3">
                      <p className="font-semibold text-[var(--admin-on-surface)]">Email required</p>
                      <p className="mt-1">
                        Learners without an email address are excluded from the recipient count
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
                  Review a sample of names and addresses before composing. Smaller, relevant cohorts
                  usually outperform broad blasts.
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
                  setPickingTemplate(!(campaign.subject && campaign.bodyHtml));
                  setStep("compose");
                }}
              >
                Compose message
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
        </div>
      ) : null}

      {step === "compose" && campaign ? (
        <div className="space-y-6">
          {pickingTemplate ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Choose a template</h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Start from a starter layout, then edit the subject and HTML body.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-left shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)] transition-[border-color,background-color] hover:border-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-border))] hover:bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                    onClick={() => {
                      applyTemplate(template);
                    }}
                  >
                    <p className="font-bold text-[var(--admin-on-surface)]">{template.name}</p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      {template.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)]">
                      Use this template
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
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
                  subject.trim() && bodyHtml.trim() ? (
                    <button
                      type="button"
                      className={manageSecondaryButtonClassName}
                      onClick={() => {
                        setPickingTemplate(false);
                      }}
                    >
                      Continue with current draft
                    </button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <MessengerWizardCard>
                  <div className="space-y-5 px-6 py-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                        Message details
                      </h3>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                        onClick={() => {
                          setPickingTemplate(true);
                        }}
                      >
                        Change template
                      </button>
                    </div>
                    <label className="block">
                      <span className={MESSENGER_WIZARD_LABEL_CLASS}>Subject line</span>
                      <input
                        type="text"
                        value={subject}
                        maxLength={200}
                        onChange={(event) => {
                          setSubject(event.target.value);
                          setSpamPreview(null);
                        }}
                        className={MESSENGER_WIZARD_FIELD_CLASS}
                        placeholder="Weekly update for your cohort"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className={`${MESSENGER_WIZARD_LABEL_CLASS} mb-0`}>
                          Email body (HTML supported)
                        </span>
                        <span className="text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                          {bodyHtml.length.toLocaleString()} chars
                        </span>
                      </div>
                      <textarea
                        value={bodyHtml}
                        rows={14}
                        onChange={(event) => {
                          setBodyHtml(event.target.value);
                          setSpamPreview(null);
                        }}
                        className={`${MESSENGER_WIZARD_FIELD_CLASS} font-mono text-xs leading-relaxed`}
                        placeholder="<p>Hi there,</p>"
                      />
                    </label>

                    {spamPreview ? (
                      <div
                        className={[
                          "flex items-start gap-3 rounded-lg border p-4",
                          spamPreview.spamDetected
                            ? "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] text-[var(--admin-warning)]"
                            : "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]",
                        ].join(" ")}
                      >
                        {spamPreview.spamDetected ? (
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        )}
                        <div className="text-sm leading-relaxed">
                          {spamPreview.spamDetected ? (
                            <p>
                              Deliverability warning: flagged phrases include{" "}
                              <span className="font-semibold">
                                {spamPreview.spamWords.join(", ") || "spammy content"}
                              </span>
                              . You can still send after acknowledging the warning on delivery.
                            </p>
                          ) : (
                            <p>No high-risk spam phrases detected in the subject or body.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
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
                        disabled={busy || spamCheckBusy}
                        className={`${manageSecondaryButtonClassName} inline-flex items-center gap-2`}
                        onClick={() => {
                          void runSpamCheck();
                        }}
                      >
                        {spamCheckBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        Check spam phrases
                      </button>
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
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        Next: Delivery
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </>
                  }
                />
              </div>

              <aside className="lg:col-span-5">
                <div className="sticky top-24 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-on-surface-variant)]">
                      Live email preview
                    </p>
                    <div className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
                      <button
                        type="button"
                        aria-pressed={previewWidth === "desktop"}
                        className={[
                          "rounded-full p-2 transition-colors",
                          previewWidth === "desktop"
                            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                            : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                        ].join(" ")}
                        onClick={() => {
                          setPreviewWidth("desktop");
                        }}
                      >
                        <Monitor className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Desktop preview</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={previewWidth === "mobile"}
                        className={[
                          "rounded-full p-2 transition-colors",
                          previewWidth === "mobile"
                            ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                            : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                        ].join(" ")}
                        onClick={() => {
                          setPreviewWidth("mobile");
                        }}
                      >
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Mobile preview</span>
                      </button>
                    </div>
                  </div>
                  <div
                    className={[
                      "mx-auto overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg",
                      previewWidth === "mobile" ? "max-w-[360px]" : "w-full",
                    ].join(" ")}
                  >
                    <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
                      <p className="truncate text-sm font-bold text-[var(--admin-on-surface)]">
                        {subject.trim() || "Subject line"}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
                        To: locked audience · {formatCompactCount(campaign.recipientCount)} recipients
                      </p>
                    </div>
                    <div
                      className="prose prose-sm max-w-none p-5 text-[var(--admin-on-surface)] dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: bodyHtml.trim() || "<p>Email body preview appears here.</p>",
                      }}
                    />
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      ) : null}

      {step === "delivery" && campaign ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--admin-on-surface)]">Campaign delivery</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Finalize the schedule and review your campaign before launch.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                  void sendCampaign(deliveryMode);
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {deliveryMode === "schedule" ? "Schedule campaign" : "Send now"}
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <MessengerWizardCard>
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-6 py-5">
                  <h3 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Delivery schedule
                  </h3>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Choose when recipients should receive this message.
                  </p>
                </div>
                <div className="space-y-5 px-6 py-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode("now");
                      }}
                      className={[
                        "relative rounded-xl border-2 p-4 text-left transition-[border-color,background-color]",
                        deliveryMode === "now"
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-border))]",
                      ].join(" ")}
                    >
                      <span className="mb-2 flex items-center gap-2 font-bold text-[var(--admin-on-surface)]">
                        <Send className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                        Send now
                      </span>
                      <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                        Messages enter the send queue immediately after confirmation.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode("schedule");
                      }}
                      className={[
                        "relative rounded-xl border-2 p-4 text-left transition-[border-color,background-color]",
                        deliveryMode === "schedule"
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-border))]",
                      ].join(" ")}
                    >
                      <span className="mb-2 flex items-center gap-2 font-bold text-[var(--admin-on-surface)]">
                        <Layers className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                        Schedule for later
                      </span>
                      <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                        Pick a specific date and time for this campaign to launch.
                      </p>
                    </button>
                  </div>

                  {deliveryMode === "schedule" ? (
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                      <label className="block">
                        <span className={MESSENGER_WIZARD_LABEL_CLASS}>Date and time (local)</span>
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
                  ) : null}

                  <div className="border-t border-[var(--admin-border)] pt-5">
                    <label className="block">
                      <span className={MESSENGER_WIZARD_LABEL_CLASS}>Send test email</span>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(event) => {
                            setTestEmail(event.target.value);
                          }}
                          placeholder="you@example.com"
                          className={MESSENGER_WIZARD_FIELD_CLASS}
                        />
                        <button
                          type="button"
                          disabled={busy || !testEmail.trim()}
                          className={`${manageSecondaryButtonClassName} shrink-0`}
                          onClick={() => {
                            void sendCampaign("test");
                          }}
                        >
                          Send test
                        </button>
                      </div>
                    </label>
                  </div>
                </div>
              </MessengerWizardCard>

              <MessengerWizardCard>
                <div className="space-y-3 px-6 py-5">
                  <h3 className="text-base font-bold text-[var(--admin-on-surface)]">
                    Content checklist
                  </h3>
                  <ul className="space-y-2 text-sm text-[var(--admin-on-surface-variant)]">
                    <li className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
                        aria-hidden="true"
                      />
                      Subject and body are saved before send.
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-success)]"
                        aria-hidden="true"
                      />
                      Audience is locked at {formatCompactCount(campaign.recipientCount)} recipients.
                    </li>
                    <li className="flex items-start gap-2">
                      <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                        aria-hidden="true"
                      />
                      Run &quot;Check spam phrases&quot; on Compose if you want a pre-send scan.
                    </li>
                  </ul>
                </div>
              </MessengerWizardCard>
            </div>

            <div className="space-y-6">
              <MessengerWizardCard className="sticky top-24">
                <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                    Campaign summary
                  </h3>
                </div>
                <div className="space-y-5 px-5 py-5">
                  <div>
                    <p className={META_LABEL_CLASS}>Audience segment</p>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      {campaign.audienceLabel ?? "Audience"}
                    </p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-[var(--admin-primary)]">
                        {formatCompactCount(campaign.recipientCount)}
                      </span>
                      <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                        recipients
                      </span>
                    </p>
                  </div>
                  <div className="border-t border-[var(--admin-border)] pt-4">
                    <p className={META_LABEL_CLASS}>Subject line</p>
                    <p className="text-sm italic text-[var(--admin-on-surface)]">
                      {subject.trim() || "-"}
                    </p>
                  </div>
                  <div className="border-t border-[var(--admin-border)] pt-4">
                    <p className={META_LABEL_CLASS}>Channel</p>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                      <Mail className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                      Marketing email
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    className={`${managePrimaryButtonClassName} w-full inline-flex items-center justify-center gap-2`}
                    onClick={() => {
                      void sendCampaign(deliveryMode);
                    }}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {deliveryMode === "schedule" ? "Confirm & schedule" : "Confirm & send now"}
                  </button>
                  <p className="text-center text-[11px] text-[var(--admin-on-surface-variant)]">
                    Sending uses your configured marketing email channel.
                  </p>
                </div>
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
                  setPickingTemplate(false);
                  setStep("compose");
                }}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to compose
              </button>
            }
            right={<span className="sr-only">Primary actions are above</span>}
          />
        </div>
      ) : null}

      {step === "settings" && campaign ? (
        <div className="max-w-xl space-y-6">
          <MessengerWizardCard>
            <div className="space-y-4 px-6 py-6">
              <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Edit title</h2>
              <input
                type="text"
                value={settingsTitle}
                maxLength={200}
                onChange={(event) => {
                  setSettingsTitle(event.target.value);
                }}
                className={MESSENGER_WIZARD_FIELD_CLASS}
              />
              <div className="flex flex-wrap gap-2">
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
                {campaign.status !== "SENT" ? (
                  <button
                    type="button"
                    className={manageSecondaryButtonClassName}
                    onClick={() => {
                      if (!campaign.audienceType) setStep("audience");
                      else if (!campaign.subject || !campaign.bodyHtml) setStep("recipients");
                      else setStep("compose");
                    }}
                  >
                    Continue editing
                  </button>
                ) : null}
              </div>
            </div>
          </MessengerWizardCard>
          <MessengerWizardCard className="border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))]">
            <div className="space-y-4 px-6 py-6">
              <h2 className="text-base font-bold text-[var(--admin-danger)]">Delete campaign</h2>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Type{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">{campaign.title}</span>{" "}
                to confirm. Deleted emails cannot be recovered.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(event) => {
                  setDeleteConfirm(event.target.value);
                }}
                className={MESSENGER_WIZARD_FIELD_CLASS}
              />
              <button
                type="button"
                disabled={busy || deleteConfirm !== campaign.title}
                className={manageDangerButtonClassName}
                onClick={() => {
                  void deleteCampaign();
                }}
              >
                Delete permanently
              </button>
            </div>
          </MessengerWizardCard>
        </div>
      ) : null}

      {spamOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close spam warning"
            className="absolute inset-0 bg-[var(--admin-scrim)]"
            onClick={() => {
              setSpamOpen(false);
              setPendingSendMode(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Spam detector</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              This email may contain spammy words:{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {spamWords.join(", ") || "flagged content"}
              </span>
              .
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  setSpamOpen(false);
                  setPendingSendMode(null);
                  setPickingTemplate(false);
                  setStep("compose");
                }}
              >
                Edit email
              </button>
              <button
                type="button"
                className={managePrimaryButtonClassName}
                disabled={busy || !pendingSendMode}
                onClick={() => {
                  const mode = pendingSendMode;
                  setSpamOpen(false);
                  setPendingSendMode(null);
                  if (mode) void sendCampaign(mode, true);
                }}
              >
                Send anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
