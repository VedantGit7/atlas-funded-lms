"use client";

import { SafeHtml } from "@/components/SafeHtml";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { PublicCtaDto } from "../admin/grow/cta-shared";

const SEEN_KEY = "atlas-cta-seen";

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = readSeen();
  seen.add(id);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

function pathMatches(pathname: string, rule: string): boolean {
  const normalized = rule.trim();
  if (!normalized || normalized === "*") return true;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const url = new URL(normalized);
      return pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
    } catch {
      return pathname.includes(normalized);
    }
  }
  if (normalized.endsWith("*")) {
    const prefix = normalized.slice(0, -1);
    return pathname.startsWith(prefix);
  }
  return pathname === normalized || pathname.includes(normalized);
}

function matchesTargeting(cta: PublicCtaDto, pathname: string, isAuthenticated: boolean): boolean {
  const { targeting } = cta;
  if (targeting.audience === "ANONYMOUS" && isAuthenticated) return false;
  if (targeting.audience === "LEARNERS" && !isAuthenticated) return false;

  const included =
    targeting.includeUrls.length === 0 ||
    targeting.includeUrls.some((rule) => pathMatches(pathname, rule));
  if (!included) return false;

  if (targeting.exceptionUrls.some((rule) => pathMatches(pathname, rule))) return false;

  if (targeting.frequency === "ONCE" && readSeen().has(cta.id)) return false;
  return true;
}

