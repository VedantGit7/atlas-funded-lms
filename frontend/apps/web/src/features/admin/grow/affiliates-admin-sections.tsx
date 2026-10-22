"use client";

import {
  Banknote,
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
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { formatMoney } from "./coupons-shared";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  commissionStatusBadgeClass,
  formatAffiliateDate,
  formatAffiliateDateTime,
  formatPctOverride,
  partnerInitials,
  partnerLabel,
  partnerStatusBadgeClass,
  partnerStatusLabel,
  requestApplicantLabel,
  TIER_OPTIONS,
  tierBadgeClass,
  tierLabel,
  type AffiliatePartner,
} from "./affiliates-shared";
import {
  Badge,
  DEFAULT_CURRENCY,
  MemberSearchField,
  PayoutClearToggle,
  StatCard,
  ToggleSwitch,
  productToDraft,
} from "./affiliates-admin-shared";
import type { AffiliatesAdminView } from "./use-affiliates-admin";

/** Programme settings: commission, cookie window, payouts and terms. */
export function AffiliateSettingsTab({ view }: { view: AffiliatesAdminView }) {
  const {
    configDirty,
    draft,
    onDiscardConfig,
    onSaveConfig,
    savingConfig,
    setDraft,
    summary,
    tab,
  } = view;
  return (
    <>
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
                    onChange={(next) => {
                      setDraft({ ...draft, enabled: next });
                    }}
                  />
                </div>

                <fieldset className="mt-6 space-y-3">
                  <legend className={MESSENGER_WIZARD_LABEL_CLASS}>Access mode</legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] p-4 transition-colors hover:bg-[var(--admin-surface-high)]">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={draft.accessMode === "PUBLIC"}
                      onChange={() => {
                        setDraft({ ...draft, accessMode: "PUBLIC" });
                      }}
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
                      onChange={() => {
                        setDraft({ ...draft, accessMode: "PRIVATE" });
                      }}
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
                    onChange={(next) => {
                      setDraft({ ...draft, askAdmin: next });
                    }}
                  />
                </div>
              </section>

              <div className="flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-4">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" />
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  Private access with admin approval tends to produce higher-quality partners
                  because you control who promotes your courses. There is no guaranteed conversion
                  lift; it is a workflow choice.
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
                          onChange={(event) => {
                            setDraft({
                              ...draft,
                              standardDiscountPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            });
                          }}
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
                          onChange={(event) => {
                            setDraft({
                              ...draft,
                              standardCommissionPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            });
                          }}
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
                          onChange={(event) => {
                            setDraft({
                              ...draft,
                              premiumDiscountPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            });
                          }}
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
                          onChange={(event) => {
                            setDraft({
                              ...draft,
                              premiumCommissionPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value) || 0),
                              ),
                            });
                          }}
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
                  Commissions accrue when referred learners purchase. Payouts are recorded manually
                  on the Payouts tab after you send funds outside Atlas. Partners set their own
                  banking details in their profile.
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
                    ? `${String(summary.partnersWithUnpaid)} partner${summary.partnersWithUnpaid === 1 ? "" : "s"} with balance`
                    : "All caught up"
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Per-product commission overrides. */
export function AffiliateProductsTab({ view }: { view: AffiliatesAdminView }) {
  const {
    addCourseId,
    loading,
    mergedProducts,
    onAddCourseProduct,
    onSaveProductRow,
    productDrafts,
    savedConfig,
    savingProductIds,
    setAddCourseId,
    summary,
    tab,
    unlistedCourses,
    updateProductDraft,
  } = view;
  return (
    <>
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
              Leave override fields blank to use global tier defaults from Settings. Product
              overrides apply only to that course.
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
                      <tr key={`sk-${String(index)}`}>
                        <td colSpan={5} className="px-6 py-4">
                          <div className="h-10 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
                        </td>
                      </tr>
                    ))
                  ) : mergedProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-16 text-center text-[var(--admin-on-surface-variant)]"
                      >
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
                              onChange={(next) => {
                                updateProductDraft(courseId, { enabled: next });
                              }}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-2 min-w-[180px]">
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.standardDiscountPct}
                                placeholder={String(savedConfig.standardDiscountPct)}
                                onChange={(event) => {
                                  updateProductDraft(courseId, {
                                    standardDiscountPct: event.target.value,
                                  });
                                }}
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Standard discount override for ${courseTitle}`}
                              />
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.standardCommissionPct}
                                placeholder={String(savedConfig.standardCommissionPct)}
                                onChange={(event) => {
                                  updateProductDraft(courseId, {
                                    standardCommissionPct: event.target.value,
                                  });
                                }}
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
                                onChange={(event) => {
                                  updateProductDraft(courseId, {
                                    premiumDiscountPct: event.target.value,
                                  });
                                }}
                                className={`${MESSENGER_WIZARD_FIELD_CLASS} h-9 text-xs disabled:opacity-50`}
                                aria-label={`Premium discount override for ${courseTitle}`}
                              />
                              <input
                                disabled={disabledInputs}
                                value={rowDraft.premiumCommissionPct}
                                placeholder={String(savedConfig.premiumCommissionPct)}
                                onChange={(event) => {
                                  updateProductDraft(courseId, {
                                    premiumCommissionPct: event.target.value,
                                  });
                                }}
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
    </>
  );
}

/** The partner list, its search and the add-partner form. */
export function AffiliatePartnerList({ view }: { view: AffiliatesAdminView }) {
  const {
    createCoupon,
    createFormRef,
    createMember,
    createTier,
    creatingPartner,
    loading,
    onCreatePartner,
    partnerQuery,
    partners,
    selectedPartnerId,
    setCreateCoupon,
    setCreateMember,
    setCreateTier,
    setPartnerQuery,
    setSelectedPartnerId,
  } = view;
  return (
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
              onChange={(value) => {
                setCreateTier(value as AffiliatePartner["tier"]);
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Coupon code (optional)</label>
            <input
              value={createCoupon}
              onChange={(event) => {
                setCreateCoupon(event.target.value.toUpperCase());
              }}
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
              onChange={(event) => {
                setPartnerQuery(event.target.value);
              }}
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
                      onClick={() => {
                        setSelectedPartnerId(partner.id);
                      }}
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
  );
}

/** The selected partner's details, rates and payout history. */
export function AffiliatePartnerEditor({ view }: { view: AffiliatesAdminView }) {
  const {
    onMarkPartnerPaid,
    onRevealPayout,
    onUpdatePartner,
    partnerCommissions,
    partnerDetailLoading,
    partnerDraft,
    partnerPayouts,
    recordingPayout,
    revealedPayout,
    revealingPayout,
    selectedPartner,
    setPartnerDraft,
    setSelectedPartnerId,
    updatingPartner,
  } = view;
  return (
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
                onClick={() => {
                  setSelectedPartnerId(null);
                }}
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
                  onChange={(next) => {
                    setPartnerDraft({
                      ...partnerDraft,
                      status: next ? "ACTIVE" : "INACTIVE",
                    });
                  }}
                />
              </div>

              <AdminSelectDropdown
                id="partner-tier"
                label="Tier"
                ariaLabel="Partner tier"
                value={partnerDraft.tier}
                options={[...TIER_OPTIONS]}
                onChange={(value) => {
                  setPartnerDraft({
                    ...partnerDraft,
                    tier: value as AffiliatePartner["tier"],
                  });
                }}
              />

              <div>
                <label className={MESSENGER_WIZARD_LABEL_CLASS}>Coupon code</label>
                <input
                  value={partnerDraft.couponCode}
                  onChange={(event) => {
                    setPartnerDraft({
                      ...partnerDraft,
                      couponCode: event.target.value.toUpperCase(),
                    });
                  }}
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
                Partners can also update these from their profile. Bank account and UPI are stored
                encrypted and shown masked; type a new value to replace one.
              </p>
              {selectedPartner.payoutDetailsOnFile ? (
                revealedPayout?.affiliateId === selectedPartner.id ? (
                  <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-xs">
                    <dt className="text-[var(--admin-on-surface-variant)]">Account name</dt>
                    <dd className="text-[var(--admin-on-surface)]">
                      {revealedPayout.payoutAccountName ?? "Not set"}
                    </dd>
                    <dt className="text-[var(--admin-on-surface-variant)]">Bank account</dt>
                    <dd className="font-mono text-[var(--admin-on-surface)]">
                      {revealedPayout.payoutBankAccount ?? "Not set"}
                    </dd>
                    <dt className="text-[var(--admin-on-surface-variant)]">IFSC</dt>
                    <dd className="font-mono text-[var(--admin-on-surface)]">
                      {revealedPayout.payoutIfsc ?? "Not set"}
                    </dd>
                    <dt className="text-[var(--admin-on-surface-variant)]">UPI ID</dt>
                    <dd className="font-mono text-[var(--admin-on-surface)]">
                      {revealedPayout.payoutUpi ?? "Not set"}
                    </dd>
                  </dl>
                ) : (
                  <button
                    type="button"
                    disabled={revealingPayout}
                    onClick={() => void onRevealPayout()}
                    className="inline-flex items-center gap-2 self-start rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                  >
                    {revealingPayout ? "Verifying…" : "Show full details to pay"}
                  </button>
                )
              ) : null}
              <div className="space-y-3">
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Account name</label>
                  <input
                    value={partnerDraft.payoutAccountName}
                    onChange={(event) => {
                      setPartnerDraft({
                        ...partnerDraft,
                        payoutAccountName: event.target.value,
                      });
                    }}
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
                  />
                </div>
                <div>
                  <label className={MESSENGER_WIZARD_LABEL_CLASS}>Bank account</label>
                  <input
                    value={partnerDraft.payoutBankAccount}
                    disabled={partnerDraft.clearBankAccount}
                    onChange={(event) => {
                      setPartnerDraft({
                        ...partnerDraft,
                        payoutBankAccount: event.target.value,
                      });
                    }}
                    autoComplete="off"
                    className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                    placeholder={
                      selectedPartner.payoutBankAccountMasked
                        ? `${selectedPartner.payoutBankAccountMasked} (leave blank to keep)`
                        : "Account number"
                    }
                  />
                  {selectedPartner.payoutBankAccountMasked ? (
                    <PayoutClearToggle
                      checked={partnerDraft.clearBankAccount}
                      label="Remove saved bank account"
                      onChange={(checked) => {
                        setPartnerDraft({
                          ...partnerDraft,
                          clearBankAccount: checked,
                          payoutBankAccount: "",
                        });
                      }}
                    />
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={MESSENGER_WIZARD_LABEL_CLASS}>IFSC / routing</label>
                    <input
                      value={partnerDraft.payoutIfsc}
                      onChange={(event) => {
                        setPartnerDraft({
                          ...partnerDraft,
                          payoutIfsc: event.target.value,
                        });
                      }}
                      className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                    />
                  </div>
                  <div>
                    <label className={MESSENGER_WIZARD_LABEL_CLASS}>UPI ID</label>
                    <input
                      value={partnerDraft.payoutUpi}
                      disabled={partnerDraft.clearUpi}
                      onChange={(event) => {
                        setPartnerDraft({
                          ...partnerDraft,
                          payoutUpi: event.target.value,
                        });
                      }}
                      autoComplete="off"
                      className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 font-mono`}
                      placeholder={
                        selectedPartner.payoutUpiMasked
                          ? `${selectedPartner.payoutUpiMasked} (leave blank to keep)`
                          : "name@bank"
                      }
                    />
                    {selectedPartner.payoutUpiMasked ? (
                      <PayoutClearToggle
                        checked={partnerDraft.clearUpi}
                        label="Remove saved UPI ID"
                        onChange={(checked) => {
                          setPartnerDraft({
                            ...partnerDraft,
                            clearUpi: checked,
                            payoutUpi: "",
                          });
                        }}
                      />
                    ) : null}
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
                      <Badge className={commissionStatusBadgeClass(row.status)}>{row.status}</Badge>
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
  );
}

