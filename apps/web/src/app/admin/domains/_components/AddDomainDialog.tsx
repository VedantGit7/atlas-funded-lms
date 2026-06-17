"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../../lib/client-api";

type AddDomainDialogProps = {
  customDomainEntitled: boolean;
};

export function AddDomainDialog({ customDomainEntitled }: AddDomainDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submitDomain() {
    if (!customDomainEntitled) {
      setErrorMessage("Custom domains require the branding.custom_domain.enable entitlement.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/domains",
        {
          hostname: hostname.trim().toLowerCase(),
          type: "CUSTOM_DOMAIN",
          makePrimary,
        },
        "domain-create",
      );
      setHostname("");
      setMakePrimary(false);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {open ? "Close add domain" : "Add custom domain"}
      </button>

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitDomain();
          }}
          aria-label="Add custom domain"
        >
          {!customDomainEntitled ? (
            <p>
              Custom domains are not enabled for this tenant. Atlas fallback subdomains remain
              available without this entitlement.
            </p>
          ) : null}

          <label>
            Hostname
            <input
              type="text"
              value={hostname}
              onChange={(event) => {
                setHostname(event.target.value);
              }}
              required
              minLength={3}
              disabled={!customDomainEntitled || busy}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={makePrimary}
              onChange={(event) => {
                setMakePrimary(event.target.checked);
              }}
              disabled={!customDomainEntitled || busy}
            />
            Set as primary
          </label>

          <button type="submit" disabled={!customDomainEntitled || busy}>
            {busy ? "Creating…" : "Create pending domain"}
          </button>

          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    return `${error.message} (${error.code})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}
