import type { TenantTx } from "@atlas/db";
import { getReportRun, listReportSchedules } from "./reports.service";
import type { ServiceCtx } from "./reports.types";

export type ReportDeliveryEmailSender = (input: {
  to: string;
  subject: string;
  body: string;
  requestId: string;
}) => Promise<void>;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readWebhookUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Delivers a succeeded report run via email and/or webhook using params_json
 * and optional schedule delivery_json.
 */
export async function deliverSucceededReportRun(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: {
    reportRunId: string;
    sendEmail: ReportDeliveryEmailSender | null;
    resolveMembershipEmail: (membershipId: string) => Promise<string | null>;
  },
): Promise<{ emailed: number; webhookDelivered: boolean; skipped: boolean }> {
  const detail = await getReportRun(tx, ctx, args.reportRunId);
  if (detail.data.status !== "SUCCEEDED" || !detail.data.download) {
    return { emailed: 0, webhookDelivered: false, skipped: true };
  }

  const params = detail.data.params;
  let deliveryMode =
    typeof params["deliveryMode"] === "string" ? params["deliveryMode"] : "download";

  let emails = asStringArray(params["deliveryEmails"]);
  let webhookUrl = readWebhookUrl(params["webhookUrl"]);

  if (detail.data.scheduleId) {
    const schedules = await listReportSchedules(tx, ctx);
    const schedule = schedules.data.items.find((item) => item.id === detail.data.scheduleId);
    const delivery = schedule?.delivery ?? null;
    if (delivery) {
      const scheduleEmails = asStringArray(delivery["emails"]);
      if (scheduleEmails.length > 0) emails = [...new Set([...emails, ...scheduleEmails])];
      const scheduleWebhook = readWebhookUrl(delivery["webhookUrl"]);
      if (scheduleWebhook) webhookUrl = scheduleWebhook;
      if (typeof delivery["mode"] === "string" && delivery["mode"].trim()) {
        deliveryMode = delivery["mode"];
      }
    }
  }

  if (deliveryMode === "email_me") {
    const actorEmail = await args.resolveMembershipEmail(detail.data.requestedByMembershipId);
    if (actorEmail) emails = [...new Set([actorEmail, ...emails])];
  }

  const shouldEmail = emails.length > 0;
  const shouldWebhook = Boolean(webhookUrl);

  if (!shouldEmail && !shouldWebhook) {
    return { emailed: 0, webhookDelivered: false, skipped: true };
  }

  const downloadUrl = detail.data.download.url;
  const expiresAt = detail.data.download.expiresAt;
  const title = detail.data.definitionTitle;
  let emailed = 0;

  if (shouldEmail && args.sendEmail) {
    const subject = `${title} export is ready`;
    const body = [
      `Your ${title} export is ready.`,
      "",
      `Format: ${detail.data.format.toUpperCase()}`,
      `Rows: ${detail.data.rowCount ?? 0}`,
      `Download (expires ${expiresAt}):`,
      downloadUrl,
      "",
      `Run ID: ${detail.data.id}`,
    ].join("\n");

    for (const to of emails) {
      await args.sendEmail({
        to,
        subject,
        body,
        requestId: `${ctx.requestId}:report-delivery:${detail.data.id}:${to}`,
      });
      emailed += 1;
    }
  }

  let webhookDelivered = false;
  if (shouldWebhook && webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-atlas-event": "report.run_succeeded",
        "x-request-id": ctx.requestId,
      },
      body: JSON.stringify({
        event: "report.run_succeeded",
        reportRunId: detail.data.id,
        definitionKey: detail.data.definitionKey,
        format: detail.data.format,
        rowCount: detail.data.rowCount,
        downloadUrl,
        expiresAt,
        completedAt: detail.data.completedAt,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`REPORT_WEBHOOK_FAILED:${response.status}`);
    }
    webhookDelivered = true;
  }

  return { emailed, webhookDelivered, skipped: false };
}
