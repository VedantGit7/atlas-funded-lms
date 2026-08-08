"use client";

import type { ReactNode } from "react";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { MESSENGER_WIZARD_FIELD_CLASS, MESSENGER_WIZARD_LABEL_CLASS } from "./push-wizard-chrome";
import {
  centsToDollarInput,
  dollarInputToCents,
  type CouponDeviceType,
  type CouponDiscountType,
  type CouponFormValues,
} from "./coupons-shared";

type CourseOption = { id: string; title: string };

type CouponFormFieldsProps = {
  values: CouponFormValues;
  onChange: (next: CouponFormValues) => void;
  courses: CourseOption[];
  coursesLoading?: boolean;
  /** When false, hide identity fields (code/name) for editor layouts that show them in the header. */
  showIdentity?: boolean;
  /** Compact layout used inside builder section cards. */
  sections?: ReadonlyArray<"discount" | "restrictions" | "schedule" | "visibility" | "all">;
};

function SectionCard(props: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_40%,transparent)] px-6 py-4">
        <h3 className="text-[16px] font-semibold text-[var(--admin-on-surface)]">{props.title}</h3>
        {props.action}
      </div>
      <div className="space-y-4 p-6">{props.children}</div>
    </div>
  );
}

export function CouponFormFields({
  values,
  onChange,
  courses,
  coursesLoading,
  showIdentity = true,
  sections = ["all"],
}: CouponFormFieldsProps) {
  function patch(partial: Partial<CouponFormValues>) {
    onChange({ ...values, ...partial });
  }

  function toggleCourse(courseId: string) {
    const exists = values.courseIds.includes(courseId);
    patch({
      courseIds: exists
        ? values.courseIds.filter((id) => id !== courseId)
        : [...values.courseIds, courseId],
    });
  }

  const showAll = sections.includes("all");
  const showDiscount = showAll || sections.includes("discount");
  const showRestrictions = showAll || sections.includes("restrictions");
  const showSchedule = showAll || sections.includes("schedule");
  const showVisibility = showAll || sections.includes("visibility");

  const unlimitedUsage = values.totalUsageLimit == null;
  const noExpiry = !values.endsAt;

  const discountBody = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Discount type</label>
        <AdminSelectDropdown
          id="coupon-discount-type"
          label={null}
          ariaLabel="Discount type"
          value={values.discountType}
          options={[
            { value: "PERCENT", label: "Percentage (%)" },
            { value: "FIXED", label: "Fixed amount ($)" },
          ]}
          onChange={(value) => {
            const next = value as CouponDiscountType;
            if (next === "PERCENT" && values.discountValue > 100) {
              patch({ discountType: next, discountValue: 10 });
            } else if (next === "FIXED" && values.discountType === "PERCENT") {
              patch({ discountType: next, discountValue: 1000 });
            } else {
              patch({ discountType: next });
            }
          }}
        />
      </div>
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>
          {values.discountType === "PERCENT" ? "Discount value" : "Discount amount"}
        </label>
        <div className="relative">
          {values.discountType === "FIXED" ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              $
            </span>
          ) : null}
          <input
            type="number"
            min={values.discountType === "PERCENT" ? 1 : 0.01}
            max={values.discountType === "PERCENT" ? 100 : undefined}
            step={values.discountType === "PERCENT" ? 1 : 0.01}
            value={
              values.discountType === "PERCENT"
                ? values.discountValue
                : centsToDollarInput(values.discountValue)
            }
            onChange={(event) => {
              if (values.discountType === "PERCENT") {
                patch({ discountValue: Number(event.target.value) || 0 });
              } else {
                const cents = dollarInputToCents(event.target.value);
                patch({ discountValue: cents && cents > 0 ? cents : 0 });
              }
            }}
            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 ${values.discountType === "FIXED" ? "pl-8" : "pr-10"}`}
          />
          {values.discountType === "PERCENT" ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              %
            </span>
          ) : null}
        </div>
      </div>
      {values.discountType === "PERCENT" ? (
        <div>
          <label className={MESSENGER_WIZARD_LABEL_CLASS}>Max discount cap</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
              $
            </span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={centsToDollarInput(values.maxDiscountCents)}
              onChange={(event) =>
                patch({ maxDiscountCents: dollarInputToCents(event.target.value) })
              }
              className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 pl-8`}
              placeholder="Optional"
            />
          </div>
        </div>
      ) : null}
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Currency</label>
        <AdminSelectDropdown
          id="coupon-currency"
          label={null}
          ariaLabel="Currency"
          value={values.currency}
          options={[
            { value: "USD", label: "USD - US Dollar" },
            { value: "EUR", label: "EUR - Euro" },
            { value: "GBP", label: "GBP - British Pound" },
            { value: "INR", label: "INR - Indian Rupee" },
          ]}
          onChange={(value) => patch({ currency: value })}
        />
      </div>
    </div>
  );

  const restrictionsBody = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Min. purchase amount</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
            $
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={centsToDollarInput(values.minPurchaseCents)}
            onChange={(event) =>
              patch({ minPurchaseCents: dollarInputToCents(event.target.value) })
            }
            className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 pl-8`}
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Total usage limit</label>
        <input
          type="number"
          min={1}
          disabled={unlimitedUsage}
          value={values.totalUsageLimit ?? ""}
          onChange={(event) =>
            patch({
              totalUsageLimit: event.target.value.trim()
                ? Number(event.target.value)
                : null,
            })
          }
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10 disabled:opacity-50`}
          placeholder="Unlimited"
        />
      </div>
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Per-learner limit</label>
        <input
          type="number"
          min={1}
          value={values.perLearnerLimit}
          onChange={(event) => patch({ perLearnerLimit: Number(event.target.value) || 1 })}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
        />
      </div>
    </div>
  );

  const scheduleBody = (
    <div className="space-y-4">
      <div>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Starts at</label>
        <input
          type="datetime-local"
          value={values.startsAt}
          onChange={(event) => patch({ startsAt: event.target.value })}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
        />
      </div>
      <div className={noExpiry ? "pointer-events-none opacity-50" : ""}>
        <label className={MESSENGER_WIZARD_LABEL_CLASS}>Ends at</label>
        <input
          type="datetime-local"
          value={values.endsAt}
          onChange={(event) => patch({ endsAt: event.target.value })}
          className={`${MESSENGER_WIZARD_FIELD_CLASS} h-10`}
          disabled={noExpiry}
        />
      </div>
    </div>
  );

  const visibilityBody = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Coupon visibility</p>
          <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
            Should this be visible on checkout pages?
          </p>
        </div>
        <div className="flex rounded-lg bg-[var(--admin-surface-high)] p-1">
          <button
            type="button"
            onClick={() => patch({ visibility: "PUBLIC" })}
            className={[
              "rounded-md px-3 py-1 text-xs font-bold transition-all",
              values.visibility === "PUBLIC"
                ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                : "text-[var(--admin-on-surface-variant)]",
            ].join(" ")}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => patch({ visibility: "PRIVATE" })}
            className={[
              "rounded-md px-3 py-1 text-xs font-bold transition-all",
              values.visibility === "PRIVATE"
                ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                : "text-[var(--admin-on-surface-variant)]",
            ].join(" ")}
          >
            Private
          </button>
        </div>
      </div>

      <div>
        <p className={MESSENGER_WIZARD_LABEL_CLASS}>Applies to device type</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "ALL", label: "All" },
              { id: "WEB", label: "Web" },
              { id: "MOBILE", label: "Mobile" },
            ] as const
          ).map((entry) => {
            const active = values.deviceType === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => patch({ deviceType: entry.id as CouponDeviceType })}
                className={[
                  "rounded-lg border p-2 text-center text-[10px] font-bold uppercase transition-all",
                  active
                    ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                ].join(" ")}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--admin-border)] pt-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Course scope</p>
            <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
              Select specific courses or the entire catalog
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
            <input
              type="checkbox"
              checked={values.appliesToAllCourses}
              onChange={(event) =>
                patch({
                  appliesToAllCourses: event.target.checked,
                  courseIds: event.target.checked ? [] : values.courseIds,
                })
              }
              className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
            />
            All courses
          </label>
        </div>
        {values.appliesToAllCourses ? (
          <div className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] p-3">
            <span className="text-sm font-semibold text-[var(--admin-primary)]">
              Currently applies to all courses
            </span>
          </div>
        ) : (
          <div>
            {coursesLoading ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading courses…</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-[var(--admin-on-surface-variant)]">No courses found.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--admin-border)] p-3">
                {courses.map((course) => (
                  <label key={course.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={values.courseIds.includes(course.id)}
                      onChange={() => toggleCourse(course.id)}
                      className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                    />
                    {course.title}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!showAll) {
    return (
      <>
        {showDiscount ? (
          <SectionCard title="Discount configuration">{discountBody}</SectionCard>
        ) : null}
        {showRestrictions ? (
          <SectionCard
            title="Usage restrictions"
            action={
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                Unlimited usage
                <input
                  type="checkbox"
                  checked={unlimitedUsage}
                  onChange={(event) =>
                    patch({
                      totalUsageLimit: event.target.checked ? null : values.totalUsageLimit ?? 100,
                    })
                  }
                  className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
              </label>
            }
          >
            {restrictionsBody}
          </SectionCard>
        ) : null}
        {showSchedule ? (
          <SectionCard
            title="Scheduling"
            action={
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                No expiry
                <input
                  type="checkbox"
                  checked={noExpiry}
                  onChange={(event) => {
                    if (event.target.checked) patch({ endsAt: "" });
                    else if (!values.endsAt) {
                      const next = new Date();
                      next.setMonth(next.getMonth() + 1);
                      patch({ endsAt: next.toISOString().slice(0, 16) });
                    }
                  }}
                  className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
              </label>
            }
          >
            {scheduleBody}
          </SectionCard>
        ) : null}
        {showVisibility ? (
          <SectionCard title="Visibility & scope">{visibilityBody}</SectionCard>
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
      {showIdentity ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Coupon code</label>
            <input
              value={values.code}
              onChange={(event) => patch({ code: event.target.value.toUpperCase() })}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} font-mono`}
              maxLength={64}
              placeholder="SAVE20"
            />
          </div>
          <div>
            <label className={MESSENGER_WIZARD_LABEL_CLASS}>Name</label>
            <input
              value={values.name}
              onChange={(event) => patch({ name: event.target.value })}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              maxLength={200}
              placeholder="Spring sale 20%"
            />
          </div>
        </div>
      ) : null}
      {discountBody}
      {restrictionsBody}
      {scheduleBody}
      {visibilityBody}
    </div>
  );
}
