"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { formatMoney } from "./coupons-shared";
import {
  configFieldsEqual,
  DEFAULT_CONFIG,
  parseOptionalPct,
  partnerLabel,
  type AdminAffiliateTab,
  type AffiliateCommission,
  type AffiliateConfig,
  type AffiliatePartner,
  type AffiliatePayoutDetails,
  type AffiliatePayout,
  type AffiliateProduct,
  type AffiliateRequest,
  type AffiliateSummary,
  type MemberSearchOption,
  type StudioCourseOption,
} from "./affiliates-shared";
import { DEFAULT_CURRENCY, type ProductRowDraft, productToDraft } from "./affiliates-admin-shared";

/** The state, data loading and handlers behind AffiliatesAdminPanel. */
export function useAffiliatesAdmin() {
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
    /** Empty means "keep what is on file"; the server never sends these back. */
    payoutUpi: string;
    payoutBankAccount: string;
    clearUpi: boolean;
    clearBankAccount: boolean;
    payoutIfsc: string;
    payoutAccountName: string;
  } | null>(null);
  const [revealedPayout, setRevealedPayout] = useState<AffiliatePayoutDetails | null>(null);
  const [revealingPayout, setRevealingPayout] = useState(false);
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
    const timer = window.setTimeout(() => {
      setDebouncedPartnerQuery(partnerQuery.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
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
      } else {
        await Promise.all([loadPayouts(), loadPartners()]);
      }
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load affiliates.");
    } finally {
      setLoading(false);
    }
  }, [
    tab,
    loadConfig,
    loadCourses,
    loadPartners,
    loadPayouts,
    loadProducts,
    loadRequests,
    loadSummary,
  ]);

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
      payoutUpi: "",
      payoutBankAccount: "",
      clearUpi: false,
      clearBankAccount: false,
      payoutIfsc: selectedPartner.payoutIfsc ?? "",
      payoutAccountName: selectedPartner.payoutAccountName ?? "",
    });
    setRevealedPayout(null);
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
          // Bank account and UPI are sent only when changed or removed.
          ...(partnerDraft.clearUpi
            ? { payoutUpi: null }
            : partnerDraft.payoutUpi.trim()
              ? { payoutUpi: partnerDraft.payoutUpi.trim() }
              : {}),
          ...(partnerDraft.clearBankAccount
            ? { payoutBankAccount: null }
            : partnerDraft.payoutBankAccount.trim()
              ? { payoutBankAccount: partnerDraft.payoutBankAccount.trim() }
              : {}),
          payoutIfsc: partnerDraft.payoutIfsc.trim() || null,
          payoutAccountName: partnerDraft.payoutAccountName.trim() || null,
        },
        "affiliate-partner-update",
        { successMessage: "Partner updated." },
      );
      setPartners((prev) => prev.map((row) => (row.id === response.data.id ? response.data : row)));
      void loadSummary();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update partner.");
    } finally {
      setUpdatingPartner(false);
    }
  }

  async function onRevealPayout() {
    if (!selectedPartner) return;
    setRevealingPayout(true);
    try {
      // Requires step-up MFA and is audited (audit M6); the client prompts for MFA.
      const response = await clientApi.post<{ data: AffiliatePayoutDetails }>(
        `/api/v1/sales/affiliates/partners/${selectedPartner.id}/payout-details`,
        null,
        "affiliate-payout-reveal",
        { silent: true },
      );
      setRevealedPayout(response.data);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not show payout details.",
      );
    } finally {
      setRevealingPayout(false);
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

  return {
    tab,
    setTab,
    loading,
    summary,
    draft,
    setDraft,
    savingConfig,
    productDrafts,
    savingProductIds,
    addCourseId,
    setAddCourseId,
    partners,
    partnerQuery,
    setPartnerQuery,
    selectedPartnerId,
    setSelectedPartnerId,
    partnerDraft,
    setPartnerDraft,
    revealedPayout,
    revealingPayout,
    partnerCommissions,
    partnerPayouts,
    partnerDetailLoading,
    updatingPartner,
    createMember,
    setCreateMember,
    createTier,
    setCreateTier,
    createCoupon,
    setCreateCoupon,
    creatingPartner,
    createFormRef,
    requests,
    reviewingId,
    rejectDraftId,
    setRejectDraftId,
    rejectNote,
    setRejectNote,
    payouts,
    payoutPartnerId,
    setPayoutPartnerId,
    payoutNote,
    setPayoutNote,
    recordingPayout,
    selectedPartner,
    mergedProducts,
    unlistedCourses,
    savedConfig,
    configDirty,
    payoutPartnerOptions,
    goToPartnersInvite,
    onDiscardConfig,
    onSaveConfig,
    updateProductDraft,
    onSaveProductRow,
    onAddCourseProduct,
    onCreatePartner,
    onUpdatePartner,
    onRevealPayout,
    onMarkPartnerPaid,
    onReviewRequest,
    onRecordPayout,
    pendingRequests,
  };
}

export type AffiliatesAdminView = ReturnType<typeof useAffiliatesAdmin>;
