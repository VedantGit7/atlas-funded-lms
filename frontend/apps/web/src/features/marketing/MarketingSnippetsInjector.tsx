"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SIGNUP_COMPLETE_PARAM, snippetsAllowedOn } from "./snippet-scope";

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

  // Execute scripts by re-creating them (innerHTML does not run scripts). They
  // are never given the document nonce: under an enforced CSP only approved
  // external origins run (see docs/runbooks/content-security-policy.md).
  const scripts = Array.from(wrapper.querySelectorAll("script"));
  for (const oldScript of scripts) {
    const script = document.createElement("script");
    for (const attr of Array.from(oldScript.attributes)) {
      if (attr.name.toLowerCase() === "nonce") continue;
      script.setAttribute(attr.name, attr.value);
    }
    script.text = oldScript.textContent;
    oldScript.replaceWith(script);
  }

  document.body.appendChild(wrapper);
}

/**
 * Loads Marketing → Integrations code snippets and injects them on public and
 * learner pages only (audit H5). Site Body on every eligible page; Order
 * Tracking when the checkout-success marker is present; Signup Tracking on the
 * first eligible page after a signup completes, never on the signup form.
 *
 * Injected code cannot be unloaded, and client-side navigation keeps the same
 * document, so once this document has run tenant code, entering a staff,
 * credential or account page is turned into a full page load. The server also
 * returns no snippets to signed-in staff.
 */
export function MarketingSnippetsInjector() {
  const pathname = usePathname();
  const injected = useRef(false);
  const loading = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const eligible = snippetsAllowedOn(pathname);

    if (!eligible) {
      // Leave tenant code behind before showing a page it must not see.
      if (injected.current) window.location.reload();
      return;
    }
    if (injected.current || loading.current) return;
    loading.current = true;
    // Read through a function: the component can unmount across each await.
    const stillMounted = () => mounted.current;

    async function load() {
      try {
        const response = await fetch("/api/v1/public/marketing/integrations/snippets", {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok || !stillMounted()) return;
        const json = (await response.json()) as { data?: PublicSnippets };
        const data = json.data;
        // Navigation is not a cancellation: the snippets belong to the page the
        // user is on now, provided that page is still eligible.
        if (!data || !stillMounted() || !snippetsAllowedOn(window.location.pathname)) return;

        if (data.siteBodyHtml?.trim()) {
          injected.current = true;
          injectHtml(data.siteBodyHtml, "atlas-marketing-snippet-site-body");
        }

        const params = new URLSearchParams(window.location.search);
        const paymentSuccess =
          params.get("UserPaymentSuccess") === "true" ||
          params.get("paymentSuccess") === "true" ||
          params.get("checkout") === "success";
        if (paymentSuccess && data.orderTrackingHtml?.trim()) {
          injected.current = true;
          injectHtml(data.orderTrackingHtml, "atlas-marketing-snippet-order");
        }

        if (params.get(SIGNUP_COMPLETE_PARAM) === "1") {
          if (data.signupTrackingHtml?.trim()) {
            injected.current = true;
            injectHtml(data.signupTrackingHtml, "atlas-marketing-snippet-signup");
          }
          // Fire once: a reload or a shared link must not count the signup again.
          params.delete(SIGNUP_COMPLETE_PARAM);
          const search = params.toString();
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
          );
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[integrations] failed to load code snippets", error);
        }
      } finally {
        loading.current = false;
      }
    }

    void load();
  }, [pathname]);

  return null;
}
