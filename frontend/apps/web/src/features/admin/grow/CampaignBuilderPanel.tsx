"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  Rocket,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { fetchBatches, type Batch } from "../domain/admin-domain-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import {
  MESSENGER_WIZARD_FIELD_CLASS,
  MESSENGER_WIZARD_LABEL_CLASS,
  MessengerWizardCard,
  MessengerWizardFooter,
  MessengerWizardStepper,
} from "./push-wizard-chrome";
import {
  BUILDER_STEPS,
  CAMPAIGNS_HREF,
  GOAL_OPTIONS,
  MARKETING_HREF,
  campaignAnalyticsHref,
  campaignGoalLabel,
  campaignHref,
  campaignChannelLabel,
  campaignStatusLabel,
  createLocalTouchpointId,
  emptyChannels,
  formatCampaignCount,
  formatCompactCount,
  resolveBuilderStep,
  type BuilderStep,
  type CampaignAudienceType,
  type CampaignChannel,
  type CampaignChannels,
  type CampaignGoal,
  type CampaignTouchpoint,
  type MarketingCampaignDto,
} from "./campaigns-shared";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type CampaignResponse = { data: MarketingCampaignDto };
type EstimateResponse = {
  data: { audienceType: CampaignAudienceType; audienceBatchId: string | null; totalCount: number };
};

type DeliveryMode = "now" | "schedule";

const STEP_DEFS = BUILDER_STEPS.map((entry) => ({ id: entry.id, label: entry.label }));

const CHANNEL_META: ReadonlyArray<{
  id: CampaignChannel;
  label: string;
  icon: typeof Mail;
  description: string;
}> = [
  {
    id: "email",
    label: "Email",
    icon: Mail,
    description: "Rich HTML messages to learner inboxes.",
  },
  {
    id: "push",
    label: "Push",
    icon: Bell,
    description: "Mobile and web push notifications.",
  },
  {
    id: "announcement",
    label: "Announcement",
    icon: Megaphone,
    description: "In-app announcement feed posts.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    description: "Template messages via Messenger.",
  },
];

const META_LABEL_CLASS =
  "mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

function localDateTimeToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sortedTouchpoints(points: CampaignTouchpoint[]) {
  return [...points].sort((a, b) => a.delayDays - b.delayDays || a.title.localeCompare(b.title));
}

function enabledChannelList(channels: CampaignChannels): CampaignChannel[] {
  return (Object.keys(channels) as CampaignChannel[]).filter((key) => channels[key]);
}

type CampaignBuilderPanelProps = {
  campaignId?: string;
};

