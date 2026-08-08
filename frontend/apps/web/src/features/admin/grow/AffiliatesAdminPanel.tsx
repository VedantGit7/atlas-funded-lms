"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Banknote,
  ChevronLeft,
  HandCoins,
  Info,
  Lightbulb,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { formatMoney } from "./coupons-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  ADMIN_SALES_HREF,
  commissionStatusBadgeClass,
  configFieldsEqual,
  DASHBOARD_HREF,
  DEFAULT_CONFIG,
  formatAffiliateDate,
  formatAffiliateDateTime,
  formatPctOverride,
  maskBankAccount,
  parseOptionalPct,
  partnerInitials,
  partnerLabel,
  partnerStatusBadgeClass,
  partnerStatusLabel,
  pctInputValue,
  requestApplicantLabel,
  statCardSurfaceClassName,
  TABS,
  TIER_OPTIONS,
  tierBadgeClass,
  tierLabel,
  type AdminAffiliateTab,
  type AffiliateCommission,
  type AffiliateConfig,
  type AffiliatePartner,
  type AffiliatePayout,
  type AffiliateProduct,
  type AffiliateRequest,
  type AffiliateSummary,
  type MemberSearchOption,
  type StudioCourseOption,
} from "./affiliates-shared";

const DEFAULT_CURRENCY = "USD";

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}

function StatCard(props: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className={statCardSurfaceClassName()}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">{props.hint}</p>
      ) : null}
    </div>
  );
}

function Badge(props: { className: string; children: ReactNode }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        props.className,
      ].join(" ")}
    >
      {props.children}
    </span>
  );
}

type ProductRowDraft = {
  enabled: boolean;
  standardDiscountPct: string;
  standardCommissionPct: string;
  premiumDiscountPct: string;
  premiumCommissionPct: string;
};

function productToDraft(product: AffiliateProduct | null, enabledDefault: boolean): ProductRowDraft {
  return {
    enabled: product?.enabled ?? enabledDefault,
    standardDiscountPct: pctInputValue(product?.standardDiscountPct),
    standardCommissionPct: pctInputValue(product?.standardCommissionPct),
    premiumDiscountPct: pctInputValue(product?.premiumDiscountPct),
    premiumCommissionPct: pctInputValue(product?.premiumCommissionPct),
  };
}

