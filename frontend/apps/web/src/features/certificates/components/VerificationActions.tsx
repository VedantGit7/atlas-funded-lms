"use client";

import { useCallback, useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";

type WalletPassResponse = {
  data: {
    platform: "apple" | "google";
    status: "not_configured" | "active";
    saveUrl?: string;
    downloadUrl?: string;
    passObjectKey?: string;
    message: string;
  };
};

type VerificationActionsProps = {
  verificationUrl: string;
  shareTitle: string;
  downloadUrl?: string | null;
  certificateId?: string | null;
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export function VerificationActions({
  verificationUrl,
  shareTitle,
  downloadUrl,
  certificateId,
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

    if (typeof navigator !== "undefined") {
      try {
        await navigator.clipboard.writeText(verificationUrl);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch {
        // Ignore clipboard failures (permissions, insecure context).
      }
    }
  }, [shareTitle, verificationUrl]);

  return (
    <div className="mt-6 flex flex-wrap gap-3 print:hidden">
      <button
        type="button"
        onClick={() => {
          void handleShare();
        }}
        className={`${buttonBase} bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-neutral-900`}
      >
        {copied ? "Link copied" : "Share"}
      </button>

      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className={`${buttonBase} border border-input bg-card text-foreground hover:bg-muted focus-visible:ring-ring`}
        >
          Download
        </a>
      ) : null}

      <WalletIssueButton
        label="Add to Apple Wallet"
        platform="apple"
        certificateId={certificateId ?? null}
      />
      <WalletIssueButton
        label="Add to Google Wallet"
        platform="google"
        certificateId={certificateId ?? null}
      />
    </div>
  );
}

function WalletIssueButton({
  label,
  platform,
  certificateId,
}: {
  label: string;
  platform: "apple" | "google";
  certificateId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    if (!certificateId) {
      setMessage("Sign in as the certificate owner to add this to your wallet.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await clientApi.post<WalletPassResponse>(
        `/api/v1/certificates/${certificateId}/wallet/${platform}`,
        null,
        `cert-wallet-${platform}`,
        { silent: true },
      );

      if (response.data.status === "not_configured") {
        setMessage(
          response.data.message === "WALLET_FEATURE_DISABLED"
            ? "Wallet passes are not enabled for this school."
            : response.data.message,
        );
        return;
      }

      if (response.data.saveUrl) {
        window.open(response.data.saveUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (response.data.downloadUrl) {
        window.location.assign(response.data.downloadUrl);
        return;
      }

      setMessage(response.data.message);
    } catch (error) {
      if (error instanceof ClientApiError && (error.status === 401 || error.status === 403)) {
        setMessage("Sign in as the certificate owner to add this to your wallet.");
      } else if (error instanceof ClientApiError) {
        setMessage(error.message);
      } else {
        setMessage("Could not issue wallet pass. Try again later.");
      }
    } finally {
      setBusy(false);
    }
  }, [certificateId, platform]);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        className={`${buttonBase} border border-input bg-card text-foreground hover:bg-muted focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60`}
      >
        {busy ? "Working…" : label}
      </button>
      {message ? (
        <span className="mt-1 max-w-xs text-[11px] leading-snug text-muted-foreground">
          {message}
        </span>
      ) : null}
    </span>
  );
}