/** Partner applications waiting for a decision. */
export function AffiliateRequestsTab({ view }: { view: AffiliatesAdminView }) {
  const {
    loading,
    onReviewRequest,
    rejectDraftId,
    rejectNote,
    requests,
    reviewingId,
    setRejectDraftId,
    setRejectNote,
    summary,
    tab,
  } = view;
  return (
    <>
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
                          {request.note?.trim() || <span className="italic">No note provided</span>}
                        </td>
                        <td className="px-6 py-4">
                          {rejectDraftId === request.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={rejectNote}
                                onChange={(event) => {
                                  setRejectNote(event.target.value);
                                }}
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
                                  className="rounded-lg bg-[var(--admin-danger)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-danger)] disabled:opacity-50"
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
                                className="rounded-lg bg-[var(--admin-success)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-success)] disabled:opacity-50"
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
    </>
  );
}

/** Payout requests and the payout ledger. */
export function AffiliatePayoutsTab({ view }: { view: AffiliatesAdminView }) {
  const {
    loading,
    onRecordPayout,
    payoutNote,
    payoutPartnerId,
    payoutPartnerOptions,
    payouts,
    recordingPayout,
    setPayoutNote,
    setPayoutPartnerId,
    summary,
    tab,
  } = view;
  return (
    <>
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
                  onChange={(event) => {
                    setPayoutNote(event.target.value);
                  }}
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
              <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                Payout ledger
              </h2>
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
    </>
  );
}
