"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Check, Copy, Mail, Send, Share2, X } from "lucide-react";
import { embedCode, shareTargets } from "../certificates-view";

export type ShareCertificate = {
  /** Absolute public verification URL. */
  url: string;
  title: string;
  recipient: string | null;
  issuerName: string | null;
};

type CertificateShareDialogProps = {
  share: ShareCertificate | null;
  onClose: () => void;
};

export function CertificateShareDialog({ share, onClose }: CertificateShareDialogProps) {
  const open = share != null;

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {share ? <SharePanel share={share} onClose={onClose} /> : null}
    </AnimatePresence>
  );
}

function SharePanel({ share, onClose }: { share: ShareCertificate; onClose: () => void }) {
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const targets = shareTargets(share.url, share.title);
  const embed = embedCode(share.url, share.title);

  async function copy(value: string, target: "link" | "embed") {
    if (typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(value);
      if (target === "link") {
        setCopiedLink(true);
        setTimeout(() => {
          setCopiedLink(false);
        }, 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => {
          setCopiedEmbed(false);
        }, 2000);
      }
    } catch {
      // Clipboard unavailable; no action needed.
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.15 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <button
        type="button"
        aria-label="Close share dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        initial={reduce ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: reduce ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 id="share-dialog-title" className="text-lg font-semibold text-foreground">
            Share credential
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/60 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BadgeCheck className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              Digital credential
            </p>
            <p className="text-base font-semibold text-foreground">{share.title}</p>
            {share.recipient ? (
              <p className="text-xs text-muted-foreground">Issued to {share.recipient}</p>
            ) : null}
            {share.issuerName ? (
              <p className="text-[11px] text-muted-foreground">{share.issuerName}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Share to
              </p>
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={targets.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  LinkedIn
                </a>
                <a
                  href={targets.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />X
                </a>
                <a
                  href={targets.email}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Email
                </a>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Direct link
              </p>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={share.url}
                  aria-label="Verification link"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    void copy(share.url, "link");
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copiedLink ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  )}
                  {copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
                Anyone with this link can verify the authenticity of this credential.
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Embed code
              </p>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                  {embed}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void copy(embed, "embed");
                  }}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-border px-3 py-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={copiedEmbed ? "Embed code copied" : "Copy embed code"}
                >
                  {copiedEmbed ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
