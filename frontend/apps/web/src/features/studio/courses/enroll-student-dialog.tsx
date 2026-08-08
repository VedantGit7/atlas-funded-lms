"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { DropdownField, dropdownItemClassName } from "./admin-form-dropdown-shared";
import {
  dialogLabelClassName,
  primaryButtonClassName,
  RequiredMark,
  statusBannerClassName,
} from "./create-course-dialog-shared";
import { StudentMemberPicker } from "./student-member-picker";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type PaymentMethod = "manual" | "complimentary" | "offline";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "manual", label: "Manual enrollment (no charge)" },
  { value: "complimentary", label: "Complimentary access" },
  { value: "offline", label: "Offline payment recorded" },
];

type EnrollStudentDialogProps = {
  open: boolean;
  course: CourseDetail;
  onClose: () => void;
  onEnrolled: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to enroll student.";
}

export function EnrollStudentDialog({
  open,
  course,
  onClose,
  onEnrolled,
}: EnrollStudentDialogProps) {
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [membershipId, setMembershipId] = useState<string | null>(null);
  const [purchasedCertificate, setPurchasedCertificate] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMembershipId(null);
    setPurchasedCertificate(false);
    setPaymentMethod(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy]);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  const selectedPayment = PAYMENT_OPTIONS.find((option) => option.value === paymentMethod) ?? null;
  const canSubmit =
    membershipId != null && (!purchasedCertificate || paymentMethod != null) && !busy;

  async function enrollMember(targetMembershipId: string) {
    setBusy(true);
    setError(null);

    try {
      await clientApi.post(
        `/api/v1/courses/${course.id}/enrollments`,
        {
          membershipId: targetMembershipId,
          ...(purchasedCertificate ? { purchasedCertificate: true } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
        },
        "course-enroll-student",
      );
      onEnrolled();
      handleClose();
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !membershipId) return;
    await enrollMember(membershipId);
  }

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
            Enroll a Student
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-5 px-6 py-6" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--admin-on-surface)]">
            <input
              type="checkbox"
              checked={purchasedCertificate}
              onChange={(event) => {
                setPurchasedCertificate(event.target.checked);
                if (!event.target.checked) {
                  setPaymentMethod(null);
                }
              }}
              disabled={busy}
              className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
            />
            Purchased Certificate
          </label>

          <StudentMemberPicker
            value={membershipId}
            onChange={setMembershipId}
            disabled={busy}
            onMemberCreated={(member) => enrollMember(member.membershipId)}
          />

          {purchasedCertificate ? (
            <DropdownField
              label={
                <span className={dialogLabelClassName}>
                  Payment
                  <RequiredMark />
                </span>
              }
              labelId="enroll-payment-method"
              open={paymentOpen}
              disabled={busy}
              portalZIndex={90}
              panelRole="listbox"
              panelAriaLabel="Payment methods"
              onToggle={() => {
                if (busy) return;
                setPaymentOpen((current) => !current);
              }}
              triggerContent={
                <span
                  className={
                    selectedPayment
                      ? "text-[var(--admin-on-surface)]"
                      : "text-[var(--admin-on-surface-variant)]"
                  }
                >
                  {selectedPayment?.label ?? "Select payment method"}
                </span>
              }
            >
              <div className="p-1.5">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={paymentMethod === option.value}
                    onClick={() => {
                      setPaymentMethod(option.value);
                      setPaymentOpen(false);
                    }}
                    className={[
                      dropdownItemClassName,
                      paymentMethod === option.value ? "bg-[var(--admin-surface-high)]" : "",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </DropdownField>
          ) : null}

          {error ? (
            <p
              role="alert"
              className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end border-t border-[var(--admin-border)] pt-5">
            <button type="submit" disabled={!canSubmit} className={primaryButtonClassName}>
              {busy ? "Enrolling…" : "Enroll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
