"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { HelpArticleSection } from "../help-center-types";
import { HelpArticleToc } from "./HelpArticleToc";

type HelpArticleTocMobileProps = {
  sections: HelpArticleSection[];
};

export function HelpArticleTocMobile({ sections }: HelpArticleTocMobileProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8 rounded-xl border border-border bg-card md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground"
        aria-expanded={open}
      >
        On this page
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-4">
          <HelpArticleToc sections={sections} />
        </div>
      ) : null}
    </div>
  );
}
