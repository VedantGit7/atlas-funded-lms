import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { mergeCourseAccessIntoTags, parseCourseAccessFromTags } from "./course-access-settings";
import { PRICING_PLAN_DEFAULT_LOCATION } from "./pricing-plan-location-options";
import { defaultPricingPlanOfferStartAt } from "./pricing-plan-datetime-utils";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

const PRICING_PLANS_TAG_KEY = "studioPricingPlans";

export type CoursePricingPlanStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type CoursePricingPlanType = "FREE" | "PAID";
export type CoursePricingPlanAccessibility = "PUBLIC" | "PRIVATE";
export type CoursePricingPlanValidityMode = "VALIDITY" | "EXPIRY";
export type CoursePricingPlanAudienceType = "NORMAL" | "RENEWAL";

export const PRICING_PLAN_TITLE_MAX_LENGTH = 60;
export const PRICING_PLAN_SHORT_DESCRIPTION_MAX_LENGTH = 255;

export { PRICING_PLAN_OFFER_LABEL_MAX_LENGTH } from "./pricing-plan-datetime-utils";

export {
  PRICING_PLAN_DEFAULT_LOCATION,
  PRICING_PLAN_LOCATION_OPTIONS,
  resolvePricingPlanLocation,
  type PricingPlanLocationOption,
} from "./pricing-plan-location-options";

export type CoursePricingPlanKind =
  | "FREE"
  | "ONE_TIME"
  | "LIMITED_TIME"
  | "AUTOPAY"
  | "INSTALMENT_DEPRECATED"
  | "CUSTOM_INSTALMENT";

export type PricingPlanKindOption = {
  kind: CoursePricingPlanKind;
  title: string;
  description: string;
  deactivated?: boolean;
};

export const PRICING_PLAN_KIND_OPTIONS: PricingPlanKindOption[] = [
  {
    kind: "FREE",
    title: "Free Plan",
    description: "You can set a free plan for your course",
  },
  {
    kind: "ONE_TIME",
    title: "One Time Purchase Plan",
    description: "You can set a fixed purchase amount for your course",
  },
  {
    kind: "LIMITED_TIME",
    title: "Limited Time Offer Plan",
    description: "You can offer a discounted amount on any course for a limited time",
  },
  {
    kind: "AUTOPAY",
    title: "Autopay",
    description: "Charge learners on a recurring monthly basis with autopay plans",
    deactivated: true,
  },
  {
    kind: "INSTALMENT_DEPRECATED",
    title: "Instalment Purchase Plan",
    description: "You can set amount in instalments for your course",
    deactivated: true,
  },
  {
    kind: "CUSTOM_INSTALMENT",
    title: "Custom Instalment",
    description: "You can set amount and due days in instalments for your course",
    deactivated: true,
  },
];

export type CoursePricingPlanItem = {
  id: string;
  title: string;
  planKind: CoursePricingPlanKind;
  type: CoursePricingPlanType;
  priceCents: number;
  currency: string;
  validityDays: number;
  location: string;
  isDefault: boolean;
  oneToOneTemplate: string | null;
  paymentGateway: string | null;
  checkoutUrl: string | null;
  accessibility: CoursePricingPlanAccessibility;
  status: CoursePricingPlanStatus;
  position: number;
  shortDescription: string;
  longDescription: string;
  validityMode: CoursePricingPlanValidityMode;
  expiryDate: string | null;
  renewalPlanId: string | null;
  allowReEnroll: boolean;
  audienceType: CoursePricingPlanAudienceType;
  discountPriceCents: number | null;
  trialDurationDays: number;
  allowCouponCode: boolean;
  offerLabel: string;
  coursePriceCents: number | null;
  offerStartAt: string | null;
  offerEndAt: string | null;
};

