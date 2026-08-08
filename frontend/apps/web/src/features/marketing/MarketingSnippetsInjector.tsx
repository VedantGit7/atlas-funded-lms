"use client";

import { useEffect, useRef } from "react";

type PublicSnippets = {
  siteBodyHtml: string | null;
  orderTrackingHtml: string | null;
  signupTrackingHtml: string | null;
};

function injectHtml(html: string, marker: string) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(marker);
  if (existing) existing.remove();

  const wrapper = document.createElement("div");
  wrapper.id = marker;
  wrapper.style.display = "none";
  wrapper.innerHTML = html;

  // Execute scripts by re-creating them (innerHTML does not run scripts).
  const scripts = Array.from(wrapper.querySelectorAll("script"));
  for (const oldScript of scripts) {
    const script = document.createElement("script");
    for (const attr of Array.from(oldScript.attributes)) {
      script.setAttribute(attr.name, attr.value);
    }
    script.text = oldScript.textContent ?? "";
    oldScript.replaceWith(script);
  }

  document.body.appendChild(wrapper);
}

/**
 * Loads Marketing → Integrations code snippets and injects them into the learner
 * / public document. Site Body always; Order Tracking when checkout success query
 * is present; Signup Tracking when on auth signup routes.
 */
export function MarketingSnippetsInjector() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/public/marketing/integrations/snippets", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok || cancelled) return;
        const json = (await response.json()) as { data?: PublicSnippets };
        const data = json.data;
        if (!data || cancelled) return;

        if (data.siteBodyHtml?.trim()) {
          injectHtml(data.siteBodyHtml, "atlas-marketing-snippet-site-body");
        }

        const params = new URLSearchParams(window.location.search);
        const paymentSuccess =
          params.get("UserPaymentSuccess") === "true" ||
          params.get("paymentSuccess") === "true" ||
          params.get("checkout") === "success";
        if (paymentSuccess && data.orderTrackingHtml?.trim()) {
          injectHtml(data.orderTrackingHtml, "atlas-marketing-snippet-order");
        }

        const path = window.location.pathname;
        const onSignup =
          path.includes("/signup") ||
          path.includes("/register") ||
          path.includes("/sign-up");
        if (onSignup && data.signupTrackingHtml?.trim()) {
          injectHtml(data.signupTrackingHtml, "atlas-marketing-snippet-signup");
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[integrations] failed to load code snippets", error);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
