"use client";

import { useEffect, useState } from "react";
import type { HelpArticleSection } from "../help-center-types";

type HelpArticleTocProps = {
  sections: HelpArticleSection[];
};

export function HelpArticleToc({ sections }: HelpArticleTocProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const sectionIds = sections.map((section) => section.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element != null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [sections]);

  function scrollToSection(id: string) {
    const target = document.getElementById(id);
    if (!target) return;

    const offset = 96;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
  }

  return (
    <nav aria-label="On this page" className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <div className="border-l border-border">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                scrollToSection(section.id);
              }}
              className={[
                "block w-full border-l-2 py-1 pl-3 text-left text-sm motion-safe:transition-colors",
                isActive
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary",
              ].join(" ")}
            >
              {section.title}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            scrollToSection("feedback");
          }}
          className={[
            "block w-full border-l-2 py-1 pl-3 text-left text-sm motion-safe:transition-colors",
            activeId === "feedback"
              ? "border-primary font-medium text-primary"
              : "border-transparent text-muted-foreground hover:text-primary",
          ].join(" ")}
        >
          Article feedback
        </button>
      </div>
    </nav>
  );
}
