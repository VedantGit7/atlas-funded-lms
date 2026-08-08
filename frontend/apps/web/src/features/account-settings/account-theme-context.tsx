"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AccountThemeKind = "admin" | "studio" | "default" | "settings";

export type AccountThemeClasses = {
  card: string;
  dangerCard: string;
  field: string;
  monoField: string;
  label: string;
  helper: string;
  sectionTitle: string;
  sectionDangerTitle: string;
  sectionDesc: string;
  sectionLabel: string;
  divider: string;
  panel: string;
  panelRow: string;
  stickyHeader: string;
  navActive: string;
  navInactive: string;
  readOnlyField: string;
  primaryButton: string;
  primaryButtonMuted: string;
  outlineButton: string;
  dangerButton: string;
  dangerOutlineButton: string;
  ghostButton: string;
  errorBanner: string;
  infoBanner: string;
  tabActive: string;
  tabInactive: string;
  checkbox: string;
  toggleTrackOn: string;
  toggleTrackOff: string;
  toggleKnob: string;
  pageTitle: string;
  pageDesc: string;
  avatarOverlay: string;
  tableHead: string;
  tableRow: string;
  tableRowCurrent: string;
  modalScrim: string;
  modalCard: string;
  toast: string;
};

/**
 * Full literal Tailwind classes per shell theme (not runtime-interpolated) so
 * Tailwind's static scanner picks up every variant at build time. Each variant
 * points at a different CSS-variable scope: --admin-*, --studio-*, or the
 * unscoped global tokens used by the learner/moderation shells.
 */
const LEGACY_EXTRA: Pick<
  AccountThemeClasses,
  | "sectionLabel"
  | "divider"
  | "panel"
  | "panelRow"
  | "stickyHeader"
  | "navActive"
  | "navInactive"
  | "readOnlyField"
  | "primaryButtonMuted"
  | "toggleKnob"
  | "pageTitle"
  | "pageDesc"
  | "avatarOverlay"
  | "tableHead"
  | "tableRow"
  | "tableRowCurrent"
  | "modalScrim"
  | "modalCard"
  | "toast"
> = {
  sectionLabel: "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
  divider: "border-border",
  panel: "rounded-xl border border-border bg-background",
  panelRow: "border-border hover:bg-muted",
  stickyHeader: "border-border bg-background",
  navActive: "",
  navInactive: "",
  readOnlyField: "rounded-lg border border-border bg-muted px-3 py-2.5",
  primaryButtonMuted: "opacity-80",
  toggleKnob: "bg-white",
  pageTitle: "text-2xl font-semibold text-foreground",
  pageDesc: "text-sm text-muted-foreground",
  avatarOverlay: "bg-black/40 text-white",
  tableHead: "bg-muted text-muted-foreground",
  tableRow: "border-border",
  tableRowCurrent: "bg-muted/50",
  modalScrim: "bg-black/40",
  modalCard: "border-border bg-background",
  toast: "bg-foreground text-background",
};

