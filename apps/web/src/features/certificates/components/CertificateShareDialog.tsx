"use client";

import { useState } from "react";

type CertificateShareDialogProps = {
  verificationUrl: string;
  open: boolean;
  onClose: () => void;
};

export function CertificateShareDialog({
  verificationUrl,
  open,
  onClose,
}: CertificateShareDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function copyLink() {
    await navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 id="share-dialog-title" className="text-lg font-semibold">
          Share verification link
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          Anyone with this link can verify the credential on the public verification page.
        </p>
        <input
          readOnly
          className="mt-4 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          value={verificationUrl}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md px-3 py-2 text-sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
            onClick={() => void copyLink()}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