async function postMetric(id: string, kind: "view" | "click") {
  try {
    const response = await fetch(
      `/api/v1/public/marketing/ctas/${encodeURIComponent(id)}/${kind}`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.warn(`[cta] metric ${kind} failed`, id, response.status);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[cta] metric ${kind} error`, id, error);
    }
  }
}

function CtaBody({ html, className }: { html: string | null; className?: string }) {
  if (!html?.trim()) return null;
  return (
    // Admin-authored CTA body rendered on a PUBLIC unauthenticated page.
    <SafeHtml html={html} className={className} />
  );
}

async function fetchPublicCtas(attempt = 1): Promise<PublicCtaDto[]> {
  const response = await fetch("/api/v1/public/marketing/ctas", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      return fetchPublicCtas(attempt + 1);
    }
    throw new Error(`CTA list failed (${response.status})`);
  }
  const json = (await response.json()) as { data?: { items: PublicCtaDto[] } };
  return json.data?.items ?? [];
}

type MarketingCtaRuntimeProps = {
  isAuthenticated?: boolean;
};

export function MarketingCtaRuntime({ isAuthenticated = false }: MarketingCtaRuntimeProps) {
  const pathname = usePathname() || "/";
  const [items, setItems] = useState<PublicCtaDto[]>([]);
  const [activePopupId, setActivePopupId] = useState<string | null>(null);
  const [visibleAutoIds, setVisibleAutoIds] = useState<string[]>([]);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const load = useCallback(async () => {
    try {
      const next = await fetchPublicCtas();
      setItems(next);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[cta] failed to load public CTAs", error);
      }
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timers: number[] = [];
    const scheduled = new Set<string>();
    let popupChosen = false;

    setVisibleAutoIds([]);
    setActivePopupId(null);

    for (const cta of items) {
      if (cta.ctaType === "EMBEDDED_BUTTON") continue;
      if (!matchesTargeting(cta, pathname, isAuthenticated)) continue;

      // Only one auto popup at a time (first matching wins).
      if (cta.ctaType === "POPUP" && popupChosen) continue;

      const show = () => {
        if (scheduled.has(cta.id)) return;
        scheduled.add(cta.id);
        setVisibleAutoIds((prev) => (prev.includes(cta.id) ? prev : [...prev, cta.id]));
        void postMetric(cta.id, "view");
        if (cta.targeting.frequency === "ONCE") markSeen(cta.id);
        if (cta.ctaType === "POPUP") setActivePopupId(cta.id);
      };

      if (cta.ctaType === "POPUP") popupChosen = true;

      if (cta.targeting.trigger === "ELAPSED" && cta.targeting.elapsedSeconds > 0) {
        timers.push(window.setTimeout(show, cta.targeting.elapsedSeconds * 1000));
      } else {
        show();
      }
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [items, pathname, isAuthenticated]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("[data-atlas-cta-button]") as HTMLElement | null;
      if (!button) return;
      const id = button.getAttribute("data-atlas-cta-button");
      if (!id) return;
      event.preventDefault();
      void postMetric(id, "click");
      const embedded = byId.get(id);
      if (!embedded) return;
      if (embedded.linkedPopupCtaId) {
        setActivePopupId(embedded.linkedPopupCtaId);
        void postMetric(embedded.linkedPopupCtaId, "view");
        return;
      }
      if (embedded.linkUrl) {
        window.location.assign(embedded.linkUrl);
      }
    }
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, [byId]);

  function onPrimaryAction(cta: PublicCtaDto) {
    void postMetric(cta.id, "click");
    if (cta.linkUrl) {
      window.location.assign(cta.linkUrl);
    }
  }

  const sticky = items.find((cta) => cta.ctaType === "STICKY" && visibleAutoIds.includes(cta.id));
  const slideIns = items.filter(
    (cta) => cta.ctaType === "SLIDE_IN" && visibleAutoIds.includes(cta.id),
  );
  const activePopup = activePopupId ? byId.get(activePopupId) : null;

  return (
    <>
      {sticky ? (
        <div
          className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 px-4 py-3 text-sm shadow-sm"
          style={{ backgroundColor: sticky.backgroundColor, color: "#111" }}
        >
          <div className="min-w-0">
            <p className="font-semibold">{sticky.headline || sticky.buttonText}</p>
            <CtaBody html={sticky.bodyHtml} className="truncate text-xs opacity-80 [&_*]:inline" />
          </div>
          {sticky.linkUrl ? (
            <button
              type="button"
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium"
              style={{
                backgroundColor: sticky.buttonColor,
                color: sticky.buttonTextColor,
              }}
              onClick={() => {
                onPrimaryAction(sticky);
              }}
            >
              {sticky.buttonText}
            </button>
          ) : null}
        </div>
      ) : null}

      {slideIns.map((cta) => (
        <div
          key={cta.id}
          className="fixed bottom-4 right-4 z-[70] w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-neutral-200 shadow-lg"
          style={{ backgroundColor: cta.backgroundColor }}
        >
          {cta.imageUrl ? (
            <img src={cta.imageUrl} alt="" className="h-28 w-full object-cover" />
          ) : null}
          <div className="space-y-2 p-4">
            <p className="font-semibold text-neutral-900">{cta.headline}</p>
            <CtaBody html={cta.bodyHtml} className="text-sm text-neutral-600 prose-sm" />
            {cta.linkUrl ? (
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm font-medium"
                style={{ backgroundColor: cta.buttonColor, color: cta.buttonTextColor }}
                onClick={() => {
                  onPrimaryAction(cta);
                }}
              >
                {cta.buttonText}
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {activePopup ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-xl shadow-xl"
            style={{ backgroundColor: activePopup.backgroundColor }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
              onClick={() => {
                setActivePopupId(null);
              }}
            >
              Close
            </button>
            {activePopup.imageUrl ? (
              <img src={activePopup.imageUrl} alt="" className="h-40 w-full object-cover" />
            ) : null}
            <div className="space-y-3 p-5 pt-10">
              <h2 className="text-lg font-semibold text-neutral-900">{activePopup.headline}</h2>
              <CtaBody html={activePopup.bodyHtml} className="text-sm text-neutral-600" />
              {activePopup.formShareToken ? (
                <iframe
                  title="CTA form"
                  src={`/f/${encodeURIComponent(activePopup.formShareToken)}?source=CTA`}
                  className="h-[28rem] w-full rounded-lg border border-neutral-200 bg-white"
                />
              ) : null}
              {activePopup.linkUrl ? (
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-sm font-medium"
                  style={{
                    backgroundColor: activePopup.buttonColor,
                    color: activePopup.buttonTextColor,
                  }}
                  onClick={() => {
                    onPrimaryAction(activePopup);
                  }}
                >
                  {activePopup.buttonText}
                </button>
              ) : null}
              {!activePopup.formShareToken && !activePopup.linkUrl ? (
                <p className="text-center text-sm text-neutral-500">
                  This promotion has no action configured yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