export const PRICING_PLAN_STATUS_TABS = [
  "ALL",
  "DRAFT",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type PricingPlanStatusTab = (typeof PRICING_PLAN_STATUS_TABS)[number];

export const PRICING_PLAN_TABLE_COLUMNS = [
  { id: "title", label: "Title" },
  { id: "type", label: "Type" },
  { id: "price", label: "Price" },
  { id: "validity", label: "Validity" },
  { id: "location", label: "Location" },
  { id: "oneToOneTemplate", label: "1:1 Template" },
  { id: "paymentGateway", label: "Payment Gateway" },
  { id: "checkoutUrl", label: "Fast checkout link" },
  { id: "accessibility", label: "Accessibility" },
] as const;

export type PricingPlanTableColumnId = (typeof PRICING_PLAN_TABLE_COLUMNS)[number]["id"];

function isPlanType(value: unknown): value is CoursePricingPlanType {
  return value === "FREE" || value === "PAID";
}

function isPlanStatus(value: unknown): value is CoursePricingPlanStatus {
  return (
    value === "DRAFT" || value === "PUBLISHED" || value === "UNPUBLISHED" || value === "ARCHIVED"
  );
}

function isPlanAccessibility(value: unknown): value is CoursePricingPlanAccessibility {
  return value === "PUBLIC" || value === "PRIVATE";
}

function isPlanKind(value: unknown): value is CoursePricingPlanKind {
  return PRICING_PLAN_KIND_OPTIONS.some((option) => option.kind === value);
}

function inferPlanKind(type: CoursePricingPlanType, rawKind: unknown): CoursePricingPlanKind {
  if (isPlanKind(rawKind)) return rawKind;
  return type === "FREE" ? "FREE" : "ONE_TIME";
}

function isValidityMode(value: unknown): value is CoursePricingPlanValidityMode {
  return value === "VALIDITY" || value === "EXPIRY";
}

function isAudienceType(value: unknown): value is CoursePricingPlanAudienceType {
  return value === "NORMAL" || value === "RENEWAL";
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isPricingPlanIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

export function toPricingPlanIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultPricingPlanExpiryDate(from = new Date()): string {
  const date = new Date(from);
  date.setFullYear(date.getFullYear() + 1);
  return toPricingPlanIsoDate(date);
}

export function resolvePricingPlanExpiryDate(
  expiryDate: string | null | undefined,
  validityDays: number,
): string {
  if (expiryDate && isPricingPlanIsoDate(expiryDate)) return expiryDate;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, validityDays));
  return toPricingPlanIsoDate(date);
}

