"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { fetchBatches, type Batch } from "../domain/admin-domain-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  manageDangerButtonClassName,
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
} from "../manage/manage-ui-shared";
import {
  formatWhatsappDateTime,
  resolveWizardStep,
  WHATSAPP_LIST_HREF,
  whatsappCampaignHref,
  type CampaignDto,
  type Recipient,
  type TemplateDto,
  type WizardStep,
} from "./whatsapp-shared";

type CampaignResponse = { data: CampaignDto };
type RecipientsResponse = {
  data: { totalCount: number; withPhoneCount: number; items: Recipient[] };
};
type TemplatesResponse = { data: { items: TemplateDto[] } };

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--admin-on-surface)]";

const STEPS: ReadonlyArray<{ id: WizardStep; label: string }> = [
  { id: "title", label: "Title" },
  { id: "audience", label: "Recipients" },
  { id: "recipients", label: "Preview" },
  { id: "template", label: "Template" },
  { id: "delivery", label: "Send" },
];

type WhatsappWizardPanelProps = {
  campaignId?: string;
};

export function WhatsappWizardPanel({ campaignId }: WhatsappWizardPanelProps) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDto | null>(null);
  const [step, setStep] = useState<WizardStep>(campaignId ? "audience" : "title");
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [audienceType, setAudienceType] = useState<"ALL" | "GROUP">("ALL");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [withPhoneCount, setWithPhoneCount] = useState(0);

  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [testPhone, setTestPhone] = useState("");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [settingsTitle, setSettingsTitle] = useState("");

  const hydrateFromCampaign = useCallback(
    (next: CampaignDto, options?: { keepStep?: boolean }) => {
      setCampaign(next);
      setTitle(next.title);
      setSettingsTitle(next.title);
      if (next.audienceType) setAudienceType(next.audienceType);
      if (next.audienceBatchId) setBatchId(next.audienceBatchId);
      if (next.templateId) setSelectedTemplateId(next.templateId);
      if (next.scheduledAt) {
        const date = new Date(next.scheduledAt);
        if (!Number.isNaN(date.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          setScheduleLocal(
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
          );
        }
      }
      if (!options?.keepStep) {
        setStep(resolveWizardStep(next));
      }
    },
    [],
  );

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const response = await clientApi.get<CampaignResponse>(
          `/api/v1/marketing/whatsapp/campaigns/${campaignId}`,
        );
        if (cancelled) return;
        hydrateFromCampaign(response.data);
      } catch (caught) {
        if (!cancelled) {
          toast.error(
            caught instanceof ClientApiError ? caught.message : "Could not load WhatsApp campaign.",
          );
          router.replace(WHATSAPP_LIST_HREF);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
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

  const progressSteps = useMemo(() => {
    if (step === "settings") return [];
    return STEPS;
  }, [step]);

  async function loadRecipients(id: string) {
    const response = await clientApi.get<RecipientsResponse>(
      `/api/v1/marketing/whatsapp/campaigns/${id}/recipients`,
    );
    setRecipients(response.data.items);
    setRecipientTotal(response.data.totalCount);
    setWithPhoneCount(response.data.withPhoneCount);
  }

  async function loadTemplates() {
    const response = await clientApi.get<TemplatesResponse>(
      "/api/v1/marketing/whatsapp/templates",
    );
    setTemplates(response.data.items.filter((item) => item.status === "APPROVED"));
  }

  async function saveTitleAndNext() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Enter a title for this WhatsApp campaign.");
      return;
    }
    setBusy(true);
    try {
      if (!campaign) {
        const response = await clientApi.post<CampaignResponse>(
          "/api/v1/marketing/whatsapp/campaigns",
          { title: trimmed },
          "whatsapp-campaign-create",
          { silent: true },
        );
        toast.success("Draft created.");
        router.replace(whatsappCampaignHref(response.data.id));
        return;
      }
      const response = await clientApi.patch<CampaignResponse>(
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}`,
        { title: trimmed },
        `whatsapp-campaign-title-${campaign.id}`,
        { silent: true },
      );
      hydrateFromCampaign(response.data);
      setStep(response.data.audienceType ? "recipients" : "audience");
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save title.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAudienceAndNext() {
    if (!campaign) return;
    if (audienceType === "GROUP" && !batchId) {
      toast.error("Select a group (batch) for recipients.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}/audience`,
        {
          audienceType,
          ...(audienceType === "GROUP" ? { audienceBatchId: batchId } : {}),
        },
        `whatsapp-campaign-audience-${campaign.id}`,
        { silent: true },
      );
      hydrateFromCampaign(response.data);
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

  async function goToTemplate() {
    if (!campaign) return;
    setBusy(true);
    try {
      if (recipients.length === 0 && recipientTotal === 0) {
        await loadRecipients(campaign.id);
      }
      await loadTemplates();
      setStep("template");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load templates.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplateAndNext() {
    if (!campaign) return;
    if (!selectedTemplateId) {
      toast.error("Select an approved template.");
      return;
    }
    setBusy(true);
    try {
      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}/template`,
        { templateId: selectedTemplateId },
        `whatsapp-campaign-template-${campaign.id}`,
        { silent: true },
      );
      hydrateFromCampaign(response.data);
      setStep("delivery");
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not save template.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendCampaign(mode: "now" | "schedule" | "test") {
    if (!campaign) return;
    if (mode === "schedule" && !scheduleLocal) {
      toast.error("Pick a schedule date and time.");
      return;
    }
    if (mode === "test" && !testPhone.trim()) {
      toast.error("Enter a test phone number.");
      return;
    }

    setBusy(true);
    try {
      const bodyPayload =
        mode === "now"
          ? { mode: "now" as const }
          : mode === "test"
            ? { mode: "test" as const, testPhone: testPhone.trim() }
            : {
                mode: "schedule" as const,
                scheduledAt: new Date(scheduleLocal).toISOString(),
              };

      const response = await clientApi.post<CampaignResponse>(
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}/send`,
        bodyPayload,
        `whatsapp-campaign-send-${campaign.id}`,
        { silent: true },
      );

      if (mode === "now") {
        toast.success(
          `Sent to ${response.data.deliveredCount} learner(s) (${response.data.failedCount} failed).`,
        );
      } else if (mode === "test") {
        toast.success("Test message sent.");
      } else {
        toast.success(`Scheduled for ${formatWhatsappDateTime(response.data.scheduledAt)}.`);
      }
      router.push(WHATSAPP_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not send campaign.");
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
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}`,
        { title: trimmed },
        `whatsapp-campaign-title-${campaign.id}`,
      );
      hydrateFromCampaign(response.data, { keepStep: true });
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
        `/api/v1/marketing/whatsapp/campaigns/${campaign.id}/delete`,
        { titleConfirmation: deleteConfirm },
        `whatsapp-campaign-delete-${campaign.id}`,
      );
      router.push(WHATSAPP_LIST_HREF);
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete campaign.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!campaign?.audienceType || (step !== "recipients" && step !== "template")) return;
    if (recipients.length > 0 || recipientTotal > 0) return;
    void loadRecipients(campaign.id).catch(() => {
      /* toast on explicit actions */
    });
  }, [campaign, step, recipients.length, recipientTotal]);

  useEffect(() => {
    if (step !== "template" || templates.length > 0) return;
    void loadTemplates().catch(() => {
      /* toast on explicit actions */
    });
  }, [step, templates.length]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href={WHATSAPP_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </Link>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading WhatsApp campaign…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={WHATSAPP_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </Link>

      <header className="space-y-2">
        <h1 className={managePageTitleClassName}>
          {campaign ? campaign.title : "Create WhatsApp Message"}
        </h1>
        <p className={`${managePageDescClassName} max-w-2xl`}>
          {step === "settings"
            ? "Edit campaign settings or delete this WhatsApp message."
            : "Choose recipients, select an approved template, and send or schedule your campaign."}
        </p>
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
      </header>

      {progressSteps.length > 0 ? (
        <ol className="flex flex-wrap gap-2">
          {progressSteps.map((entry, index) => {
            const active = entry.id === step;
            const stepIndex = progressSteps.findIndex((s) => s.id === step);
            const done = index < stepIndex;
            return (
              <li
                key={entry.id}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide",
                  active
                    ? "bg-[var(--admin-on-surface)] text-[var(--admin-surface)]"
                    : done
                      ? "bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] text-[var(--admin-success)]"
                      : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                ].join(" ")}
              >
                {index + 1}. {entry.label}
              </li>
            );
          })}
        </ol>
      ) : null}

      {step === "title" ? (
        <section className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <label className="block">
            <span className={LABEL_CLASS}>Title</span>
            <input
              type="text"
              value={title}
              maxLength={200}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="Internal title (not shown to learners)"
              className={FIELD_CLASS}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className={managePrimaryButtonClassName}
            onClick={() => {
              void saveTitleAndNext();
            }}
          >
            Save &amp; Next
          </button>
        </section>
      ) : null}

      {step === "audience" && campaign ? (
        <section className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Recipient selection is permanent for this campaign once saved.
          </p>
          <fieldset className="space-y-3" disabled={Boolean(campaign.audienceType)}>
            <legend className={LABEL_CLASS}>Send to</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="audience"
                checked={audienceType === "ALL"}
                onChange={() => {
                  setAudienceType("ALL");
                }}
                className="accent-[var(--admin-primary)]"
              />
              All learners
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="audience"
                checked={audienceType === "GROUP"}
                onChange={() => {
                  setAudienceType("GROUP");
                }}
                className="accent-[var(--admin-primary)]"
              />
              Group (batch)
            </label>
          </fieldset>
          {audienceType === "GROUP" ? (
            <label className="block">
              <span className={LABEL_CLASS}>Group</span>
              <select
                value={batchId}
                disabled={Boolean(campaign.audienceType)}
                onChange={(event) => {
                  setBatchId(event.target.value);
                }}
                className={FIELD_CLASS}
              >
                <option value="">Select a batch…</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {campaign.audienceType ? (
            <button
              type="button"
              disabled={busy}
              className={managePrimaryButtonClassName}
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
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className={managePrimaryButtonClassName}
              onClick={() => {
                void saveAudienceAndNext();
              }}
            >
              Save recipients &amp; Next
            </button>
          )}
        </section>
      ) : null}

      {step === "recipients" && campaign ? (
        <section className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--admin-on-surface)]">
                Recipient preview
              </h2>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {campaign.audienceLabel ?? "Audience"} · {recipientTotal} learner
                {recipientTotal === 1 ? "" : "s"} · {withPhoneCount} with phone
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              className={managePrimaryButtonClassName}
              onClick={() => {
                void goToTemplate();
              }}
            >
              Select template
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--admin-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Name
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Email
                  </th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody>
                {recipients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-6 text-center text-[var(--admin-on-surface-variant)]"
                    >
                      No active learners in this audience.
                    </td>
                  </tr>
                ) : (
                  recipients.map((row) => (
                    <tr
                      key={row.membershipId}
                      className="border-b border-[var(--admin-border)] last:border-b-0"
                    >
                      <td className="px-3 py-2">{row.displayName ?? "—"}</td>
                      <td className="px-3 py-2">{row.email ?? "—"}</td>
                      <td className="px-3 py-2">{row.phone ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {recipientTotal > recipients.length ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Showing first {recipients.length} of {recipientTotal}.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "template" && campaign ? (
        <section className="max-w-2xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <h2 className="text-base font-bold text-[var(--admin-on-surface)]">
            Select approved template
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              No approved templates yet. Create one from Manage templates on the WhatsApp home page.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id;
                return (
                  <label
                    key={template.id}
                    className={[
                      "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                      selected
                        ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:border-[var(--admin-outline)]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={selected}
                      onChange={() => {
                        setSelectedTemplateId(template.id);
                      }}
                      className="mt-1 accent-[var(--admin-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--admin-on-surface)]">
                          {template.name}
                        </span>
                        <span className={manageStatusChipClassName("success")}>APPROVED</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                        {template.body}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <button
            type="button"
            disabled={busy || !selectedTemplateId}
            className={managePrimaryButtonClassName}
            onClick={() => {
              void saveTemplateAndNext();
            }}
          >
            Save template &amp; Next
          </button>
        </section>
      ) : null}

      {step === "delivery" && campaign ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
          <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <label className="block">
              <span className={LABEL_CLASS}>Test phone (optional)</span>
              <input
                type="text"
                value={testPhone}
                onChange={(event) => {
                  setTestPhone(event.target.value);
                }}
                className={FIELD_CLASS}
                placeholder="+15551234567"
              />
              <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                Send a test message before broadcasting to the full audience.
              </span>
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Schedule for (optional)</span>
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(event) => {
                  setScheduleLocal(event.target.value);
                }}
                className={FIELD_CLASS}
              />
            </label>
            <div className="flex flex-wrap gap-2 border-t border-[var(--admin-border)] pt-4">
              <button
                type="button"
                disabled={busy || !testPhone.trim()}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  void sendCampaign("test");
                }}
              >
                Send test
              </button>
              <button
                type="button"
                disabled={busy || !scheduleLocal}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  void sendCampaign("schedule");
                }}
              >
                Schedule
              </button>
              <button
                type="button"
                disabled={busy}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  void sendCampaign("now");
                }}
              >
                Send now
              </button>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Summary
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="text-[var(--admin-on-surface-variant)]">Audience:</span>{" "}
                {campaign.audienceLabel ?? "—"}
              </p>
              <p>
                <span className="text-[var(--admin-on-surface-variant)]">Recipients:</span>{" "}
                {campaign.recipientCount}
              </p>
              <p>
                <span className="text-[var(--admin-on-surface-variant)]">Template:</span>{" "}
                {campaign.templateName ?? "—"}
              </p>
              {campaign.templateBody ? (
                <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                  <p className="text-[var(--admin-on-surface-variant)]">{campaign.templateBody}</p>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      ) : null}

      {step === "settings" && campaign ? (
        <section className="max-w-xl space-y-6">
          <div className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
            <h2 className="text-base font-bold text-[var(--admin-on-surface)]">Edit title</h2>
            <label className="block">
              <span className={LABEL_CLASS}>Title</span>
              <input
                type="text"
                value={settingsTitle}
                maxLength={200}
                onChange={(event) => {
                  setSettingsTitle(event.target.value);
                }}
                className={FIELD_CLASS}
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
            {campaign.status !== "SENT" ? (
              <button
                type="button"
                className={`${manageSecondaryButtonClassName} ml-2`}
                onClick={() => {
                  setStep(resolveWizardStep(campaign));
                }}
              >
                Continue editing
              </button>
            ) : null}
          </div>

          <div className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[var(--admin-surface)] p-5 shadow-sm">
            <h2 className="text-base font-bold text-[var(--admin-danger)]">Delete campaign</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{campaign.title}</span>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={FIELD_CLASS}
              placeholder="Exact title"
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
        </section>
      ) : null}
    </div>
  );
}