function MemberSearchField(props: {
  id: string;
  label: string;
  value: MemberSearchOption | null;
  onChange: (member: MemberSearchOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (props.value) {
      setQuery(props.value.label);
    }
  }, [props.value]);

  async function search(term: string) {
    setQuery(term);
    if (props.value && term !== props.value.label) {
      props.onChange(null);
    }
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await clientApi.get<{
        data: {
          items: Array<{
            id: string;
            invitedEmail: string | null;
            profile: { displayName: string | null } | null;
          }>;
        };
      }>(
        `/api/v1/members?search=${encodeURIComponent(term.trim())}&limit=10&status=ACTIVE`,
      );
      setResults(
        response.data.items.map((member) => ({
          id: member.id,
          label: member.profile?.displayName ?? member.invitedEmail ?? member.id,
          email: member.invitedEmail,
        })),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className={MESSENGER_WIZARD_LABEL_CLASS}>
        {props.label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <input
          id={props.id}
          value={query}
          disabled={props.disabled}
          placeholder="Search by name or email…"
          onChange={(event) => {
            void search(event.target.value);
          }}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 pl-9`}
        />
      </div>
      {searching ? (
        <p className="text-xs text-[var(--admin-on-surface-variant)]">Searching…</p>
      ) : null}
      {results.length > 0 && !props.value ? (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 shadow-sm">
          {results.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  props.onChange(member);
                  setQuery(member.label);
                  setResults([]);
                }}
              >
                <span className="font-medium text-[var(--admin-on-surface)]">{member.label}</span>
                {member.email ? (
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">
                    {member.email}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {props.value ? (
        <p className="text-xs text-[var(--admin-success)]">
          Selected: {props.value.label}
          {props.value.email ? ` (${props.value.email})` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function AffiliatesAdminPanel() {
  const [tab, setTab] = useState<AdminAffiliateTab>("settings");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);

  const [config, setConfig] = useState<AffiliateConfig | null>(null);
  const [draft, setDraft] = useState<AffiliateConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [courses, setCourses] = useState<StudioCourseOption[]>([]);
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductRowDraft>>({});
  const [savingProductIds, setSavingProductIds] = useState<Set<string>>(new Set());
  const [addCourseId, setAddCourseId] = useState("");

  const [partners, setPartners] = useState<AffiliatePartner[]>([]);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [debouncedPartnerQuery, setDebouncedPartnerQuery] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerDraft, setPartnerDraft] = useState<{
    tier: AffiliatePartner["tier"];
    status: AffiliatePartner["status"];
    couponCode: string;
    payoutUpi: string;
    payoutBankAccount: string;
    payoutIfsc: string;
    payoutAccountName: string;
  } | null>(null);
  const [partnerCommissions, setPartnerCommissions] = useState<AffiliateCommission[]>([]);
  const [partnerPayouts, setPartnerPayouts] = useState<AffiliatePayout[]>([]);
  const [partnerDetailLoading, setPartnerDetailLoading] = useState(false);
  const [updatingPartner, setUpdatingPartner] = useState(false);
  const [createMember, setCreateMember] = useState<MemberSearchOption | null>(null);
  const [createTier, setCreateTier] = useState<AffiliatePartner["tier"]>("STANDARD");
  const [createCoupon, setCreateCoupon] = useState("");
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [focusCreateForm, setFocusCreateForm] = useState(false);
  const createFormRef = useRef<HTMLDivElement>(null);

  const [requests, setRequests] = useState<AffiliateRequest[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectDraftId, setRejectDraftId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [payoutPartnerId, setPayoutPartnerId] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [recordingPayout, setRecordingPayout] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedPartnerQuery(partnerQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [partnerQuery]);

  useEffect(() => {
    if (tab === "partners" && focusCreateForm && createFormRef.current) {
      createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = createFormRef.current.querySelector("input");
      firstInput?.focus();
      setFocusCreateForm(false);
    }
  }, [tab, focusCreateForm]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await clientApi.get<{ data: AffiliateSummary }>(
        "/api/v1/sales/affiliates/summary",
        "affiliate-summary",
      );
      setSummary(response.data);
    } catch {
      setSummary(null);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const response = await clientApi.get<{ data: AffiliateConfig }>(
      "/api/v1/sales/affiliates/config",
      "affiliate-config",
    );
    setConfig(response.data);
    setDraft(response.data);
    return response.data;
  }, []);

  const loadCourses = useCallback(async () => {
    const response = await clientApi.get<{
      data: { items: Array<{ id: string; title?: string | null }> };
    }>("/api/v1/courses?view=studio&limit=100", "affiliate-courses");
    setCourses(
      response.data.items.map((row) => ({
        id: row.id,
        title: row.title?.trim() || "Untitled course",
      })),
    );
    return response.data.items;
  }, []);

  const loadProducts = useCallback(async () => {
    const response = await clientApi.get<{ data: { items: AffiliateProduct[] } }>(
      "/api/v1/sales/affiliates/products",
      "affiliate-products",
    );
    setProducts(response.data.items);
    return response.data.items;
  }, []);

  const loadPartners = useCallback(async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (debouncedPartnerQuery) params.set("q", debouncedPartnerQuery);
    const response = await clientApi.get<{ data: { items: AffiliatePartner[] } }>(
      `/api/v1/sales/affiliates/partners?${params.toString()}`,
      "affiliate-partners",
    );
    setPartners(response.data.items);
    setSelectedPartnerId((current) => {
      if (current && response.data.items.some((row) => row.id === current)) return current;
      return response.data.items[0]?.id ?? null;
    });
    return response.data.items;
  }, [debouncedPartnerQuery]);

  const loadRequests = useCallback(async () => {
    const response = await clientApi.get<{ data: { items: AffiliateRequest[] } }>(
      "/api/v1/sales/affiliates/requests?status=PENDING&limit=50",
      "affiliate-requests",
    );
    setRequests(response.data.items);
    return response.data.items;
  }, []);

  const loadPayouts = useCallback(async () => {
    const response = await clientApi.get<{ data: { items: AffiliatePayout[] } }>(
      "/api/v1/sales/affiliates/payouts?limit=50",
      "affiliate-payouts",
    );
    setPayouts(response.data.items);
    return response.data.items;
  }, []);

  const loadPartnerDetail = useCallback(async (affiliateId: string) => {
    setPartnerDetailLoading(true);
    try {
      const [commissionsRes, payoutsRes] = await Promise.all([
        clientApi.get<{ data: { items: AffiliateCommission[] } }>(
          `/api/v1/sales/affiliates/commissions?affiliateId=${encodeURIComponent(affiliateId)}&status=UNPAID&limit=20`,
          "affiliate-commissions",
        ),
        clientApi.get<{ data: { items: AffiliatePayout[] } }>(
          `/api/v1/sales/affiliates/payouts?affiliateId=${encodeURIComponent(affiliateId)}&limit=20`,
          "affiliate-partner-payouts",
        ),
      ]);
      setPartnerCommissions(commissionsRes.data.items);
      setPartnerPayouts(payoutsRes.data.items);
    } catch (caught) {
      setPartnerCommissions([]);
      setPartnerPayouts([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load partner details.",
      );
    } finally {
      setPartnerDetailLoading(false);
    }
  }, []);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      void loadSummary();
      if (tab === "settings") {
        await loadConfig();
      } else if (tab === "products") {
        const [, loadedProducts, loadedCourses] = await Promise.all([
          loadConfig(),
          loadProducts(),
          loadCourses(),
        ]);
        const drafts: Record<string, ProductRowDraft> = {};
        for (const course of loadedCourses) {
          const product = loadedProducts.find((row) => row.courseId === course.id) ?? null;
          drafts[course.id] = productToDraft(product, false);
        }
        for (const product of loadedProducts) {
          if (!drafts[product.courseId]) {
            drafts[product.courseId] = productToDraft(product, product.enabled);
          }
        }
        setProductDrafts(drafts);
      } else if (tab === "partners") {
        await loadPartners();
      } else if (tab === "requests") {
        await loadRequests();
      } else if (tab === "payouts") {
        await Promise.all([loadPayouts(), loadPartners()]);
      }
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load affiliates.");
    } finally {
      setLoading(false);
    }
  }, [tab, loadConfig, loadCourses, loadPartners, loadPayouts, loadProducts, loadRequests, loadSummary]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  useEffect(() => {
    if (!selectedPartnerId || tab !== "partners") {
      setPartnerCommissions([]);
      setPartnerPayouts([]);
      return;
    }
    void loadPartnerDetail(selectedPartnerId);
  }, [selectedPartnerId, tab, loadPartnerDetail]);

  const selectedPartner = useMemo(
    () => partners.find((row) => row.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId],
  );

  useEffect(() => {
    if (!selectedPartner) {
      setPartnerDraft(null);
      return;
    }
    setPartnerDraft({
      tier: selectedPartner.tier,
      status: selectedPartner.status,
      couponCode: selectedPartner.couponCode,
      payoutUpi: selectedPartner.payoutUpi ?? "",
      payoutBankAccount: selectedPartner.payoutBankAccount ?? "",
      payoutIfsc: selectedPartner.payoutIfsc ?? "",
      payoutAccountName: selectedPartner.payoutAccountName ?? "",
    });
  }, [selectedPartner]);

  const mergedProducts = useMemo(() => {
    const byCourse = new Map(products.map((row) => [row.courseId, row]));
    const courseIds = new Set<string>();
    const rows: Array<{
      courseId: string;
      courseTitle: string;
      product: AffiliateProduct | null;
    }> = [];

    for (const course of courses) {
      courseIds.add(course.id);
      rows.push({
        courseId: course.id,
        courseTitle: course.title,
        product: byCourse.get(course.id) ?? null,
      });
    }

    for (const product of products) {
      if (!courseIds.has(product.courseId)) {
        rows.push({
          courseId: product.courseId,
          courseTitle: product.courseTitle ?? "Course",
          product,
        });
      }
    }

    return rows.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  }, [courses, products]);

  const unlistedCourses = useMemo(() => {
    const configured = new Set(products.map((row) => row.courseId));
    return courses.filter((course) => !configured.has(course.id));
  }, [courses, products]);

  const savedConfig = config ?? draft ?? DEFAULT_CONFIG;
  const configDirty = draft != null && config != null && !configFieldsEqual(draft, config);

  const partnersWithUnpaid = useMemo(
    () => partners.filter((row) => row.unpaidCents > 0),
    [partners],
  );

  const payoutPartnerOptions = useMemo(() => {
    const preferred = partnersWithUnpaid.map((row) => ({
      value: row.id,
      label: `${partnerLabel(row)} (${formatMoney(row.unpaidCents, DEFAULT_CURRENCY)} unpaid)`,
    }));
    const others = partners
      .filter((row) => row.unpaidCents <= 0)
      .map((row) => ({
        value: row.id,
        label: partnerLabel(row),
      }));
    return [...preferred, ...others];
  }, [partners, partnersWithUnpaid]);

  function goToPartnersInvite() {
    setTab("partners");
    setFocusCreateForm(true);
  }

  function onDiscardConfig() {
    if (config) setDraft(config);
    toast.success("Changes discarded.");
  }

  async function onSaveConfig() {
    if (!draft) return;
    setSavingConfig(true);
    try {
      const response = await clientApi.put<{ data: AffiliateConfig }>(
        "/api/v1/sales/affiliates/config",
        {
          enabled: draft.enabled,
          accessMode: draft.accessMode,
          askAdmin: draft.askAdmin,
          standardDiscountPct: draft.standardDiscountPct,
          standardCommissionPct: draft.standardCommissionPct,
          premiumDiscountPct: draft.premiumDiscountPct,
          premiumCommissionPct: draft.premiumCommissionPct,
        },
        "affiliate-config-save",
        { successMessage: "Affiliate settings saved." },
      );
      setConfig(response.data);
      setDraft(response.data);
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save settings.");
    } finally {
      setSavingConfig(false);
    }
  }

  function updateProductDraft(courseId: string, patch: Partial<ProductRowDraft>) {
    setProductDrafts((prev) => ({
      ...prev,
      [courseId]: { ...(prev[courseId] ?? productToDraft(null, false)), ...patch },
    }));
  }

  async function onSaveProductRow(courseId: string, courseTitle: string) {
    const rowDraft = productDrafts[courseId];
    if (!rowDraft) return;
    setSavingProductIds((prev) => new Set(prev).add(courseId));
    try {
      const response = await clientApi.put<{ data: { items: AffiliateProduct[] } }>(
        "/api/v1/sales/affiliates/products",
        {
          courseId,
          enabled: rowDraft.enabled,
          standardDiscountPct: parseOptionalPct(rowDraft.standardDiscountPct),
          standardCommissionPct: parseOptionalPct(rowDraft.standardCommissionPct),
          premiumDiscountPct: parseOptionalPct(rowDraft.premiumDiscountPct),
          premiumCommissionPct: parseOptionalPct(rowDraft.premiumCommissionPct),
        },
        "affiliate-product-save",
        { successMessage: `${courseTitle} saved.` },
      );
      const saved = response.data.items[0];
      if (saved) {
        setProducts((prev) => {
          const idx = prev.findIndex((item) => item.courseId === saved.courseId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
        setProductDrafts((prev) => ({
          ...prev,
          [courseId]: productToDraft(saved, saved.enabled),
        }));
      }
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not save product.");
    } finally {
      setSavingProductIds((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
    }
  }

  async function onAddCourseProduct() {
    if (!addCourseId) {
      toast.error("Select a course first.");
      return;
    }
    updateProductDraft(addCourseId, { enabled: true });
    const course = courses.find((row) => row.id === addCourseId);
    await onSaveProductRow(addCourseId, course?.title ?? "Course");
    setAddCourseId("");
  }

  async function onCreatePartner() {
    if (!createMember) {
      toast.error("Select a member first.");
      return;
    }
    setCreatingPartner(true);
    try {
      await clientApi.post<{ data: AffiliatePartner }>(
        "/api/v1/sales/affiliates/partners",
        {
          membershipId: createMember.id,
          tier: createTier,
          status: "ACTIVE",
          couponCode: createCoupon.trim() || null,
        },
        "affiliate-partner-create",
        { successMessage: "Affiliate partner created." },
      );
      setCreateMember(null);
      setCreateCoupon("");
      await loadPartners();
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not create partner.");
    } finally {
      setCreatingPartner(false);
    }
  }

  async function onUpdatePartner() {
    if (!selectedPartner || !partnerDraft) return;
    setUpdatingPartner(true);
    try {
      const response = await clientApi.put<{ data: AffiliatePartner }>(
        `/api/v1/sales/affiliates/partners/${selectedPartner.id}`,
        {
          tier: partnerDraft.tier,
          status: partnerDraft.status,
          couponCode: partnerDraft.couponCode.trim(),
          payoutUpi: partnerDraft.payoutUpi.trim() || null,
          payoutBankAccount: partnerDraft.payoutBankAccount.trim() || null,
          payoutIfsc: partnerDraft.payoutIfsc.trim() || null,
          payoutAccountName: partnerDraft.payoutAccountName.trim() || null,
        },
        "affiliate-partner-update",
        { successMessage: "Partner updated." },
      );
      setPartners((prev) =>
        prev.map((row) => (row.id === response.data.id ? response.data : row)),
      );
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update partner.");
    } finally {
      setUpdatingPartner(false);
    }
  }

  async function onMarkPartnerPaid(affiliateId: string) {
    setRecordingPayout(true);
    try {
      await clientApi.post(
        "/api/v1/sales/affiliates/payouts",
        { affiliateId, note: null },
        "affiliate-payout-mark-paid",
        { successMessage: "Payout recorded." },
      );
      await Promise.all([loadPartners(), loadPartnerDetail(affiliateId), loadSummary()]);
      if (tab === "payouts") await loadPayouts();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not record payout.");
    } finally {
      setRecordingPayout(false);
    }
  }

  async function onReviewRequest(id: string, action: "approve" | "reject", note?: string) {
    setReviewingId(id);
    try {
      await clientApi.post(
        `/api/v1/sales/affiliates/requests/${id}/review`,
        { action, note: note?.trim() || null },
        "affiliate-request-review",
        {
          successMessage: action === "approve" ? "Request approved." : "Request rejected.",
        },
      );
      setRejectDraftId(null);
      setRejectNote("");
      await loadRequests();
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Review failed.");
    } finally {
      setReviewingId(null);
    }
  }

  async function onRecordPayout() {
    if (!payoutPartnerId) {
      toast.error("Select a partner first.");
      return;
    }
    setRecordingPayout(true);
    try {
      await clientApi.post(
        "/api/v1/sales/affiliates/payouts",
        {
          affiliateId: payoutPartnerId,
          note: payoutNote.trim() || null,
        },
        "affiliate-payout-record",
        { successMessage: "Payout recorded." },
      );
      setPayoutPartnerId("");
      setPayoutNote("");
      await Promise.all([loadPayouts(), loadPartners(), loadSummary()]);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not record payout.");
    } finally {
      setRecordingPayout(false);
    }
  }

  const pendingRequests = summary?.pendingRequests ?? requests.length;

  if (loading && !draft && tab === "settings") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={DASHBOARD_HREF} className={generalSettingsBackLinkClassName}>
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <Link href={ADMIN_SALES_HREF} className={generalSettingsBackLinkClassName}>
            Sales
          </Link>
          <span className="text-[var(--admin-on-surface-variant)]">/</span>
          <span className="font-medium text-[var(--admin-on-surface)]">Affiliates</span>
        </div>
        <button
          type="button"
          onClick={goToPartnersInvite}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:scale-[0.98]"
        >
          <UserPlus className="h-4 w-4" />
          Invite partner
        </button>
      </div>

      <header>
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
          Affiliates
        </h1>
        <p className="mt-2 max-w-3xl text-[16px] text-[var(--admin-on-surface-variant)]">
          Let partners promote your courses, earn commissions on sales, and receive payouts.
          Configure program access, product rates, and partner approvals.
        </p>
      </header>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--admin-border)]">
        {TABS.map((entry) => {
          const active = tab === entry.id;
          const showBadge = entry.id === "requests" && pendingRequests > 0;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className={[
                "relative -mb-px flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-semibold transition-colors",
                active
                  ? "text-[var(--admin-primary)]"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
            >
              {entry.label}
              {showBadge ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--admin-warning)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--admin-on-primary)]">
                  {pendingRequests}
                </span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--admin-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "settings" && draft ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-[var(--admin-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                    Program status
                  </h2>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Enable affiliate program
                    </p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      Partners can share links and earn commissions
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={draft.enabled}
                    ariaLabel="Enable affiliate program"
                    onChange={(next) => setDraft({ ...draft, enabled: next })}
                  />
                </div>

                <fieldset className="mt-6 space-y-3">
                  <legend className={MESSENGER_WIZARD_LABEL_CLASS}>Access mode</legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] p-4 transition-colors hover:bg-[var(--admin-surface-high)]">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={draft.accessMode === "PUBLIC"}
                      onChange={() => setDraft({ ...draft, accessMode: "PUBLIC" })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                        Public
                      </span>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        Learners can discover and join the program
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] p-4 transition-colors hover:bg-[var(--admin-surface-high)]">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={draft.accessMode === "PRIVATE"}
                      onChange={() => setDraft({ ...draft, accessMode: "PRIVATE" })}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                        Private
                      </span>
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        Invite-only; you add partners manually
                      </span>
                    </span>
                  </label>
                </fieldset>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Require admin approval
                    </p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      Review join requests before partners go live
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={draft.askAdmin}
                    ariaLabel="Require admin approval"
                    onChange={(next) => setDraft({ ...draft, askAdmin: next })}
                  />
                </div>
              </section>

              <div className="flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Private access with admin approval tends to produce higher-quality partners because
                  you control who promotes your courses. There is no guaranteed conversion lift; it
                  is a workflow choice.
                </p>
              </div>
            </div>

            <div className="space-y-6 lg:col-span-7">
              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
                <h2 className="mb-6 text-lg font-semibold text-[var(--admin-on-surface)]">
                  Tier defaults
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-5">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Standard tier
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Discount %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.standardDiscountPct}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              standardDiscountPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                        />
                      </div>
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Commission %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.standardCommissionPct}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              standardCommissionPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_5%,var(--admin-surface-high))] p-5">
                    <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--admin-primary)]">
                      Premium tier
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Discount %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.premiumDiscountPct}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              premiumDiscountPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                        />
                      </div>
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Commission %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.premiumCommissionPct}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              premiumCommissionPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
                  <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                    Payout preferences
                  </h2>
                </div>
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Commissions accrue when referred learners purchase. Payouts are recorded manually on
                  the Payouts tab after you send funds outside Atlas. Partners set their own banking
                  details in their profile.
                </p>
              </section>
            </div>
          </div>

          {configDirty ? (
            <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-lg">
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                You have unsaved settings changes
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onDiscardConfig}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Discard
                </button>
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={() => void onSaveConfig()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-bold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingConfig ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingConfig}
                onClick={() => void onSaveConfig()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingConfig ? "Saving…" : "Save settings"}
              </button>
            </div>
          )}

          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                label="Active partners"
                value={summary.activePartners.toLocaleString()}
                hint={`${summary.totalPartners.toLocaleString()} total partners`}
              />
              <StatCard
                label="Unpaid commissions"
                value={formatMoney(summary.unpaidCents, DEFAULT_CURRENCY)}
                hint={
                  summary.partnersWithUnpaid > 0
                    ? `${summary.partnersWithUnpaid} partner${summary.partnersWithUnpaid === 1 ? "" : "s"} with balance`
                    : "All caught up"
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "products" ? (
        <div className="space-y-6">
          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Unpaid commissions"
                value={formatMoney(summary.unpaidCents, DEFAULT_CURRENCY)}
              />
              <StatCard label="Active partners" value={summary.activePartners.toLocaleString()} />
              <StatCard label="Enabled products" value={summary.enabledProducts.toLocaleString()} />
              <StatCard label="Pending requests" value={summary.pendingRequests.toLocaleString()} />
            </div>
          ) : null}

          {unlistedCourses.length > 0 ? (
            <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-[240px] flex-1">
                  <AdminSelectDropdown
                    id="add-affiliate-course"
                    label="Add course to affiliate list"
                    ariaLabel="Add course to affiliate list"
                    value={addCourseId}
                    options={unlistedCourses.map((course) => ({
                      value: course.id,
                      label: course.title,
                    }))}
                    onChange={setAddCourseId}
                  />
                </div>
                <button
                  type="button"
                  disabled={!addCourseId}
                  onClick={() => void onAddCourseProduct()}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-semibold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Enable course
                </button>
              </div>
            </section>
          ) : null}

          <div className="flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Leave override fields blank to use global tier defaults from Settings. Product overrides
              apply only to that course.
            </p>
          </div>

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-6">
              <Package className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                Course commission rates
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                    <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Course
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Enabled
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Standard overrides
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Premium overrides
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <tr key={`sk-${index}`}>
                        <td colSpan={5} className="px-6 py-4">
                          <div className="h-10 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                        </td>
                      </tr>
                    ))
                  ) : mergedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-[var(--admin-on-surface-variant)]">
                        No courses found. Publish courses in Studio first.
                      </td>
                    </tr>
                  ) : (
                    mergedProducts.map(({ courseId, courseTitle, product }) => {
                      const rowDraft = productDrafts[courseId] ?? productToDraft(product, false);
                      const saving = savingProductIds.has(courseId);
                      const disabledInputs = !rowDraft.enabled;
                      return (
                        <tr
                          key={courseId}
                          className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]/50"
                        >
                          <td className="px-6 py-4">
                            <p className="font-semibold text-[var(--admin-on-surface)]">
                              {courseTitle}
                            </p>
                            {!product ? (
                              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                                Not configured (uses defaults when enabled)
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <ToggleSwitch
                              checked={rowDraft.enabled}
                              ariaLabel={`Enable ${courseTitle} for affiliates`}
                              onChange={(next) => updateProductDraft(courseId, { enabled: next })}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-2 min-w-[180px]">
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.standardDiscountPct}
                                placeholder={String(savedConfig.standardDiscountPct)}
                                onChange={(event) =>
                                  updateProductDraft(courseId, {
                                    standardDiscountPct: event.target.value,
                                  })
                                }
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Standard discount override for ${courseTitle}`}
                              />
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.standardCommissionPct}
                                placeholder={String(savedConfig.standardCommissionPct)}
                                onChange={(event) =>
                                  updateProductDraft(courseId, {
                                    standardCommissionPct: event.target.value,
                                  })
                                }
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Standard commission override for ${courseTitle}`}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                              {formatPctOverride(
                                product?.standardDiscountPct,
                                savedConfig.standardDiscountPct,
                              )}{" "}
                              /{" "}
                              {formatPctOverride(
                                product?.standardCommissionPct,
                                savedConfig.standardCommissionPct,
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-2 min-w-[180px]">
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.premiumDiscountPct}
                                placeholder={String(savedConfig.premiumDiscountPct)}
                                onChange={(event) =>
                                  updateProductDraft(courseId, {
                                    premiumDiscountPct: event.target.value,
                                  })
                                }
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Premium discount override for ${courseTitle}`}
                              />
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.premiumCommissionPct}
                                placeholder={String(savedConfig.premiumCommissionPct)}
                                onChange={(event) =>
                                  updateProductDraft(courseId, {
                                    premiumCommissionPct: event.target.value,
                                  })
                                }
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Premium commission override for ${courseTitle}`}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                              {formatPctOverride(
                                product?.premiumDiscountPct,
                                savedConfig.premiumDiscountPct,
                              )}{" "}
                              /{" "}
                              {formatPctOverride(
                                product?.premiumCommissionPct,
                                savedConfig.premiumCommissionPct,
                              )}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void onSaveProductRow(courseId, courseTitle)}
                              className="text-xs font-semibold text-[var(--admin-primary)] hover:underline disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "partners" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section
              ref={createFormRef}
              className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[var(--admin-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Add partner</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MemberSearchField
                  id="create-partner-member"
                  label="Member"
                  value={createMember}
                  onChange={setCreateMember}
                  disabled={creatingPartner}
                />
                <div>
                  <AdminSelectDropdown
                    id="create-partner-tier"
                    label="Tier"
                    ariaLabel="Partner tier"
                    value={createTier}
                    options={[...TIER_OPTIONS]}
                    onChange={(value) => setCreateTier(value as AffiliatePartner["tier"])}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>
                    Coupon code (optional)
                  </label>
                  <input
                    value={createCoupon}
                    onChange={(event) => setCreateCoupon(event.target.value.toUpperCase())}
                    maxLength={64}
                    placeholder="Auto-generated if blank"
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 font-mono`}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={creatingPartner}
                onClick={() => void onCreatePartner()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creatingPartner ? "Creating…" : "Create partner"}
              </button>
            </section>

            <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                  <h2 className="text-sm font-bold text-[var(--admin-on-surface)]">Partners</h2>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    value={partnerQuery}
                    onChange={(event) => setPartnerQuery(event.target.value)}
                    placeholder="Search name, email, code…"
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 pl-9 text-[12px]`}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--admin-surface-high)]">
                    <tr className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      <th className="px-6 py-3">Partner</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3 text-right">Unpaid</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8">
                          <div className="h-10 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                        </td>
                      </tr>
                    ) : partners.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-16 text-center text-[var(--admin-on-surface-variant)]"
                        >
                          No affiliate partners yet. Add one above or approve a request.
                        </td>
                      </tr>
                    ) : (
                      partners.map((partner) => {
                        const active = partner.id === selectedPartnerId;
                        return (
                          <tr
                            key={partner.id}
                            onClick={() => setSelectedPartnerId(partner.id)}
                            className={[
                              "cursor-pointer transition-colors",
                              active
                                ? "border-l-4 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                                : "border-l-4 border-transparent hover:bg-[var(--admin-surface-high)]",
                            ].join(" ")}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-bold">
                                  {partnerInitials(partner.displayName, partner.email)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{partnerLabel(partner)}</p>
                                  <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                                    {partner.email ?? partner.membershipId.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge className={tierBadgeClass(partner.tier)}>
                                {tierLabel(partner.tier)}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <Badge className={partnerStatusBadgeClass(partner.status)}>
                                {partnerStatusLabel(partner.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 font-mono text-xs">{partner.couponCode}</td>
                            <td className="px-4 py-4 text-right font-mono text-xs">
                              {formatMoney(partner.unpaidCents, DEFAULT_CURRENCY)}
                            </td>
                            <td className="px-4 py-4 text-right font-mono text-xs">
                              {formatMoney(partner.paidCents, DEFAULT_CURRENCY)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-4 space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
              {selectedPartner && partnerDraft ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--admin-surface-high)] text-lg font-bold text-[var(--admin-primary)]">
                        {partnerInitials(selectedPartner.displayName, selectedPartner.email)}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                          {partnerLabel(selectedPartner)}
                        </h3>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          Joined {formatAffiliateDate(selectedPartner.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPartnerId(null)}
                      className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                      aria-label="Close partner detail"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Unpaid
                      </p>
                      <p className="text-lg font-bold text-[var(--admin-warning)]">
                        {formatMoney(selectedPartner.unpaidCents, DEFAULT_CURRENCY)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Paid
                      </p>
                      <p className="text-lg font-bold text-[var(--admin-success)]">
                        {formatMoney(selectedPartner.paidCents, DEFAULT_CURRENCY)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-[var(--admin-border)] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                          Enable commissions
                        </p>
                        <p className="text-xs text-[var(--admin-on-surface-variant)]">
                          Active partners can earn on referred sales
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={partnerDraft.status === "ACTIVE"}
                        ariaLabel="Enable commissions for partner"
                        onChange={(next) =>
                          setPartnerDraft({
                            ...partnerDraft,
                            status: next ? "ACTIVE" : "INACTIVE",
                          })
                        }
                      />
                    </div>

                    <AdminSelectDropdown
                      id="partner-tier"
                      label="Tier"
                      ariaLabel="Partner tier"
                      value={partnerDraft.tier}
                      options={[...TIER_OPTIONS]}
                      onChange={(value) =>
                        setPartnerDraft({
                          ...partnerDraft,
                          tier: value as AffiliatePartner["tier"],
                        })
                      }
                    />

                    <div>
                      <label className={MESSENGER_WIZARD_LABEL_CLASS}>Coupon code</label>
                      <input
                        value={partnerDraft.couponCode}
                        onChange={(event) =>
                          setPartnerDraft({
                            ...partnerDraft,
                            couponCode: event.target.value.toUpperCase(),
                          })
                        }
                        maxLength={64}
                        className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11 font-mono`}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                      <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
                        Payout details
                      </p>
                    </div>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Partners can also update these from their profile. Edit here if you need to
                      correct details before recording a payout.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Account name</label>
                        <input
                          value={partnerDraft.payoutAccountName}
                          onChange={(event) =>
                            setPartnerDraft({
                              ...partnerDraft,
                              payoutAccountName: event.target.value,
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
                        />
                      </div>
                      <div>
                        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Bank account</label>
                        <input
                          value={partnerDraft.payoutBankAccount}
                          onChange={(event) =>
                            setPartnerDraft({
                              ...partnerDraft,
                              payoutBankAccount: event.target.value,
                            })
                          }
                          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                          placeholder={
                            selectedPartner.payoutBankAccount
                              ? maskBankAccount(selectedPartner.payoutBankAccount)
                              : "Account number"
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={MESSENGER_WIZARD_LABEL_CLASS}>IFSC / routing</label>
                          <input
                            value={partnerDraft.payoutIfsc}
                            onChange={(event) =>
                              setPartnerDraft({
                                ...partnerDraft,
                                payoutIfsc: event.target.value,
                              })
                            }
                            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                          />
                        </div>
                        <div>
                          <label className={MESSENGER_WIZARD_LABEL_CLASS}>UPI ID</label>
                          <input
                            value={partnerDraft.payoutUpi}
                            onChange={(event) =>
                              setPartnerDraft({
                                ...partnerDraft,
                                payoutUpi: event.target.value,
                              })
                            }
                            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={updatingPartner}
                      onClick={() => void onUpdatePartner()}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {updatingPartner ? "Saving…" : "Save changes"}
                    </button>
                    {selectedPartner.unpaidCents > 0 ? (
                      <button
                        type="button"
                        disabled={recordingPayout}
                        onClick={() => void onMarkPartnerPaid(selectedPartner.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                      >
                        <HandCoins className="h-4 w-4" />
                        Mark paid
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-3 border-t border-[var(--admin-border)] pt-4">
                    <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Unpaid commissions
                    </h4>
                    {partnerDetailLoading ? (
                      <div className="h-16 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                    ) : partnerCommissions.length === 0 ? (
                      <p className="text-xs text-[var(--admin-on-surface-variant)]">
                        No unpaid commissions.
                      </p>
                    ) : (
                      <ul className="max-h-40 space-y-2 overflow-y-auto">
                        {partnerCommissions.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-xs"
                          >
                            <span className="text-[var(--admin-on-surface-variant)]">
                              {formatAffiliateDate(row.createdAt)}
                            </span>
                            <span className="font-mono font-semibold text-[var(--admin-on-surface)]">
                              {formatMoney(row.commissionCents, row.currency)}
                            </span>
                            <Badge className={commissionStatusBadgeClass(row.status)}>
                              {row.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[var(--admin-border)] pt-4">
                    <h4 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Payout history
                    </h4>
                    {partnerDetailLoading ? (
                      <div className="h-16 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                    ) : partnerPayouts.length === 0 ? (
                      <p className="text-xs text-[var(--admin-on-surface-variant)]">
                        No payouts recorded yet.
                      </p>
                    ) : (
                      <ul className="max-h-40 space-y-2 overflow-y-auto">
                        {partnerPayouts.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-xs"
                          >
                            <span className="text-[var(--admin-on-surface-variant)]">
                              {formatAffiliateDateTime(row.paidAt)}
                            </span>
                            <span className="font-mono font-semibold text-[var(--admin-success)]">
                              {formatMoney(row.amountCents, row.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="py-12 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  Select a partner to view details, banking, and payout history.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-6">
          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Pending requests" value={summary.pendingRequests.toLocaleString()} />
              <StatCard label="Active partners" value={summary.activePartners.toLocaleString()} />
              <StatCard
                label="Unpaid commissions"
                value={formatMoney(summary.unpaidCents, DEFAULT_CURRENCY)}
              />
            </div>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            {loading ? (
              <div className="p-8">
                <div className="h-24 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
              </div>
            ) : requests.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  No pending requests
                </p>
                <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                  When learners apply to join a private program, they appear here for review.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Applicant
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Submitted
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Application note
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id} className="border-b border-[var(--admin-border)]">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{requestApplicantLabel(request)}</p>
                          <p className="text-xs text-[var(--admin-on-surface-variant)]">
                            {request.email ?? request.membershipId.slice(0, 8)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[var(--admin-on-surface-variant)]">
                          {formatAffiliateDateTime(request.createdAt)}
                        </td>
                        <td className="max-w-xs px-4 py-4 text-[var(--admin-on-surface-variant)]">
                          {request.note?.trim() || (
                            <span className="italic">No note provided</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {rejectDraftId === request.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={rejectNote}
                                onChange={(event) => setRejectNote(event.target.value)}
                                placeholder="Optional note to the applicant…"
                                maxLength={500}
                                rows={2}
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} text-xs`}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={reviewingId === request.id}
                                  onClick={() =>
                                    void onReviewRequest(request.id, "reject", rejectNote)
                                  }
                                  className="rounded-lg bg-[var(--admin-danger)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                                >
                                  Confirm reject
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectDraftId(null);
                                    setRejectNote("");
                                  }}
                                  className="rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={reviewingId === request.id}
                                onClick={() => void onReviewRequest(request.id, "approve")}
                                className="rounded-lg bg-[var(--admin-success)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={reviewingId === request.id}
                                onClick={() => {
                                  setRejectDraftId(request.id);
                                  setRejectNote("");
                                }}
                                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {tab === "payouts" ? (
        <div className="space-y-6">
          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Unpaid total"
                value={formatMoney(summary.unpaidCents, DEFAULT_CURRENCY)}
              />
              <StatCard
                label="Paid total"
                value={formatMoney(summary.paidCents, DEFAULT_CURRENCY)}
              />
              <StatCard
                label="Partners with balance"
                value={summary.partnersWithUnpaid.toLocaleString()}
              />
              <StatCard label="Active partners" value={summary.activePartners.toLocaleString()} />
            </div>
          ) : null}

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-[var(--admin-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                Record payout
              </h2>
            </div>
            <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
              After you send payment outside Atlas (bank transfer, UPI, etc.), record it here to
              mark all unpaid commissions for that partner as paid.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AdminSelectDropdown
                id="payout-partner"
                label="Partner"
                ariaLabel="Partner to pay out"
                value={payoutPartnerId}
                options={payoutPartnerOptions}
                onChange={setPayoutPartnerId}
              />
              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Note (optional)</label>
                <input
                  value={payoutNote}
                  onChange={(event) => setPayoutNote(event.target.value)}
                  maxLength={500}
                  placeholder="Transfer reference or internal note"
                  className={`${MESSENGER_WIZARD_FIELD_CLASS} h-11`}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={recordingPayout || !payoutPartnerId}
              onClick={() => void onRecordPayout()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {recordingPayout ? "Recording…" : "Record payout"}
            </button>
          </section>

          <section className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="border-b border-[var(--admin-border)] p-6">
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">Payout ledger</h2>
            </div>
            {loading ? (
              <div className="p-8">
                <div className="h-24 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
              </div>
            ) : payouts.length === 0 ? (
              <p className="px-6 py-16 text-center text-sm text-[var(--admin-on-surface-variant)]">
                No payouts recorded yet. Record one after sending funds to a partner.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Partner
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Amount
                      </th>
                      <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Paid at
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="border-b border-[var(--admin-border)]">
                        <td className="px-6 py-4">
                          <p className="font-semibold">{payout.displayName ?? "Partner"}</p>
                          <p className="text-xs text-[var(--admin-on-surface-variant)]">
                            {payout.email ?? payout.affiliateId.slice(0, 8)}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-mono font-semibold">
                          {formatMoney(payout.amountCents, payout.currency)}
                        </td>
                        <td className="px-4 py-4 text-[var(--admin-on-surface-variant)]">
                          {formatAffiliateDateTime(payout.paidAt)}
                        </td>
                        <td className="px-6 py-4 text-xs text-[var(--admin-on-surface-variant)]">
                          {payout.note?.trim() || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