export function formatPricingPlanExpiryDate(isoDate: string): string {
  if (!isPricingPlanIsoDate(isoDate)) return isoDate;
  const date = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function validityDaysUntilPricingPlanExpiry(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${isoDate}T00:00:00`);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function defaultFreePlanFields(): Pick<
  CoursePricingPlanItem,
  | "shortDescription"
  | "longDescription"
  | "validityMode"
  | "expiryDate"
  | "renewalPlanId"
  | "allowReEnroll"
  | "audienceType"
  | "discountPriceCents"
  | "trialDurationDays"
  | "allowCouponCode"
  | "offerLabel"
  | "coursePriceCents"
  | "offerStartAt"
  | "offerEndAt"
> {
  return {
    shortDescription: "",
    longDescription: "",
    validityMode: "VALIDITY",
    expiryDate: null,
    renewalPlanId: null,
    allowReEnroll: false,
    audienceType: "NORMAL",
    discountPriceCents: null,
    trialDurationDays: 0,
    allowCouponCode: false,
    offerLabel: "",
    coursePriceCents: null,
    offerStartAt: null,
    offerEndAt: null,
  };
}

function mapCourseStatusToPlanStatus(
  courseStatus: CourseDetail["status"],
): CoursePricingPlanStatus {
  if (courseStatus === "PUBLISHED") return "PUBLISHED";
  if (courseStatus === "ARCHIVED") return "ARCHIVED";
  if (courseStatus === "DRAFT") return "UNPUBLISHED";
  return "DRAFT";
}

export function createDefaultCoursePricingPlan(course: CourseDetail): CoursePricingPlanItem {
  return {
    id: "base-plan",
    title: "Base plan",
    planKind: course.accessTier === "FREE" ? "FREE" : "ONE_TIME",
    type: course.accessTier,
    priceCents: course.priceCents ?? 0,
    currency: course.currency ?? "USD",
    location: PRICING_PLAN_DEFAULT_LOCATION,
    isDefault: true,
    oneToOneTemplate: null,
    paymentGateway: "Razorpay",
    checkoutUrl: null,
    accessibility: "PUBLIC",
    status: mapCourseStatusToPlanStatus(course.status),
    position: 0,
    ...defaultFreePlanFields(),
    validityDays: 365,
  };
}

function parsePricingPlanItems(raw: unknown): CoursePricingPlanItem[] {
  if (!Array.isArray(raw)) return [];

  const items: CoursePricingPlanItem[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record["id"] === "string" ? record["id"] : "";
    const title = typeof record["title"] === "string" ? record["title"].trim() : "";
    const type = isPlanType(record["type"]) ? record["type"] : "FREE";
    const priceCents =
      typeof record["priceCents"] === "number" && Number.isFinite(record["priceCents"])
        ? Math.max(0, Math.round(record["priceCents"]))
        : 0;
    const currency =
      typeof record["currency"] === "string" && record["currency"].trim().length === 3
        ? record["currency"].trim().toUpperCase()
        : "USD";
    const validityDays =
      typeof record["validityDays"] === "number" && Number.isFinite(record["validityDays"])
        ? Math.max(1, Math.round(record["validityDays"]))
        : 31;
    const location =
      typeof record["location"] === "string" && record["location"].trim().length > 0
        ? record["location"].trim()
        : PRICING_PLAN_DEFAULT_LOCATION;
    const isDefault = record["isDefault"] === true;
    const oneToOneTemplate =
      typeof record["oneToOneTemplate"] === "string" && record["oneToOneTemplate"].trim().length > 0
        ? record["oneToOneTemplate"].trim()
        : null;
    const paymentGateway =
      typeof record["paymentGateway"] === "string" && record["paymentGateway"].trim().length > 0
        ? record["paymentGateway"].trim()
        : null;
    const checkoutUrl =
      typeof record["checkoutUrl"] === "string" && record["checkoutUrl"].trim().length > 0
        ? record["checkoutUrl"].trim()
        : null;
    const accessibility = isPlanAccessibility(record["accessibility"])
      ? record["accessibility"]
      : "PUBLIC";
    const status = isPlanStatus(record["status"]) ? record["status"] : "DRAFT";
    const position =
      typeof record["position"] === "number" && Number.isFinite(record["position"])
        ? record["position"]
        : items.length;
    const shortDescription =
      typeof record["shortDescription"] === "string" ? record["shortDescription"].trim() : "";
    const longDescription =
      typeof record["longDescription"] === "string" ? record["longDescription"].trim() : "";
    const validityMode = isValidityMode(record["validityMode"])
      ? record["validityMode"]
      : "VALIDITY";
    const rawExpiryDate =
      typeof record["expiryDate"] === "string" ? record["expiryDate"].trim() : "";
    const expiryDate = rawExpiryDate && isPricingPlanIsoDate(rawExpiryDate) ? rawExpiryDate : null;
    const renewalPlanId =
      typeof record["renewalPlanId"] === "string" && record["renewalPlanId"].length > 0
        ? record["renewalPlanId"]
        : null;
    const allowReEnroll = record["allowReEnroll"] === true;
    const audienceType = isAudienceType(record["audienceType"]) ? record["audienceType"] : "NORMAL";
    const discountPriceCents =
      typeof record["discountPriceCents"] === "number" &&
      Number.isFinite(record["discountPriceCents"])
        ? Math.max(0, Math.round(record["discountPriceCents"]))
        : null;
    const trialDurationDays =
      typeof record["trialDurationDays"] === "number" &&
      Number.isFinite(record["trialDurationDays"])
        ? Math.max(0, Math.round(record["trialDurationDays"]))
        : 0;
    const allowCouponCode = record["allowCouponCode"] === true;
    const offerLabel = typeof record["offerLabel"] === "string" ? record["offerLabel"].trim() : "";
    const coursePriceCents =
      typeof record["coursePriceCents"] === "number" && Number.isFinite(record["coursePriceCents"])
        ? Math.max(0, Math.round(record["coursePriceCents"]))
        : null;
    const rawOfferStartAt =
      typeof record["offerStartAt"] === "string" ? record["offerStartAt"].trim() : "";
    const offerStartAt = rawOfferStartAt.length > 0 ? rawOfferStartAt : null;
    const rawOfferEndAt =
      typeof record["offerEndAt"] === "string" ? record["offerEndAt"].trim() : "";
    const offerEndAt = rawOfferEndAt.length > 0 ? rawOfferEndAt : null;

    if (!id || !title) continue;

    items.push({
      id,
      title,
      planKind: inferPlanKind(type, record["planKind"]),
      type,
      priceCents,
      currency,
      validityDays,
      location,
      isDefault,
      oneToOneTemplate,
      paymentGateway,
      checkoutUrl,
      accessibility,
      status,
      position,
      shortDescription,
      longDescription,
      validityMode,
      expiryDate,
      renewalPlanId,
      allowReEnroll,
      audienceType,
      discountPriceCents,
      trialDurationDays,
      allowCouponCode,
      offerLabel,
      coursePriceCents,
      offerStartAt,
      offerEndAt,
    });
  }

  return items.sort((a, b) => a.position - b.position);
}

export function storedCoursePricingPlansFromDetail(course: CourseDetail): CoursePricingPlanItem[] {
  const raw = course.tags?.[PRICING_PLANS_TAG_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }

  const record = raw as Record<string, unknown>;
  return parsePricingPlanItems(record["items"]);
}

export function coursePricingPlansFromDetail(course: CourseDetail): CoursePricingPlanItem[] {
  const stored = storedCoursePricingPlansFromDetail(course);
  if (stored.length > 0) return stored;
  return [createDefaultCoursePricingPlan(course)];
}

export function hasStoredCoursePricingPlans(course: CourseDetail): boolean {
  return storedCoursePricingPlansFromDetail(course).length > 0;
}

export function mergeCoursePricingPlansIntoTags(
  tags: Record<string, unknown> | undefined,
  items: CoursePricingPlanItem[],
): Record<string, unknown> {
  const access = parseCourseAccessFromTags(tags);

  return mergeCourseAccessIntoTags(
    {
      ...(tags ?? {}),
      [PRICING_PLANS_TAG_KEY]: {
        items: items.map((item, index) => ({
          id: item.id,
          title: item.title.trim(),
          planKind: item.planKind,
          type: item.type,
          priceCents: item.type === "FREE" ? 0 : item.priceCents,
          currency: item.currency.trim().toUpperCase(),
          validityDays: item.validityDays,
          location: item.location.trim(),
          isDefault: item.isDefault,
          oneToOneTemplate: item.oneToOneTemplate,
          paymentGateway: item.paymentGateway,
          checkoutUrl: item.checkoutUrl,
          accessibility: item.accessibility,
          status: item.status,
          position: index,
          shortDescription: item.shortDescription.trim(),
          longDescription: item.longDescription.trim(),
          validityMode: item.validityMode,
          expiryDate: item.expiryDate,
          renewalPlanId: item.renewalPlanId,
          allowReEnroll: item.allowReEnroll,
          audienceType: item.audienceType,
          discountPriceCents: item.discountPriceCents,
          trialDurationDays: item.trialDurationDays,
          allowCouponCode: item.allowCouponCode,
          offerLabel: item.offerLabel.trim(),
          coursePriceCents: item.coursePriceCents,
          offerStartAt: item.offerStartAt,
          offerEndAt: item.offerEndAt,
        })),
      },
    },
    access,
  );
}

export function buildCoursePricingPlansUpdatePayload(
  course: CourseDetail,
  items: CoursePricingPlanItem[],
) {
  const defaultPlan = items.find((item) => item.isDefault) ?? items[0];

  return {
    tags: mergeCoursePricingPlansIntoTags(course.tags, items),
    ...(defaultPlan
      ? {
          accessTier: defaultPlan.type,
          priceCents: defaultPlan.type === "PAID" ? defaultPlan.priceCents : null,
          currency: defaultPlan.currency,
        }
      : {}),
  };
}

export function resolvePlanCheckoutUrl(
  course: CourseDetail,
  plan: CoursePricingPlanItem,
): string | null {
  if (plan.checkoutUrl) return plan.checkoutUrl;
  if (typeof window === "undefined") return null;
  return `${window.location.origin}/courses/${course.slug}?plan=${plan.id}`;
}

export function formatPricingPlanPrice(plan: CoursePricingPlanItem): string {
  if (plan.type === "FREE" || plan.priceCents <= 0) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: plan.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(0);
    } catch {
      return `${plan.currency} 0`;
    }
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currency,
    }).format(plan.priceCents / 100);
  } catch {
    return `${plan.currency} ${(plan.priceCents / 100).toFixed(2)}`;
  }
}

export function formatPricingPlanType(plan: CoursePricingPlanItem): string {
  switch (plan.planKind) {
    case "FREE":
      return "Free";
    case "ONE_TIME":
      return "Paid";
    case "LIMITED_TIME":
      return "Limited offer";
    case "AUTOPAY":
      return "Autopay";
    case "INSTALMENT_DEPRECATED":
      return "Instalment";
    case "CUSTOM_INSTALMENT":
      return "Custom instalment";
    default:
      return plan.type === "FREE" ? "Free" : "Paid";
  }
}

export function pricingPlanKindLabel(kind: CoursePricingPlanKind): string {
  return PRICING_PLAN_KIND_OPTIONS.find((option) => option.kind === kind)?.title ?? kind;
}

export function createPricingPlanDraftFromKind(
  course: CourseDetail,
  existingPlans: CoursePricingPlanItem[],
  kind: CoursePricingPlanKind,
): Omit<CoursePricingPlanItem, "id" | "position"> {
  const option = PRICING_PLAN_KIND_OPTIONS.find((item) => item.kind === kind);
  const isFree = kind === "FREE";

  return {
    title: option?.title ?? "",
    planKind: kind,
    type: isFree ? "FREE" : "PAID",
    priceCents: isFree ? 0 : (course.priceCents ?? 0),
    currency: course.currency ?? "USD",
    validityDays: kind === "FREE" || kind === "ONE_TIME" || kind === "LIMITED_TIME" ? 365 : 31,
    location: PRICING_PLAN_DEFAULT_LOCATION,
    isDefault: existingPlans.length === 0,
    oneToOneTemplate: null,
    paymentGateway: null,
    checkoutUrl: null,
    accessibility: "PUBLIC",
    status: "DRAFT",
    ...defaultFreePlanFields(),
    ...(isFree ? { title: "Free Plan" } : {}),
    ...(kind === "ONE_TIME"
      ? {
          title: "One Time Payment Plan",
          allowCouponCode: true,
        }
      : {}),
    ...(kind === "LIMITED_TIME"
      ? {
          title: "Limited time offer plan",
          allowCouponCode: true,
          coursePriceCents: course.priceCents ?? 0,
          priceCents: 0,
          offerStartAt: defaultPricingPlanOfferStartAt(),
        }
      : {}),
  };
}

export function createEmptyPricingPlanDraft(
  course: CourseDetail,
  existingPlans: CoursePricingPlanItem[],
  kind: CoursePricingPlanKind = "FREE",
): Omit<CoursePricingPlanItem, "id" | "position"> {
  return createPricingPlanDraftFromKind(course, existingPlans, kind);
}

export function formatPricingPlanValidity(plan: CoursePricingPlanItem): string {
  if (plan.validityMode === "EXPIRY") {
    const expiryDate = plan.expiryDate ?? resolvePricingPlanExpiryDate(null, plan.validityDays);
    return formatPricingPlanExpiryDate(expiryDate);
  }

  const days = plan.validityDays;
  return `${days} ${days === 1 ? "day" : "days"}`;
}
