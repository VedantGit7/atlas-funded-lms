"use client";

import { useCallback, useState } from "react";

type VerificationActionsProps = {
  verificationUrl: string;
  shareTitle: string;
  downloadUrl?: string | null;
  appleWalletHref?: string | null;
  googleWalletHref?: string | null;
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export function VerificationActions({
  verificationUrl,
  shareTitle,
  downloadUrl,
  appleWalletHref,
  googleWalletHref,
}: VerificationActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const shareData = { title: shareTitle, url: verificationUrl };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fall through to clipboard copy when the user cancels or share fails.
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(verificationUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failures (permissions, insecure context).
      }
    }
  }, [shareTitle, verificationUrl]);

  return (
    <div className="mt-6 flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={handleShare}
        className={`${buttonBase} bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900`}
      >
        {copied ? "Link copied" : "Share"}
      </button>

      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className={`${buttonBase} border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 focus-visible:ring-neutral-400`}
        >
          Download
        </a>
      ) : null}

      <WalletButton
        label="Add to Apple Wallet"
        href={appleWalletHref ?? null}
      />
      <WalletButton
        label="Add to Google Wallet"
        href={googleWalletHref ?? null}
      />
    </div>
  );
}

function WalletButton({ label, href }: { label: string; href: string | null }) {
  // Wallet issuance requires an authenticated certificate owner, so the public
  // verify page renders a disabled affordance while the endpoints are stubbed.
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled
        data-wallet-endpoint={href ?? undefined}
        title="Coming soon"
        className={`${buttonBase} cursor-not-allowed border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400`}
      >
        {label}
      </button>
      <span className="mt-1 text-[11px] uppercase tracking-wide text-neutral-400">Coming soon</span>
    </span>
  );
}
