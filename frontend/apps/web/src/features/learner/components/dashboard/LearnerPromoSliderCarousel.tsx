"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicPromoSlideDto } from "../../../admin/grow/promo-slider-shared";

function objectFitClass(fit: PublicPromoSlideDto["imageFit"]): string {
  if (fit === "CONTAIN") return "object-contain";
  if (fit === "FILL") return "object-fill";
  return "object-cover";
}

async function fetchPromoSlides(attempt = 1): Promise<PublicPromoSlideDto[]> {
  const response = await fetch("/api/v1/public/marketing/promo-slides", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      return fetchPromoSlides(attempt + 1);
    }
    throw new Error(`Promo slides failed (${response.status})`);
  }
  const json = (await response.json()) as {
    data?: { items: PublicPromoSlideDto[] };
  };
  return (json.data?.items ?? []).filter((item) => Boolean(item.imageUrl?.trim()));
}

export function LearnerPromoSliderCarousel() {
  const [items, setItems] = useState<PublicPromoSlideDto[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchPromoSlides();
        if (!cancelled) {
          setItems(next);
          setIndex(0);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[promo-slider] failed to load slides", error);
        }
        if (!cancelled) setItems([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const safeItems = useMemo(() => items.filter((item) => Boolean(item.imageUrl?.trim())), [items]);

  useEffect(() => {
    if (safeItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % safeItems.length);
    }, 6000);
    return () => {
      window.clearInterval(timer);
    };
  }, [safeItems.length]);

  if (safeItems.length === 0) return null;

  const current = safeItems[Math.min(index, safeItems.length - 1)];
  if (!current?.imageUrl) return null;

  const content = (
    <img
      src={current.imageUrl}
      alt={current.name}
      className={`h-full w-full ${objectFitClass(current.imageFit)}`}
      onError={() => {
        setItems((prev) => prev.filter((item) => item.id !== current.id));
        setIndex(0);
      }}
    />
  );

  return (
    <section
      aria-label="Promotions"
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="relative aspect-[21/9] min-h-[140px] w-full bg-muted">
        {current.linkUrl ? (
          <a href={current.linkUrl} className="block h-full w-full">
            {content}
          </a>
        ) : (
          content
        )}

        {safeItems.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/55"
              onClick={() => {
                setIndex((prev) => (prev - 1 + safeItems.length) % safeItems.length);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/55"
              onClick={() => {
                setIndex((prev) => (prev + 1) % safeItems.length);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {safeItems.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    i === index ? "bg-white" : "bg-white/50",
                  ].join(" ")}
                  onClick={() => {
                    setIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