export function CampaignBuilderPanel({ campaignId }: CampaignBuilderPanelProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<MarketingCampaignDto | null>(null);
  const [step, setStep] = useState<BuilderStep>("goal");
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<CampaignGoal | null>(null);

  const [audienceType, setAudienceType] = useState<CampaignAudienceType>("ALL");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [allEstimate, setAllEstimate] = useState<number | null>(null);
  const [groupEstimate, setGroupEstimate] = useState<number | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);

  const [channels, setChannels] = useState<CampaignChannels>(emptyChannels());
  const [touchpoints, setTouchpoints] = useState<CampaignTouchpoint[]>([]);
  const [selectedTouchpointId, setSelectedTouchpointId] = useState<string | null>(null);

  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [launchSuccessOpen, setLaunchSuccessOpen] = useState(false);

  const isDraft = !campaign || campaign.status === "DRAFT";
  const readOnly = !isDraft;

  const hydrateFromCampaign = useCallback(
    (next: MarketingCampaignDto, options?: { keepStep?: boolean }) => {
      setCampaign(next);
      setTitle(next.title);
      setGoal(next.goal);
      if (next.audienceType) setAudienceType(next.audienceType);
      if (next.audienceBatchId) setBatchId(next.audienceBatchId);
      setChannels(next.channels);
      setTouchpoints(next.touchpoints);
      if (next.touchpoints.length > 0 && !selectedTouchpointId) {
        setSelectedTouchpointId(defined(next.touchpoints[0]).id);
      }
      if (next.scheduledAt) {
        const date = new Date(next.scheduledAt);
        if (!Number.isNaN(date.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          setScheduleLocal(
            `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
          );
          setDeliveryMode("schedule");
        }
      }
      if (!options?.keepStep) {
        setStep(resolveBuilderStep(next));
      }
    },
    [selectedTouchpointId],
  );

  useEffect(() => {
    if (!campaignId) return;
    const cancelled = { current: false };
    setLoading(true);
    void (async () => {
      try {
        const response = await clientApi.get<CampaignResponse>(
          `/api/v1/marketing/campaigns/${campaignId}`,
        );
        if (cancelled.current) return;
        hydrateFromCampaign(response.data);
      } catch (caught) {
        if (!cancelled.current) {
          toast.error(
            caught instanceof ClientApiError ? caught.message : "Could not load campaign.",
          );
          router.replace(CAMPAIGNS_HREF);
        }
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [campaignId, hydrateFromCampaign, router]);

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
    if (step !== "audience") return;
    const cancelled = { current: false };
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>("/api/v1/marketing/campaigns-audience-estimate?audienceType=ALL")
      .then((response) => {
        if (!cancelled.current) setAllEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!cancelled.current) setAllEstimate(null);
      })
      .finally(() => {
        if (!cancelled.current) setEstimateBusy(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [step]);

  useEffect(() => {
    if (step !== "audience" || audienceType !== "GROUP" || !batchId) {
      setGroupEstimate(null);
      return;
    }
    const cancelled = { current: false };
    setEstimateBusy(true);
    void clientApi
      .get<EstimateResponse>(
        `/api/v1/marketing/campaigns-audience-estimate?audienceType=GROUP&audienceBatchId=${encodeURIComponent(batchId)}`,
      )
      .then((response) => {
        if (!cancelled.current) setGroupEstimate(response.data.totalCount);
      })
      .catch(() => {
        if (!cancelled.current) setGroupEstimate(null);
      })
      .finally(() => {
        if (!cancelled.current) setEstimateBusy(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [step, audienceType, batchId]);

  const batchOptions = useMemo(
    () => batches.map((batch) => ({ value: batch.id, label: batch.name })),
    [batches],
  );

  const selectedBatch = useMemo(
    () => batches.find((batch) => batch.id === batchId) ?? null,
    [batches, batchId],
  );

  const activeEstimate = audienceType === "ALL" ? allEstimate : batchId ? groupEstimate : null;

  const selectedTouchpoint = useMemo(
    () => touchpoints.find((point) => point.id === selectedTouchpointId) ?? null,
    [touchpoints, selectedTouchpointId],
  );

  const timelineTouchpoints = useMemo(() => sortedTouchpoints(touchpoints), [touchpoints]);

  const stepIndex = BUILDER_STEPS.findIndex((entry) => entry.id === step);

  const checklist = useMemo(() => {
    const hasTitle = title.trim().length > 0;
    const hasGoal = goal != null;
    const hasAudience = audienceType === "ALL" || batchId.trim().length > 0;
    const enabled = enabledChannelList(channels);
    const hasChannels = enabled.length > 0;
    const hasTouchpoints = touchpoints.length > 0;
    const touchpointsValid = touchpoints.every((point) => point.title.trim().length > 0);
    const scheduleValid =
      deliveryMode === "now" ||
      (scheduleLocal.trim().length > 0 &&
        (Date.parse(localDateTimeToIso(scheduleLocal) ?? "") || 0) > Date.now());

    return [
      { id: "title", label: "Campaign title", done: hasTitle },
      { id: "goal", label: "Campaign goal", done: hasGoal },
      { id: "audience", label: "Audience selected", done: hasAudience },
      { id: "channels", label: "At least one channel", done: hasChannels },
      {
        id: "touchpoints",
        label: "Touchpoints configured",
        done: hasTouchpoints && touchpointsValid,
      },
      { id: "schedule", label: "Launch timing valid", done: scheduleValid },
    ];
  }, [title, goal, audienceType, batchId, channels, touchpoints, deliveryMode, scheduleLocal]);

  const checklistComplete = checklist.every((item) => item.done);

  async function persistGoal(options?: { advance?: boolean; silent?: boolean }) {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a campaign title.");
      return false;
    }
    if (!goal) {
      toast.error("Select a campaign goal.");
      return false;
    }
    setBusy(true);
    try {
      if (!campaign) {
        const response = await clientApi.post<CampaignResponse>(
          "/api/v1/marketing/campaigns",
          { title: trimmed, goal },
          "marketing-campaign-create",
          { silent: options?.silent },
        );
        if (!options?.silent) toast.success("Campaign draft created.");
        hydrateFromCampaign(response.data, { keepStep: true });
        router.replace(campaignHref(response.data.id));
        if (options?.advance) setStep("audience");
        return true;
      }
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/campaigns/${campaign.id}/identity`,
        { title: trimmed, goal },
        `marketing-campaign-identity-${campaign.id}`,
        { silent: options?.silent },
      );
      hydrateFromCampaign(response.data, { keepStep: true });
      if (!options?.silent) toast.success("Draft saved.");
      if (options?.advance) setStep("audience");
      return true;
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save campaign.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function persistAudience(options?: { advance?: boolean; silent?: boolean }) {
    if (!campaign) {
      toast.error("Save the campaign title and goal first.");
      return false;
    }
    if (audienceType === "GROUP" && !batchId) {
      toast.error("Select a learner group.");
      return false;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/campaigns/${campaign.id}/audience`,
        {
          audienceType,
          ...(audienceType === "GROUP" ? { audienceBatchId: batchId } : {}),
        },
        `marketing-campaign-audience-${campaign.id}`,
        { silent: options?.silent },
      );
      hydrateFromCampaign(response.data, { keepStep: true });
      if (!options?.silent) toast.success("Audience saved.");
      if (options?.advance) setStep("touchpoints");
      return true;
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save audience.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function persistTouchpoints(options?: { advance?: boolean; silent?: boolean }) {
    if (!campaign) {
      toast.error("Save earlier steps before touchpoints.");
      return false;
    }
    const enabled = enabledChannelList(channels);
    if (enabled.length === 0) {
      toast.error("Enable at least one channel.");
      return false;
    }
    if (touchpoints.length === 0) {
      toast.error("Add at least one touchpoint.");
      return false;
    }
    for (const point of touchpoints) {
      if (!point.title.trim()) {
        toast.error("Every touchpoint needs a title.");
        return false;
      }
      if (!channels[point.channel]) {
        toast.error(`Touchpoint "${point.title}" uses a disabled channel.`);
        return false;
      }
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/campaigns/${campaign.id}/touchpoints`,
        { channels, touchpoints },
        `marketing-campaign-touchpoints-${campaign.id}`,
        { silent: options?.silent },
      );
      hydrateFromCampaign(response.data, { keepStep: true });
      if (!options?.silent) toast.success("Touchpoints saved.");
      if (options?.advance) setStep("review");
      return true;
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not save touchpoints.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraftForStep() {
    if (readOnly) return;
    if (step === "goal") {
      await persistGoal({ silent: true });
      return;
    }
    if (step === "audience") {
      await persistAudience({ silent: true });
      return;
    }
    if (step === "touchpoints") {
      await persistTouchpoints({ silent: true });
      return;
    }
    await persistTouchpoints({ silent: true });
  }

  async function goNext() {
    if (readOnly) {
      if (step === "goal") setStep("audience");
      else if (step === "audience") setStep("touchpoints");
      else if (step === "touchpoints") setStep("review");
      return;
    }
    if (step === "goal") {
      await persistGoal({ advance: true });
      return;
    }
    if (step === "audience") {
      await persistAudience({ advance: true });
      return;
    }
    if (step === "touchpoints") {
      await persistTouchpoints({ advance: true });
    }
  }

  function goPrev() {
    if (stepIndex <= 0) return;
    setStep(defined(BUILDER_STEPS[stepIndex - 1]).id);
  }

  async function launchCampaign() {
    if (!campaign || readOnly) return;
    if (!checklistComplete) {
      toast.error("Complete the checklist before launch.");
      return;
    }
    const saved = await persistTouchpoints({ silent: true });
    if (!saved) return;

    let scheduledAt: string | undefined;
    if (deliveryMode === "schedule") {
      const iso = localDateTimeToIso(scheduleLocal);
      if (!iso || new Date(iso).getTime() <= Date.now()) {
        toast.error("Pick a future date and time to schedule.");
        return;
      }
      scheduledAt = iso;
    }

    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/campaigns/${campaign.id}/launch`,
        {
          mode: deliveryMode,
          ...(deliveryMode === "schedule" ? { scheduledAt } : {}),
        },
        `marketing-campaign-launch-${campaign.id}`,
        {
          successMessage:
            deliveryMode === "schedule" ? "Campaign scheduled." : "Campaign launched.",
        },
      );
      hydrateFromCampaign(response.data, { keepStep: true });
      setLaunchSuccessOpen(true);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not launch campaign.");
    } finally {
      setBusy(false);
    }
  }

  function toggleChannel(channel: CampaignChannel) {
    if (readOnly) return;
    setChannels((current) => ({ ...current, [channel]: !current[channel] }));
  }

  function addTouchpoint() {
    if (readOnly) return;
    const enabled = enabledChannelList(channels);
    if (enabled.length === 0) {
      toast.error("Enable at least one channel first.");
      return;
    }
    const lastDelay = touchpoints.reduce((max, point) => Math.max(max, point.delayDays), 0);
    const next: CampaignTouchpoint = {
      id: createLocalTouchpointId(),
      channel: defined(enabled[0]),
      title: `Step ${String(touchpoints.length + 1)}`,
      subject: null,
      body: null,
      delayDays: touchpoints.length === 0 ? 0 : lastDelay + 3,
    };
    setTouchpoints((current) => [...current, next]);
    setSelectedTouchpointId(next.id);
  }

  function removeTouchpoint(id: string) {
    if (readOnly) return;
    setTouchpoints((current) => current.filter((point) => point.id !== id));
    if (selectedTouchpointId === id) {
      setSelectedTouchpointId(null);
    }
  }

  function updateTouchpoint(id: string, patch: Partial<CampaignTouchpoint>) {
    if (readOnly) return;
    setTouchpoints((current) =>
      current.map((point) => (point.id === id ? { ...point, ...patch } : point)),
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin text-[var(--admin-primary)]"
          aria-label="Loading campaign"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      >
        <Link
          href={MARKETING_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Marketing
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={CAMPAIGNS_HREF}
          prefetch={false}
          className="transition-colors hover:text-[var(--admin-primary)]"
        >
          Campaigns
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-[var(--admin-primary)]">Builder</span>
      </nav>

      <Link href={CAMPAIGNS_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to campaigns
      </Link>

      <header className="space-y-2">
        <h1 className={managePageTitleClassName}>{campaign ? campaign.title : "New campaign"}</h1>
        <p className={`${managePageDescClassName} max-w-2xl`}>
          {readOnly
            ? `This campaign is ${campaignStatusLabel(defined(campaign).status).toLowerCase()}. Review the plan or open analytics.`
            : "Set a goal, choose an audience, plan touchpoints across channels, then launch or schedule."}
        </p>
        {readOnly ? (
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={campaignAnalyticsHref(defined(campaign).id)}
              prefetch={false}
              className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
            >
              View analytics
            </Link>
            <Link
              href={campaignHref(defined(campaign).id)}
              prefetch={false}
              className="text-sm font-semibold text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] hover:underline"
            >
              Edit in builder
            </Link>
          </div>
        ) : null}
      </header>

      <MessengerWizardStepper steps={STEP_DEFS} current={step} />

      {step === "goal" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <MessengerWizardCard>
            <div className="border-b border-[var(--admin-border)] px-6 py-5">
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Goal and title</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Name the campaign and pick the primary outcome you are driving.
              </p>
            </div>
            <div className="space-y-6 px-6 py-6">
              <label className="block">
                <span className={MESSENGER_WIZARD_LABEL_CLASS}>Campaign title</span>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  disabled={readOnly}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  placeholder="e.g. Spring re-activation series"
                  className={MESSENGER_WIZARD_FIELD_CLASS}
                />
              </label>

              <fieldset disabled={readOnly}>
                <legend className={MESSENGER_WIZARD_LABEL_CLASS}>Campaign goal</legend>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GOAL_OPTIONS.map((option) => {
                    const selected = goal === option.id;
                    return (
                      <label
                        key={option.id}
                        className={[
                          "flex cursor-pointer flex-col rounded-xl border p-4 transition-colors",
                          selected
                            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                            : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                          readOnly ? "cursor-default opacity-80" : "",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="campaign-goal"
                            value={option.id}
                            checked={selected}
                            onChange={() => {
                              setGoal(option.id);
                            }}
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                          />
                          <span className="text-[14px] font-bold text-[var(--admin-on-surface)]">
                            {option.label}
                          </span>
                        </span>
                        <span className="mt-2 pl-6 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                          {option.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </MessengerWizardCard>

          <aside className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <div className="flex items-start gap-3">
              <Target
                className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-[13px] font-bold text-[var(--admin-on-surface)]">
                  Why goals matter
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Clear goals help teams prioritize touchpoints and measure whether the campaign
                  addressed the right learner moment. Pick the outcome that best matches this
                  series.
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {step === "audience" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <MessengerWizardCard>
            <div className="border-b border-[var(--admin-border)] px-6 py-5">
              <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Audience</h2>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Choose who receives every touchpoint in this campaign.
              </p>
            </div>
            <div className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={readOnly || Boolean(campaign?.audienceType)}
                  onClick={() => {
                    setAudienceType("ALL");
                    setBatchId("");
                  }}
                  className={[
                    "rounded-xl border p-4 text-left transition-colors",
                    audienceType === "ALL"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                    readOnly || campaign?.audienceType ? "cursor-default opacity-80" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--admin-on-surface)]">
                    <Users className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    All learners
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                    Every active learner in the academy.
                  </p>
                </button>
                <button
                  type="button"
                  disabled={readOnly || Boolean(campaign?.audienceType)}
                  onClick={() => {
                    setAudienceType("GROUP");
                  }}
                  className={[
                    "rounded-xl border p-4 text-left transition-colors",
                    audienceType === "GROUP"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                    readOnly || campaign?.audienceType ? "cursor-default opacity-80" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--admin-on-surface)]">
                    <Users className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    Group
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                    Target a saved learner batch or cohort.
                  </p>
                </button>
              </div>

              {audienceType === "GROUP" ? (
                <div>
                  <AdminSelectDropdown
                    id="campaign-audience-batch"
                    label="Learner group"
                    ariaLabel="Learner group"
                    value={batchId}
                    options={batchOptions}
                    disabled={
                      readOnly || Boolean(campaign?.audienceType) || batchOptions.length === 0
                    }
                    onChange={(value) => {
                      setBatchId(value);
                    }}
                  />
                  {selectedBatch ? (
                    <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                      Group key: {selectedBatch.key}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <p className="text-[13px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Reach estimates respect academy membership filters. Learners without email or push
                  opt-in may still be counted but will not receive every channel.
                </p>
              </div>
            </div>
          </MessengerWizardCard>

          <aside className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
            <span className={META_LABEL_CLASS}>Estimated reach</span>
            {estimateBusy ? (
              <div className="flex items-center gap-2 py-4 text-[var(--admin-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Calculating...
              </div>
            ) : activeEstimate == null ? (
              <p className="py-4 text-[13px] text-[var(--admin-on-surface-variant)]">
                {audienceType === "GROUP" && !batchId
                  ? "Select a group to see reach."
                  : "Reach estimate unavailable."}
              </p>
            ) : (
              <>
                <p className="text-[32px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
                  {formatCompactCount(activeEstimate)}
                </p>
                <p className="mt-2 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {formatCampaignCount(activeEstimate)} learners match this audience today.
                </p>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {step === "touchpoints" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <MessengerWizardCard>
              <div className="border-b border-[var(--admin-border)] px-6 py-5">
                <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Channels</h2>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Enable the channels you plan to use in this campaign.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 px-6 py-6 sm:grid-cols-2">
                {CHANNEL_META.map((entry) => {
                  const Icon = entry.icon;
                  const checked = channels[entry.id];
                  return (
                    <label
                      key={entry.id}
                      className={[
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                        checked
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
                        readOnly ? "cursor-default opacity-80" : "",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => {
                          toggleChannel(entry.id);
                        }}
                        className="mt-1 h-4 w-4 accent-[var(--admin-primary)]"
                      />
                      <span>
                        <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--admin-on-surface)]">
                          <Icon
                            className="h-4 w-4 text-[var(--admin-primary)]"
                            aria-hidden="true"
                          />
                          {entry.label}
                        </span>
                        <span className="mt-1 block text-[12px] text-[var(--admin-on-surface-variant)]">
                          {entry.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </MessengerWizardCard>

            <MessengerWizardCard>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
                <div>
                  <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Timeline</h2>
                  <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Order touchpoints by delay days from launch.
                  </p>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={addTouchpoint}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add step
                  </button>
                ) : null}
              </div>
              <div className="space-y-3 px-6 py-6">
                {timelineTouchpoints.length === 0 ? (
                  <p className="text-[14px] text-[var(--admin-on-surface-variant)]">
                    No touchpoints yet. Add a step to start the sequence.
                  </p>
                ) : (
                  timelineTouchpoints.map((point, index) => {
                    const selected = point.id === selectedTouchpointId;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => {
                          setSelectedTouchpointId(point.id);
                        }}
                        className={[
                          "flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors",
                          selected
                            ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                            : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] hover:border-[var(--admin-outline)]",
                        ].join(" ")}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[12px] font-bold text-[var(--admin-on-surface-variant)]">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[14px] font-bold text-[var(--admin-on-surface)]">
                              {point.title}
                            </span>
                            <span className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                              {campaignChannelLabel(point.channel)}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            Day {String(point.delayDays)}
                            {point.delayDays === 0 ? " (launch day)" : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </MessengerWizardCard>
          </div>

          <aside className="space-y-4">
            {selectedTouchpoint ? (
              <MessengerWizardCard>
                <div className="border-b border-[var(--admin-border)] px-5 py-4">
                  <h3 className="text-[15px] font-bold text-[var(--admin-on-surface)]">
                    Edit touchpoint
                  </h3>
                </div>
                <div className="space-y-4 px-5 py-5">
                  <label className="block">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Title</span>
                    <input
                      type="text"
                      value={selectedTouchpoint.title}
                      disabled={readOnly}
                      maxLength={200}
                      onChange={(event) => {
                        updateTouchpoint(selectedTouchpoint.id, { title: event.target.value });
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                    />
                  </label>

                  <div>
                    <AdminSelectDropdown
                      id="touchpoint-channel"
                      label="Channel"
                      ariaLabel="Touchpoint channel"
                      value={selectedTouchpoint.channel}
                      disabled={readOnly}
                      options={enabledChannelList(channels).map((channel) => ({
                        value: channel,
                        label: campaignChannelLabel(channel),
                      }))}
                      onChange={(value) => {
                        updateTouchpoint(selectedTouchpoint.id, {
                          channel: value as CampaignChannel,
                        });
                      }}
                    />
                  </div>

                  <label className="block">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Delay (days from launch)</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={selectedTouchpoint.delayDays}
                      disabled={readOnly}
                      onChange={(event) => {
                        updateTouchpoint(selectedTouchpoint.id, {
                          delayDays: Math.max(0, Number(event.target.value) || 0),
                        });
                      }}
                      className={MESSENGER_WIZARD_FIELD_CLASS}
                    />
                  </label>

                  {(selectedTouchpoint.channel === "email" ||
                    selectedTouchpoint.channel === "push") && (
                    <label className="block">
                      <span className={MESSENGER_WIZARD_LABEL_CLASS}>
                        {selectedTouchpoint.channel === "email" ? "Subject" : "Notification title"}
                      </span>
                      <input
                        type="text"
                        value={selectedTouchpoint.subject ?? ""}
                        disabled={readOnly}
                        maxLength={500}
                        onChange={(event) => {
                          updateTouchpoint(selectedTouchpoint.id, {
                            subject: event.target.value || null,
                          });
                        }}
                        className={MESSENGER_WIZARD_FIELD_CLASS}
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className={MESSENGER_WIZARD_LABEL_CLASS}>Body</span>
                    <textarea
                      value={selectedTouchpoint.body ?? ""}
                      disabled={readOnly}
                      rows={4}
                      onChange={(event) => {
                        updateTouchpoint(selectedTouchpoint.id, {
                          body: event.target.value || null,
                        });
                      }}
                      className={`${MESSENGER_WIZARD_FIELD_CLASS} min-h-[96px] resize-y`}
                    />
                  </label>

                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => {
                        removeTouchpoint(selectedTouchpoint.id);
                      }}
                      className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-danger,var(--admin-warning))]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove step
                    </button>
                  ) : null}
                </div>
              </MessengerWizardCard>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-5 text-[13px] text-[var(--admin-on-surface-variant)]">
                Select a touchpoint from the timeline to edit its content.
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <div className="flex items-start gap-3">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <p className="text-[12px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  WhatsApp touchpoints are saved as planned steps. Finish template selection and
                  approval in Messenger before sending.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
                <p className="text-[12px] leading-relaxed text-[var(--admin-on-surface-variant)]">
                  Announcement steps with a delay cannot auto-schedule. Send them manually on the
                  planned day or launch as day-zero only.
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <MessengerWizardCard className="p-5">
                <span className={META_LABEL_CLASS}>Goal</span>
                <p className="text-[16px] font-bold text-[var(--admin-on-surface)]">
                  {campaignGoalLabel(goal)}
                </p>
                <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {title.trim() || "Untitled"}
                </p>
              </MessengerWizardCard>
              <MessengerWizardCard className="p-5">
                <span className={META_LABEL_CLASS}>Audience</span>
                <p className="text-[16px] font-bold text-[var(--admin-on-surface)]">
                  {audienceType === "ALL"
                    ? "All learners"
                    : (selectedBatch?.name ?? campaign?.audienceLabel ?? "Group")}
                </p>
                <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {campaign?.recipientCount
                    ? `${formatCampaignCount(campaign.recipientCount)} recipients`
                    : activeEstimate != null
                      ? `${formatCampaignCount(activeEstimate)} estimated`
                      : "Reach pending"}
                </p>
              </MessengerWizardCard>
              <MessengerWizardCard className="p-5">
                <span className={META_LABEL_CLASS}>Touchpoints</span>
                <p className="text-[16px] font-bold text-[var(--admin-on-surface)]">
                  {String(touchpoints.length)} steps
                </p>
                <p className="mt-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                  {enabledChannelList(channels).map(campaignChannelLabel).join(", ") ||
                    "No channels"}
                </p>
              </MessengerWizardCard>
            </div>

            <MessengerWizardCard>
              <div className="border-b border-[var(--admin-border)] px-6 py-5">
                <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                  Sequence preview
                </h2>
              </div>
              <ol className="divide-y divide-[var(--admin-border)]">
                {timelineTouchpoints.map((point, index) => (
                  <li key={point.id} className="flex items-start gap-4 px-6 py-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-[var(--admin-on-surface)]">
                        {point.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                        {campaignChannelLabel(point.channel)} · Day {String(point.delayDays)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </MessengerWizardCard>

            {!readOnly ? (
              <MessengerWizardCard>
                <div className="border-b border-[var(--admin-border)] px-6 py-5">
                  <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
                    Launch timing
                  </h2>
                </div>
                <div className="space-y-4 px-6 py-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode("now");
                      }}
                      className={[
                        "rounded-xl border p-4 text-left transition-colors",
                        deliveryMode === "now"
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--admin-on-surface)]">
                        <Rocket
                          className="h-4 w-4 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                        Launch now
                      </span>
                      <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                        Day-zero touchpoints send immediately. Later steps follow their delays.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode("schedule");
                      }}
                      className={[
                        "rounded-xl border p-4 text-left transition-colors",
                        deliveryMode === "schedule"
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface-low)]",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2 text-[14px] font-bold text-[var(--admin-on-surface)]">
                        <Calendar
                          className="h-4 w-4 text-[var(--admin-primary)]"
                          aria-hidden="true"
                        />
                        Schedule later
                      </span>
                      <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
                        Pick a launch date. Delays count from that moment.
                      </p>
                    </button>
                  </div>
                  {deliveryMode === "schedule" ? (
                    <label className="block max-w-sm">
                      <span className={MESSENGER_WIZARD_LABEL_CLASS}>Launch date and time</span>
                      <input
                        type="datetime-local"
                        value={scheduleLocal}
                        onChange={(event) => {
                          setScheduleLocal(event.target.value);
                        }}
                        className={MESSENGER_WIZARD_FIELD_CLASS}
                      />
                    </label>
                  ) : null}
                </div>
              </MessengerWizardCard>
            ) : null}
          </div>

          <aside className="space-y-4">
            <MessengerWizardCard>
              <div className="border-b border-[var(--admin-border)] px-5 py-4">
                <h3 className="text-[15px] font-bold text-[var(--admin-on-surface)]">Checklist</h3>
              </div>
              <ul className="space-y-3 px-5 py-5">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        item.done
                          ? "bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]"
                          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      {item.done ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-on-surface-variant)]" />
                      )}
                    </span>
                    <span
                      className={[
                        "text-[13px]",
                        item.done
                          ? "font-semibold text-[var(--admin-on-surface)]"
                          : "text-[var(--admin-on-surface-variant)]",
                      ].join(" ")}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </MessengerWizardCard>

            {!readOnly ? (
              <button
                type="button"
                disabled={busy || !checklistComplete}
                onClick={() => {
                  void launchCampaign();
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                )}
                {deliveryMode === "schedule" ? "Schedule campaign" : "Launch campaign"}
              </button>
            ) : (
              <Link
                href={campaignAnalyticsHref(defined(campaign).id)}
                prefetch={false}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
              >
                View analytics
              </Link>
            )}
          </aside>
        </div>
      ) : null}

      <MessengerWizardFooter
        left={
          stepIndex > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={goPrev}
              className={`${manageSecondaryButtonClassName} inline-flex items-center gap-2`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
          ) : null
        }
        right={
          <>
            {!readOnly ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void saveDraftForStep();
                }}
                className={manageSecondaryButtonClassName}
              >
                Save draft
              </button>
            ) : null}
            {step !== "review" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void goNext();
                }}
                className={`${managePrimaryButtonClassName} inline-flex items-center gap-2`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </>
        }
      />

      {launchSuccessOpen && campaign ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-launch-success-title"
            className="w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg"
          >
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-12 w-12 text-[var(--admin-success)]" aria-hidden="true" />
              <h2
                id="campaign-launch-success-title"
                className="mt-4 text-lg font-semibold text-[var(--admin-on-surface)]"
              >
                Campaign {deliveryMode === "schedule" ? "scheduled" : "launched"}
              </h2>
              <p className="mt-2 text-[14px] text-[var(--admin-on-surface-variant)]">
                {campaign.title} is on its way. Track linked channel sends from analytics.
              </p>
              <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
                <Link
                  href={campaignAnalyticsHref(campaign.id)}
                  prefetch={false}
                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)]"
                >
                  View analytics
                </Link>
                <Link
                  href={CAMPAIGNS_HREF}
                  prefetch={false}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-[var(--admin-border)] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)]"
                >
                  Back to list
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