const CLASSES: Record<AccountThemeKind, AccountThemeClasses> = {
  admin: {
    card: "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm",
    dangerCard: "rounded-xl border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/5 p-5",
    field:
      "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60",
    monoField:
      "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60",
    label: "text-sm font-medium text-[var(--admin-on-surface)]",
    helper: "text-xs text-[var(--admin-on-surface-variant)]",
    sectionTitle: "text-base font-semibold text-[var(--admin-on-surface)]",
    sectionDangerTitle: "text-base font-semibold text-[var(--admin-danger)]",
    sectionDesc: "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]",
    primaryButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    outlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--admin-border)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50",
    dangerButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    dangerOutlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)]/30 px-4 py-2.5 text-sm font-semibold text-[var(--admin-danger)] transition-colors hover:bg-[var(--admin-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50",
    ghostButton:
      "text-sm font-semibold text-[var(--admin-primary)] underline-offset-2 hover:underline",
    errorBanner:
      "rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]",
    infoBanner:
      "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]",
    tabActive:
      "border-b-2 border-[var(--admin-primary)] px-3 py-3 text-sm font-medium text-[var(--admin-primary)] bg-[var(--admin-primary-container)]/10 transition-colors",
    tabInactive:
      "border-b-2 border-transparent px-3 py-3 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)]",
    checkbox: "h-4 w-4 accent-[var(--admin-primary)]",
    toggleTrackOn: "bg-[var(--admin-primary)]",
    toggleTrackOff: "bg-[var(--admin-surface-high)]",
    ...LEGACY_EXTRA,
    sectionLabel: "text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]",
    divider: "border-[var(--admin-border)]",
    panel: "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]",
    panelRow: "border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]",
    readOnlyField:
      "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2.5",
    modalScrim: "bg-[var(--admin-scrim)]",
    modalCard: "border-[var(--admin-border)] bg-[var(--admin-surface)]",
  },
  studio: {
    card: "rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-5 shadow-sm",
    dangerCard: "rounded-xl border border-[var(--studio-danger)]/30 bg-[var(--studio-danger)]/5 p-5",
    field:
      "w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-low)] px-3 py-2.5 text-sm text-[var(--studio-on-surface)] outline-none transition-colors placeholder:text-[var(--studio-on-surface-variant)] focus:border-[var(--studio-primary)] focus:ring-2 focus:ring-[var(--studio-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60",
    monoField:
      "w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-low)] px-3 py-2.5 font-mono text-xs text-[var(--studio-on-surface)] outline-none transition-colors focus:border-[var(--studio-primary)] focus:ring-2 focus:ring-[var(--studio-primary)]/20 disabled:cursor-not-allowed disabled:opacity-60",
    label: "text-sm font-medium text-[var(--studio-on-surface)]",
    helper: "text-xs text-[var(--studio-on-surface-variant)]",
    sectionTitle: "text-base font-semibold text-[var(--studio-on-surface)]",
    sectionDangerTitle: "text-base font-semibold text-[var(--studio-danger)]",
    sectionDesc: "mt-1 text-sm leading-relaxed text-[var(--studio-on-surface-variant)]",
    primaryButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--studio-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--studio-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    outlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--studio-border)] px-4 py-2.5 text-sm font-semibold text-[var(--studio-on-surface)] transition-colors hover:bg-[var(--studio-surface-high)] disabled:cursor-not-allowed disabled:opacity-50",
    dangerButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--studio-danger)] px-4 py-2.5 text-sm font-semibold text-[var(--studio-on-primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    dangerOutlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--studio-danger)]/30 px-4 py-2.5 text-sm font-semibold text-[var(--studio-danger)] transition-colors hover:bg-[var(--studio-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50",
    ghostButton:
      "text-sm font-semibold text-[var(--studio-primary)] underline-offset-2 hover:underline",
    errorBanner:
      "rounded-lg border border-[var(--studio-danger)]/30 bg-[var(--studio-danger)]/10 px-4 py-3 text-sm text-[var(--studio-danger)]",
    infoBanner:
      "rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-low)] px-4 py-3 text-sm text-[var(--studio-on-surface-variant)]",
    tabActive:
      "border-b-2 border-[var(--studio-primary)] px-3 py-3 text-sm font-medium text-[var(--studio-primary)] bg-[var(--studio-primary-container)]/10 transition-colors",
    tabInactive:
      "border-b-2 border-transparent px-3 py-3 text-sm font-medium text-[var(--studio-on-surface-variant)] transition-colors hover:text-[var(--studio-on-surface)]",
    checkbox: "h-4 w-4 accent-[var(--studio-primary)]",
    toggleTrackOn: "bg-[var(--studio-primary)]",
    toggleTrackOff: "bg-[var(--studio-surface-high)]",
    ...LEGACY_EXTRA,
    sectionLabel: "text-xs font-semibold uppercase tracking-wider text-[var(--studio-on-surface-variant)]",
    divider: "border-[var(--studio-border)]",
    panel: "rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)]",
    panelRow: "border-[var(--studio-border)] hover:bg-[var(--studio-surface-low)]",
    readOnlyField:
      "rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-low)] px-3 py-2.5",
    modalScrim: "bg-[var(--acct-scrim)]",
    modalCard: "border-[var(--studio-border)] bg-[var(--studio-surface)]",
  },
  default: {
    card: "rounded-xl border border-border bg-background p-5 shadow-sm",
    dangerCard: "rounded-xl border border-destructive/30 bg-destructive/5 p-5",
    field:
      "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60",
    monoField:
      "w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-60",
    label: "text-sm font-medium text-foreground",
    helper: "text-xs text-muted-foreground",
    sectionTitle: "text-base font-semibold text-foreground",
    sectionDangerTitle: "text-base font-semibold text-destructive",
    sectionDesc: "mt-1 text-sm leading-relaxed text-muted-foreground",
    primaryButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    outlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
    dangerButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
    dangerOutlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50",
    ghostButton: "text-sm font-semibold text-foreground underline-offset-2 hover:underline",
    errorBanner: "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive",
    infoBanner: "rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground",
    tabActive: "border-b-2 border-foreground px-3 py-3 text-sm font-medium text-foreground transition-colors",
    tabInactive:
      "border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
    checkbox: "h-4 w-4 accent-foreground",
    toggleTrackOn: "bg-foreground",
    toggleTrackOff: "bg-muted",
    ...LEGACY_EXTRA,
  },
  settings: {
    card: "rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface-lowest)] p-6 shadow-sm",
    dangerCard:
      "overflow-hidden rounded-xl border border-[var(--acct-danger-border)] bg-[var(--acct-surface-lowest)] shadow-sm",
    field:
      "w-full rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] px-3 py-2 text-sm text-[var(--acct-on-surface)] outline-none transition-all placeholder:text-[var(--acct-on-surface-variant)] focus:border-[var(--acct-primary-container)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--acct-primary-container)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60",
    monoField:
      "w-full rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] px-3 py-2 font-mono text-xs text-[var(--acct-on-surface)] outline-none transition-all focus:border-[var(--acct-primary-container)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--acct-primary-container)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-60",
    label: "text-xs font-medium tracking-wide text-[var(--acct-on-surface-variant)]",
    helper: "text-[11px] font-semibold leading-snug text-[var(--acct-on-surface-variant)]",
    sectionTitle: "text-lg font-semibold tracking-tight text-[var(--acct-on-surface)]",
    sectionDangerTitle: "text-lg font-semibold text-[var(--acct-danger)]",
    sectionDesc: "text-sm leading-relaxed text-[var(--acct-on-surface-variant)]",
    sectionLabel:
      "text-xs font-medium uppercase tracking-wider text-[var(--acct-outline)]",
    divider: "border-[var(--acct-border)]",
    panel:
      "overflow-hidden rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface-lowest)] divide-y divide-[color-mix(in_srgb,var(--acct-border)_30%,transparent)]",
    panelRow:
      "transition-colors hover:bg-[var(--acct-surface-low)] motion-safe:active:scale-[0.995]",
    stickyHeader:
      "sticky top-0 z-10 border-b border-[color-mix(in_srgb,var(--acct-border)_30%,transparent)] bg-[var(--acct-bg)] py-2",
    navActive:
      "relative flex items-center gap-3 bg-[var(--acct-surface-low)] px-4 py-2 font-medium text-[var(--acct-on-surface)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--acct-primary)] motion-safe:active:scale-[0.98]",
    navInactive:
      "flex items-center gap-3 px-4 py-2 text-[var(--acct-on-surface-variant)] transition-colors duration-150 hover:bg-[var(--acct-surface-low)] hover:text-[var(--acct-on-surface)]",
    readOnlyField:
      "flex items-center justify-between rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] px-3 py-2",
    primaryButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--acct-primary)] px-6 py-2 text-xs font-semibold text-[var(--acct-on-primary)] shadow-sm transition-all hover:bg-[var(--acct-primary-container)] motion-safe:active:scale-95 disabled:cursor-not-allowed",
    primaryButtonMuted:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--acct-primary)_40%,transparent)] px-6 py-2 text-xs font-semibold text-[var(--acct-on-primary)] opacity-80 transition-all disabled:cursor-not-allowed",
    outlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--acct-outline)] px-6 py-2 text-xs font-semibold text-[var(--acct-on-surface)] transition-colors hover:bg-[var(--acct-surface-low)] disabled:cursor-not-allowed disabled:opacity-50",
    dangerButton:
      "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--acct-danger-border)] px-4 py-2 text-xs font-bold text-[var(--acct-on-primary)] shadow-sm transition-colors hover:bg-[var(--acct-danger-strong)] motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
    dangerOutlineButton:
      "inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--acct-outline)] px-4 py-2 text-xs font-semibold text-[var(--acct-on-surface)] transition-colors hover:bg-[var(--acct-surface-low)] disabled:cursor-not-allowed disabled:opacity-50",
    ghostButton:
      "text-xs font-semibold text-[var(--acct-primary)] underline-offset-2 hover:underline disabled:opacity-50",
    errorBanner:
      "rounded-lg border border-[color-mix(in_srgb,var(--acct-danger)_30%,transparent)] bg-[var(--acct-danger-container)] px-4 py-3 text-sm text-[var(--acct-on-danger-container)]",
    infoBanner:
      "flex gap-4 rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface-low)] p-4",
    tabActive: "",
    tabInactive: "",
    checkbox: "sr-only peer",
    toggleTrackOn: "bg-[var(--acct-primary)]",
    toggleTrackOff: "bg-[var(--acct-border)]",
    toggleKnob:
      "pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--acct-toggle-knob)] shadow transition-transform",
    pageTitle: "text-2xl font-semibold tracking-tight text-[var(--acct-on-surface)]",
    pageDesc: "text-sm text-[var(--acct-on-surface-variant)]",
    avatarOverlay:
      "absolute inset-0 flex flex-col items-center justify-center bg-[var(--acct-overlay)] text-[var(--acct-on-primary)] opacity-0 transition-opacity group-hover:opacity-100",
    tableHead:
      "bg-[var(--acct-surface-low)] text-xs font-medium uppercase tracking-wider text-[var(--acct-on-surface-variant)]",
    tableRow: "border-[var(--acct-border)]",
    tableRowCurrent: "bg-[color-mix(in_srgb,var(--acct-primary-container)_5%,transparent)]",
    modalScrim: "bg-[var(--acct-scrim)] backdrop-blur-sm",
    modalCard:
      "relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--acct-border)] bg-[var(--acct-surface)] shadow-[0px_4px_24px_color-mix(in_srgb,var(--acct-on-surface)_15%,transparent)] motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]",
    toast:
      "fixed bottom-8 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--acct-outline)_10%,transparent)] bg-[var(--acct-inverse-surface)] px-4 py-3 text-[var(--acct-inverse-on-surface)] shadow-lg motion-safe:animate-[account-toast-in_0.3s_cubic-bezier(0.16,1,0.3,1)]",
  },
};

export type AccountThemeValue = {
  kind: AccountThemeKind;
  classes: AccountThemeClasses;
};

const AccountThemeContext = createContext<AccountThemeValue | null>(null);

export function AccountThemeProvider({
  kind,
  children,
}: {
  kind: AccountThemeKind;
  children: ReactNode;
}) {
  const value: AccountThemeValue = { kind, classes: CLASSES[kind] };
  return <AccountThemeContext.Provider value={value}>{children}</AccountThemeContext.Provider>;
}

export function useAccountTheme(): AccountThemeValue {
  const ctx = useContext(AccountThemeContext);
  if (!ctx) {
    return { kind: "default", classes: CLASSES.default };
  }
  return ctx;
}
