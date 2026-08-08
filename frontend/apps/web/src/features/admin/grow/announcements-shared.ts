export const ANNOUNCEMENTS_LIST_HREF = "/admin/marketing/messenger/announcements";
export const ANNOUNCEMENTS_CREATE_HREF = "/admin/marketing/messenger/announcements/create";
export const MESSENGER_HREF = "/admin/marketing/messenger";

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_MESSAGE_MAX = 255;
export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 40 * 1024;
export const ANNOUNCEMENT_IMAGE_MAX_WIDTH = 600;
export const ANNOUNCEMENT_IMAGE_MAX_HEIGHT = 300;

export type AnnouncementType = "GENERAL" | "BATCH";

export type AnnouncementDto = {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  audienceBatchId: string | null;
  audienceLabel: string;
  deepLink: string | null;
  imageUrl: string | null;
  status: "SENT";
  recipientCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function formatAnnouncementDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatAnnouncementDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatAnnouncementMonthLabel(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatRecipientCount(count: number): string {
  return new Intl.NumberFormat(undefined).format(count);
}

/** Last N calendar months as YYYY-MM (UTC), newest first. */
export function recentAnnouncementMonths(count = 12): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const year = String(date.getUTCFullYear()).padStart(4, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

export function announcementTypeLabel(type: AnnouncementType): string {
  return type === "GENERAL" ? "General" : "Batch";
}

export function fileToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read image."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error("Could not read image."));
    };
    reader.readAsDataURL(file);
  });
}
