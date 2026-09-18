export {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  selectClassName,
  statusBannerClassName,
} from "../../../app/admin/branding/_components/branding-admin-shared";

export const textareaClassName =
  "w-full resize-y rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export const dialogLabelClassName = "mb-2 block text-sm font-medium text-[var(--admin-on-surface)]";

export const dropdownLabelClassName = "block text-sm font-medium text-[var(--admin-on-surface)]";

export function RequiredMark() {
  return (
    <span className="ml-0.5 text-[var(--admin-danger)]" aria-hidden="true">
      *
    </span>
  );
}
