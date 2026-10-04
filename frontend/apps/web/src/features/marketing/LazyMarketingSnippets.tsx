"use client";

import dynamic from "next/dynamic";

/**
 * Tenant snippets load as their own chunk after hydration. They only ever act
 * after the page is interactive, so they need not weigh on a learner's first
 * load; and until the chunk arrives nothing has been injected, so the
 * injector's guard against carrying code into staff pages is not weakened.
 */
export const LazyMarketingSnippets = dynamic(
  () => import("./MarketingSnippetsInjector").then((module) => module.MarketingSnippetsInjector),
  { ssr: false },
);
