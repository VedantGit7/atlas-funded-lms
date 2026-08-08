const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPricingPlanIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export const PRICING_PLAN_OFFER_LABEL_MAX_LENGTH = 15;

const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function isPricingPlanDateTimeLocal(value: string): boolean {
  if (!DATE_TIME_LOCAL_PATTERN.test(value)) return false;
  const [datePart] = value.split("T");
  return datePart != null && isPricingPlanIsoDate(datePart);
}

export function toPricingPlanDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function defaultPricingPlanOfferStartAt(from = new Date()): string {
  return toPricingPlanDateTimeLocal(from);
}

export function splitPricingPlanDateTime(value: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!value) return { date: "", time: "" };

  const [datePart, timePart = ""] = value.split("T");
  return {
    date: datePart && isPricingPlanIsoDate(datePart) ? datePart : "",
    time: /^\d{2}:\d{2}/.test(timePart) ? timePart.slice(0, 5) : "",
  };
}

export function combinePricingPlanDateTime(date: string, time: string): string | null {
  if (!isPricingPlanIsoDate(date)) return null;
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${normalizedTime}`;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatPricingPlanOfferDate(isoDate: string): string {
  if (!isPricingPlanIsoDate(isoDate)) return isoDate;
  const date = new Date(`${isoDate}T00:00:00`);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}${ordinalSuffix(day)}, ${year}`;
}
